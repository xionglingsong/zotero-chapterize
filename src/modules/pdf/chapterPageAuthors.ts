import type { ChapterAuthorCandidate, TocTextLine } from "./tocAuthors";
import { parseCreatorNames, textLinesFromContent } from "./tocAuthors";
import { cleanChapterTitle, isLikelyChapterTitle } from "../splitPlanSelection";
import type { Chapter } from "./outline";

function compact(value: string): string {
  return cleanChapterTitle(value)
    .normalize("NFKD")
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function titleMatches(value: string, title: string): boolean {
  const normalizedValue = compact(value);
  const normalizedTitle = compact(title);
  return (
    !!normalizedValue &&
    !!normalizedTitle &&
    (normalizedValue.includes(normalizedTitle) ||
      normalizedTitle.includes(normalizedValue))
  );
}

function looksLikeNameLine(value: string): boolean {
  const cleaned = value.replace(/^by\s+/i, "").trim();
  const hasBylineMarker = /^by\s+/i.test(value.trim());
  if (/^(?:edited\s+by|editors?|编者|主编)\b/i.test(cleaned)) return false;
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

export function findChapterPageAuthorCandidate(
  lines: TocTextLine[],
  chapterTitle: string,
): ChapterAuthorCandidate | null {
  const searchLimit = Math.min(lines.length, 12);
  let titleEnd = -1;
  for (let index = 0; index < searchLimit; index++) {
    if (titleMatches(lines[index].text, chapterTitle)) {
      titleEnd = index;
      break;
    }
    if (
      index + 1 < searchLimit &&
      lines[index].pageIndex === lines[index + 1].pageIndex &&
      titleMatches(
        `${lines[index].text} ${lines[index + 1].text}`,
        chapterTitle,
      )
    ) {
      titleEnd = index + 1;
      break;
    }
  }
  if (titleEnd < 0) return null;
  const end = Math.min(lines.length, titleEnd + 5);
  for (let index = titleEnd + 1; index < end; index++) {
    const rawText = lines[index].text.trim();
    if (!looksLikeNameLine(rawText)) continue;
    const creators = parseCreatorNames(rawText);
    if (creators.length === 0) continue;
    return {
      chapterTitle,
      creators,
      rawText,
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
  for (const chapter of chapters) {
    const cleanedTitle = cleanChapterTitle(chapter.title);
    if (
      !isLikelyChapterTitle(chapter.title) &&
      cleanedTitle === chapter.title.trim()
    ) {
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
