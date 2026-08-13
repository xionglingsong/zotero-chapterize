/**
 * CrossRef integration.
 *
 * Not wired into the M2 split flow yet — the M3 preview dialog will call
 * `fetchSectionByDoi` per chapter (user-entered DOI) and `searchSectionByTitle`
 * for the "auto-match all" button. Field mapping follows the Zotero
 * `bookSection` item type.
 */

export interface ZoteroCreator {
  creatorType: string;
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
}

const API = "https://api.crossref.org/works";
// CrossRef asks for a descriptive User-Agent with mailto for polite pooling.
const UA =
  "Chapterize Zotero plugin (https://github.com/xionglingsong/zotero-chapterize; mailto:noreply@example.com)";

async function getJson(url: string): Promise<any | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "application/json" },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

function mapMessage(m: any): CrossRefSectionMeta | null {
  if (!m) return null;
  const title: string = Array.isArray(m.title)
    ? (m.title[0] ?? "")
    : (m.title ?? "");
  const creators: ZoteroCreator[] = (m.author ?? []).map((a: any) => ({
    creatorType: "author",
    firstName: a.given,
    lastName: a.family,
  }));
  const bookTitle: string | undefined = Array.isArray(m["container-title"])
    ? m["container-title"]?.[0]
    : m["container-title"];
  const dateRaw =
    m["published-print"]?.["date-parts"]?.[0] ??
    m["published-online"]?.["date-parts"]?.[0] ??
    m.issued?.["date-parts"]?.[0];
  const date = Array.isArray(dateRaw) ? dateRaw.join("-") : dateRaw;
  const isbn: string | undefined = (m.ISBN ?? [])?.[0];
  return {
    title,
    creators,
    bookTitle,
    pages: m.page,
    date,
    publisher: m.publisher,
    isbn,
    language: m.language,
    doi: m.DOI,
  };
}

/** Look up a single chapter by DOI. Returns null on miss/network error. */
export async function fetchSectionByDoi(
  doi: string,
): Promise<CrossRefSectionMeta | null> {
  const json = await getJson(`${API}/${encodeURIComponent(doi.trim())}`);
  return mapMessage(json?.message);
}

/**
 * Best-effort title match for a chapter inside a book. `bookTitle`/`isbn`
 * improve precision when available. Returns the top hit or null.
 */
export async function searchSectionByTitle(
  chapterTitle: string,
  opts: { bookTitle?: string; isbn?: string } = {},
): Promise<CrossRefSectionMeta | null> {
  const params = new URLSearchParams({
    "query.bibliographic": chapterTitle,
    rows: "1",
  });
  if (opts.bookTitle) params.set("query.container-title", opts.bookTitle);
  const filterParts = ["type:book-section"];
  if (opts.isbn) filterParts.push(`isbn:${opts.isbn}`);
  params.set("filter", filterParts.join(","));
  const json = await getJson(`${API}?${params.toString()}`);
  const item = json?.message?.items?.[0];
  return mapMessage(item);
}
