import type { ChapterAuthorCandidate, TocTextLine } from "./tocAuthors";
import { parseCreatorNames, textLinesFromContent } from "./tocAuthors";
import {
  cleanChapterTitle,
  recommendedSplitSelection,
} from "../splitPlanSelection";
import type { Chapter } from "./outline";

function compact(value: string): string {
  return cleanChapterTitle(value)
    .normalize("NFKD")
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function titleTokens(value: string): string[] {
  return compact(value).split(" ").filter(Boolean);
}

function findTitleEnd(lines: TocTextLine[], title: string): number {
  const expected = titleTokens(title);
  if (expected.length === 0) return -1;
  let best: { end: number; score: number } | null = null;
  const searchLimit = Math.min(lines.length, 20);
  for (let start = 0; start < searchLimit; start++) {
    let combined = "";
    for (
      let end = start;
      end < Math.min(searchLimit, start + 5) &&
      lines[end].pageIndex === lines[start].pageIndex;
      end++
    ) {
      combined += `${combined ? " " : ""}${lines[end].text}`;
      const actual = titleTokens(combined);
      const actualSet = new Set(actual);
      const overlap = expected.filter((token) => actualSet.has(token)).length;
      const coverage = overlap / expected.length;
      const precision = overlap / Math.max(1, actual.length);
      if (coverage < 0.72 || precision < 0.65) continue;
      const score = coverage + precision;
      if (!best || score > best.score) best = { end, score };
    }
  }
  return best?.end ?? -1;
}

const affiliationPattern =
  /\b(?:academy|centre|center|college|department|faculty|hospital|institute|laboratory|school|university|universität|université|大学|学院|研究所|研究院|实验室|系)\b/i;

function cleanByline(value: string): string {
  return value
    .replace(/\s+(?:\d{1,2}|[*†‡])(?:\s*[,;]\s*(?:\d{1,2}|[*†‡]))*\s*$/u, "")
    .replace(/\s+/g, " ")
    .trim();
}

function looksLikeNameLine(value: string): boolean {
  const normalized = cleanByline(value);
  const cleaned = normalized.replace(/^by\s+/i, "").trim();
  const hasBylineMarker = /^by\s+/i.test(value.trim());
  if (/^(?:edited\s+by|editors?|编者|主编)\b/i.test(cleaned)) return false;
  if (affiliationPattern.test(cleaned)) return false;
  if (hasBylineMarker) return true;
  if (
    /\b(?:abstract|chapter|contents|introduction|keywords?|methods?|research|results?|summary)\b/i.test(
      cleaned,
    )
  ) {
    return false;
  }
  const words = cleaned.split(/\s+/).filter(Boolean);
  if (words.length < 2 || words.length > 8 || /[.!?。！？]/.test(cleaned)) {
    return false;
  }
  return words.every(
    (word) =>
      /^(?:and|&|及|和)$/i.test(word) ||
      /^[\p{Lu}][\p{L}'’.-]*$/u.test(word) ||
      /^[\p{Lu}]\.$/u.test(word),
  );
}

function looksLikeNameFragment(value: string): boolean {
  const cleaned = cleanByline(value)
    .replace(/^by\s+/i, "")
    .trim();
  return (
    !affiliationPattern.test(cleaned) &&
    !/\d|[.!?。！？]/.test(cleaned) &&
    /^[\p{Lu}][\p{L}'’.-]+$/u.test(cleaned)
  );
}

function authorGroupAt(
  lines: TocTextLine[],
  start: number,
  end: number,
): { creators: ReturnType<typeof parseCreatorNames>; rawText: string } | null {
  const pageIndex = lines[start].pageIndex;
  const rawParts: string[] = [];
  const cleanedParts: string[] = [];
  let index = start;
  while (index < end && lines[index].pageIndex === pageIndex) {
    const rawText = lines[index].text.trim();
    const cleaned = cleanByline(rawText);
    if (looksLikeNameLine(cleaned)) {
      rawParts.push(rawText);
      cleanedParts.push(cleaned);
      index++;
      continue;
    }
    if (
      index + 1 < end &&
      lines[index + 1].pageIndex === pageIndex &&
      looksLikeNameFragment(rawText) &&
      looksLikeNameFragment(lines[index + 1].text)
    ) {
      const nextRaw = lines[index + 1].text.trim();
      rawParts.push(`${rawText} ${nextRaw}`);
      cleanedParts.push(`${cleanByline(rawText)} ${cleanByline(nextRaw)}`);
      index += 2;
      continue;
    }
    break;
  }
  if (cleanedParts.length === 0) return null;
  const creators = parseCreatorNames(cleanedParts.join("; "));
  return creators.length > 0
    ? { creators, rawText: rawParts.join("; ") }
    : null;
}

export function findChapterPageAuthorCandidate(
  lines: TocTextLine[],
  chapterTitle: string,
): ChapterAuthorCandidate | null {
  const titleEnd = findTitleEnd(lines, chapterTitle);
  if (titleEnd < 0) return null;
  const end = Math.min(lines.length, titleEnd + 9);
  for (let index = titleEnd + 1; index < end; index++) {
    const group = authorGroupAt(lines, index, end);
    if (!group) continue;
    return {
      chapterTitle,
      creators: group.creators,
      rawText: group.rawText,
      pageIndex: lines[index].pageIndex,
      confidence: "medium",
    };
  }
  return null;
}

/** Read at most the first two physical pages of chapter-like bookmarks. */
export async function readChapterPageAuthorCandidatesFromDocument(
  doc: any,
  chapters: Chapter[],
): Promise<Array<ChapterAuthorCandidate | null>> {
  if (typeof doc?.getPage !== "function") return chapters.map(() => null);
  const linesByPage = new Map<number, TocTextLine[]>();

  async function linesForPage(pageIndex: number): Promise<TocTextLine[]> {
    const cached = linesByPage.get(pageIndex);
    if (cached) return cached;
    try {
      const page = await doc.getPage(pageIndex + 1);
      try {
        const lines = textLinesFromContent(
          await page.getTextContent(),
          pageIndex,
        );
        linesByPage.set(pageIndex, lines);
        return lines;
      } finally {
        page.cleanup?.();
      }
    } catch {
      linesByPage.set(pageIndex, []);
      return [];
    }
  }

  const results: Array<ChapterAuthorCandidate | null> = [];
  const scanSelection = recommendedSplitSelection(chapters);
  for (const [chapterIndex, chapter] of chapters.entries()) {
    if (!scanSelection[chapterIndex]) {
      results.push(null);
      continue;
    }
    const lines: TocTextLine[] = [];
    const endPage = Math.min(chapter.endPage, chapter.startPage + 1);
    for (let pageIndex = chapter.startPage; pageIndex <= endPage; pageIndex++) {
      lines.push(...(await linesForPage(pageIndex)));
    }
    results.push(findChapterPageAuthorCandidate(lines, chapter.title));
  }
  return results;
}
