import type { ZoteroCreator } from "../crossref";
import { cleanChapterTitle } from "../splitPlanSelection";
import type { Chapter } from "./outline";

export interface TocTextLine {
  pageIndex: number;
  text: string;
}

export interface ChapterAuthorCandidate {
  chapterTitle: string;
  creators: ZoteroCreator[];
  rawText: string;
  pageIndex: number;
  confidence: "medium" | "low";
}

const contentsPattern =
  /^(?:table of )?contents$|^contents in detail$|^(?:目次|目录|目錄)$/i;
const structuralPattern =
  /^(?:part|chapter|section|book|contents|introduction|conclusion|editors?|contributors?|第.+[编部篇卷章])\b/i;
const surnameParticles = new Set([
  "al",
  "bin",
  "da",
  "de",
  "del",
  "der",
  "di",
  "dos",
  "du",
  "la",
  "le",
  "van",
  "von",
]);

function compact(value: string): string {
  return cleanChapterTitle(value)
    .normalize("NFKD")
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function titleMatches(line: string, title: string): boolean {
  const normalizedLine = compact(line);
  const normalizedTitle = compact(title);
  if (!normalizedLine || !normalizedTitle) return false;
  if (normalizedLine.includes(normalizedTitle)) return true;
  const titleTokens = normalizedTitle.split(" ");
  const lineTokens = new Set(normalizedLine.split(" "));
  const overlap = titleTokens.filter((token) => lineTokens.has(token)).length;
  return overlap === titleTokens.length;
}

function sharedTitleTokens(line: string, title: string): number {
  const lineTokens = new Set(compact(line).split(" ").filter(Boolean));
  return compact(title)
    .split(" ")
    .filter((token) => lineTokens.has(token)).length;
}

function sameLineAuthor(line: string, title: string): string | null {
  const variants = [title.trim(), cleanChapterTitle(title)].sort(
    (left, right) => right.length - left.length,
  );
  for (const variant of variants) {
    if (!variant) continue;
    const pattern = new RegExp(
      variant.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+"),
      "i",
    );
    const match = pattern.exec(line);
    if (!match) continue;
    const remainder = line
      .slice(match.index + match[0].length)
      .replace(/^[\s.…·:;–—-]*\d+(?:\s*[–—-]\s*\d+)?[\s.…·:;–—-]*/, "")
      .trim();
    if (parseCreatorNames(remainder).length > 0) return remainder;
  }
  return null;
}

function naturalOrderCreator(name: string): ZoteroCreator | null {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return null;
  if (words.length === 1) {
    return { creatorType: "author", lastName: words[0] };
  }
  let surnameStart = words.length - 1;
  while (
    surnameStart > 0 &&
    surnameParticles.has(words[surnameStart - 1].toLocaleLowerCase())
  ) {
    surnameStart--;
  }
  return {
    creatorType: "author",
    firstName: words.slice(0, surnameStart).join(" ") || undefined,
    lastName: words.slice(surnameStart).join(" "),
  };
}

/** Parse conservative TOC name forms into editable Zotero creator fields. */
export function parseCreatorNames(raw: string): ZoteroCreator[] {
  const cleaned = raw
    .replace(/^\s*(?:by|作者)\s*[:：]?\s*/i, "")
    .replace(/\s+\.{2,}\s*\d+\s*$/, "")
    .replace(/\s+\d+(?:\s*[–—-]\s*\d+)?\s*$/, "")
    .replace(/^\s*[-–—·]+|[-–—·]+\s*$/g, "")
    .trim();
  if (
    !cleaned ||
    /\d/.test(cleaned) ||
    structuralPattern.test(cleaned) ||
    cleaned.split(/\s+/).length > 16
  ) {
    return [];
  }

  const hasExplicitSeparator = /\s+(?:and|&|及|和)\s+|;/i.test(cleaned);
  if (!hasExplicitSeparator) {
    const commaParts = cleaned.split(",").map((part) => part.trim());
    if (commaParts.length === 2 && commaParts.every(Boolean)) {
      return [
        {
          creatorType: "author",
          firstName: commaParts[1],
          lastName: commaParts[0],
        },
      ];
    }
  }

  return cleaned
    .split(/\s*(?:;|\s+(?:and|&|及|和)\s+)\s*/i)
    .map((part) => naturalOrderCreator(part.replace(/,$/, "")))
    .filter((creator): creator is ZoteroCreator => !!creator);
}

/** Match author-looking lines only inside the chapter's own TOC segment. */
export function findTocAuthorCandidates(
  lines: TocTextLine[],
  chapterTitles: string[],
): Array<ChapterAuthorCandidate | null> {
  const anchors = chapterTitles.map((title) => {
    for (let index = 0; index < lines.length; index++) {
      if (titleMatches(lines[index].text, title)) {
        return { start: index, end: index };
      }
      if (
        index + 1 < lines.length &&
        lines[index].pageIndex === lines[index + 1].pageIndex &&
        sharedTitleTokens(lines[index].text, title) > 0 &&
        titleMatches(`${lines[index].text} ${lines[index + 1].text}`, title)
      ) {
        return { start: index, end: index + 1 };
      }
    }
    return null;
  });
  return chapterTitles.map((chapterTitle, chapterIndex) => {
    const anchor = anchors[chapterIndex];
    if (!anchor) return null;
    const inlineAuthor = sameLineAuthor(lines[anchor.end].text, chapterTitle);
    if (inlineAuthor) {
      return {
        chapterTitle,
        creators: parseCreatorNames(inlineAuthor),
        rawText: inlineAuthor,
        pageIndex: lines[anchor.end].pageIndex,
        confidence: "medium" as const,
      };
    }
    const nextAnchor = anchors
      .filter(
        (candidate): candidate is { start: number; end: number } =>
          !!candidate && candidate.start > anchor.end,
      )
      .sort((left, right) => left.start - right.start)[0];
    const end = Math.min(nextAnchor?.start ?? lines.length, anchor.end + 3);
    for (let index = anchor.end + 1; index < end; index++) {
      const rawText = lines[index].text.trim();
      const creators = parseCreatorNames(rawText);
      if (creators.length === 0) continue;
      return {
        chapterTitle,
        creators,
        rawText,
        pageIndex: lines[index].pageIndex,
        confidence: "medium" as const,
      };
    }
    return null;
  });
}

function textLinesFromContent(content: any, pageIndex: number): TocTextLine[] {
  const lines: TocTextLine[] = [];
  let current = "";
  let currentY: number | undefined;
  const flush = () => {
    const text = current.replace(/\s+/g, " ").trim();
    if (text) lines.push({ pageIndex, text });
    current = "";
    currentY = undefined;
  };
  for (const item of content?.items ?? []) {
    const text = typeof item?.str === "string" ? item.str : "";
    const y = Array.isArray(item?.transform) ? Number(item.transform[5]) : NaN;
    if (
      current &&
      Number.isFinite(y) &&
      currentY !== undefined &&
      Math.abs(y - currentY) > 2
    ) {
      flush();
    }
    current += `${current ? " " : ""}${text}`;
    if (Number.isFinite(y)) currentY = y;
    if (item?.hasEOL) flush();
  }
  flush();
  return lines;
}

/** Read only explicitly bookmarked contents pages to avoid speculative scans. */
export async function readTocAuthorCandidatesFromDocument(
  doc: any,
  chapters: Chapter[],
): Promise<Array<ChapterAuthorCandidate | null>> {
  const contents = chapters.filter((chapter) =>
    contentsPattern.test(chapter.title.trim()),
  );
  if (contents.length === 0 || typeof doc?.getPage !== "function") {
    return chapters.map(() => null);
  }
  const pageIndexes = new Set<number>();
  for (const entry of contents) {
    const end = Math.min(entry.endPage, entry.startPage + 11);
    for (let page = entry.startPage; page <= end; page++) pageIndexes.add(page);
  }
  const lines: TocTextLine[] = [];
  for (const pageIndex of [...pageIndexes].sort((a, b) => a - b)) {
    try {
      const page = await doc.getPage(pageIndex + 1);
      try {
        lines.push(
          ...textLinesFromContent(await page.getTextContent(), pageIndex),
        );
      } finally {
        page.cleanup?.();
      }
    } catch {
      // A failed contents page must not block PDF splitting.
    }
  }
  return findTocAuthorCandidates(
    lines,
    chapters.map((chapter) => chapter.title),
  );
}
