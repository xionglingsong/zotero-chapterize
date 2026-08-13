import { cleanChapterTitle } from "./splitPlanSelection";

export interface ZoteroCreator {
  creatorType: "author";
  firstName?: string;
  lastName?: string;
}

export interface CrossRefSectionMeta {
  title: string;
  creators: ZoteroCreator[];
  bookTitle?: string;
  pages?: string;
  date?: string;
  publisher?: string;
  isbn?: string;
  language?: string;
  doi?: string;
  url?: string;
  libraryCatalog?: string;
}

export type CrossRefConfidence = "high" | "medium" | "low";

export interface CrossRefMatch {
  metadata: CrossRefSectionMeta;
  confidence: number;
  confidenceLevel: CrossRefConfidence;
  titleSimilarity: number;
  bookSimilarity: number;
}

const API = "https://api.crossref.org/works";
const UA =
  "Chapterize Zotero plugin (https://github.com/xionglingsong/zotero-chapterize; mailto:noreply@example.com)";

export function normalizeDoiInput(value: string): string {
  return value
    .trim()
    .replace(/^doi:\s*/i, "")
    .replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, "")
    .trim();
}

async function getJson(url: string): Promise<any | null> {
  try {
    const request = (Zotero as any)?.HTTP?.request;
    if (typeof request === "function") {
      const response = await request("GET", url, {
        headers: { "User-Agent": UA, Accept: "application/json" },
        responseType: "json",
      });
      return response.response;
    }
    const response = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "application/json" },
    });
    return response.ok ? await response.json() : null;
  } catch {
    return null;
  }
}

function firstString(value: unknown): string | undefined {
  const candidate = Array.isArray(value) ? value[0] : value;
  if (typeof candidate !== "string") return undefined;
  const cleaned = candidate.replace(/\s+/g, " ").trim();
  return cleaned || undefined;
}

export function mapCrossRefMessage(m: any): CrossRefSectionMeta | null {
  if (!m) return null;
  const title = firstString(m.title) ?? "";
  if (!title) return null;
  const creators: ZoteroCreator[] = (Array.isArray(m.author) ? m.author : [])
    .map((author: any) => ({
      creatorType: "author" as const,
      firstName: firstString(author?.given),
      lastName: firstString(author?.family),
    }))
    .filter((creator: ZoteroCreator) => creator.firstName || creator.lastName);
  const dateParts =
    m["published-print"]?.["date-parts"]?.[0] ??
    m["published-online"]?.["date-parts"]?.[0] ??
    m.issued?.["date-parts"]?.[0];
  return {
    title,
    creators,
    bookTitle: firstString(m["container-title"]),
    pages: firstString(m.page),
    date: Array.isArray(dateParts) ? dateParts.join("-") : undefined,
    publisher: firstString(m.publisher),
    isbn: firstString(m.ISBN),
    language: firstString(m.language),
    doi: firstString(m.DOI),
    url: firstString(m.URL),
    libraryCatalog: m.DOI ? "DOI.org (Crossref)" : undefined,
  };
}

function normalized(value: string): string {
  return cleanChapterTitle(value)
    .normalize("NFKD")
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function similarity(left: string, right: string): number {
  const a = normalized(left);
  const b = normalized(right);
  if (!a || !b) return 0;
  if (a === b) return 1;
  const aTokens = new Set(a.split(" "));
  const bTokens = new Set(b.split(" "));
  const intersection = [...aTokens].filter((token) =>
    bTokens.has(token),
  ).length;
  const union = new Set([...aTokens, ...bTokens]).size;
  return union ? intersection / union : 0;
}

export function chooseCrossRefMatch(
  chapterTitle: string,
  bookTitle: string | undefined,
  messages: any[],
): CrossRefMatch | null {
  const candidates = messages
    .map((message) => {
      const metadata = mapCrossRefMessage(message);
      if (!metadata) return null;
      const titleSimilarity = similarity(chapterTitle, metadata.title);
      const bookSimilarity = bookTitle
        ? similarity(bookTitle, metadata.bookTitle ?? "")
        : 0.75;
      const confidence = titleSimilarity * 0.82 + bookSimilarity * 0.18;
      return { metadata, confidence, titleSimilarity, bookSimilarity };
    })
    .filter((match): match is Omit<CrossRefMatch, "confidenceLevel"> => !!match)
    .sort((a, b) => b.confidence - a.confidence);
  const best = candidates[0];
  if (!best || best.titleSimilarity < 0.58 || best.confidence < 0.62)
    return null;
  return {
    ...best,
    confidenceLevel:
      best.confidence >= 0.9
        ? "high"
        : best.confidence >= 0.75
          ? "medium"
          : "low",
  };
}

/** Look up a single chapter by DOI. */
export async function fetchSectionByDoi(
  doi: string,
): Promise<CrossRefSectionMeta | null> {
  const normalizedDoi = normalizeDoiInput(doi);
  if (!normalizedDoi) return null;
  const json = await getJson(`${API}/${encodeURIComponent(normalizedDoi)}`);
  return mapCrossRefMessage(json?.message);
}

/** Match a chapter title against Crossref book-chapter records. */
export async function searchSectionByTitle(
  chapterTitle: string,
  opts: { bookTitle?: string; isbn?: string } = {},
): Promise<CrossRefMatch | null> {
  const params = new URLSearchParams({
    "query.title": cleanChapterTitle(chapterTitle),
    rows: "5",
  });
  if (opts.bookTitle) params.set("query.container-title", opts.bookTitle);
  const filters = ["type:book-chapter"];
  const isbn = opts.isbn?.replace(/[^0-9X]/gi, "");
  if (isbn && (isbn.length === 10 || isbn.length === 13)) {
    filters.push(`isbn:${isbn}`);
  }
  params.set("filter", filters.join(","));
  let json = await getJson(`${API}?${params.toString()}`);
  if (filters.length > 1 && !json?.message?.items?.length) {
    params.set("filter", "type:book-chapter");
    json = await getJson(`${API}?${params.toString()}`);
  }
  return chooseCrossRefMatch(
    chapterTitle,
    opts.bookTitle,
    json?.message?.items ?? [],
  );
}

/** Fetch a book's chapter records once and match every outline title locally. */
export async function searchBookSections(
  chapterTitles: string[],
  opts: { bookTitle?: string; isbn?: string } = {},
): Promise<Array<CrossRefMatch | null>> {
  if (chapterTitles.length === 0) return [];
  const params = new URLSearchParams({ rows: "100" });
  if (opts.bookTitle) params.set("query.container-title", opts.bookTitle);
  const isbn = opts.isbn?.replace(/[^0-9X]/gi, "");
  params.set(
    "filter",
    isbn && (isbn.length === 10 || isbn.length === 13)
      ? `type:book-chapter,isbn:${isbn}`
      : "type:book-chapter",
  );
  let json = await getJson(`${API}?${params.toString()}`);
  if (
    !json?.message?.items?.length &&
    params.get("filter")?.includes("isbn:")
  ) {
    params.set("filter", "type:book-chapter");
    json = await getJson(`${API}?${params.toString()}`);
  }
  const messages = json?.message?.items ?? [];
  return chapterTitles.map((title) =>
    chooseCrossRefMatch(title, opts.bookTitle, messages),
  );
}
