interface TitledEntry {
  title: string;
}

interface HierarchicalRangeEntry {
  level: number;
  startPage: number;
  endPage: number;
}

const numberedChapterPattern =
  /^\s*(?:(?:chapter|chap\.?|ch\.?)\s+(?:\d+|[ivxlcdm]+)\b|第\s*[0-9一二三四五六七八九十百零〇两]+\s*章)/i;
const standaloneSectionPattern =
  /^(?:\s*(?:introduction|conclusion|prologue|epilogue)\b|\s*(?:引言|导论|绪论|结语|后记))/i;
const nonChapterPattern =
  /^\s*(?:cover|half[ -]?title|series page|title page|copyright|table of contents|contents|list of (?:contributors|figures|tables|abbreviations)|editors?(?: and|\b)|editorial (?:board|advisory)|part\s+(?:\d+|[ivxlcdm]+)\b|book\s+(?:\d+|[ivxlcdm]+)\b|封面|扉页|版权页?|目录|作者简介|编者|第\s*[0-9一二三四五六七八九十百零〇两]+\s*[编部篇卷])/i;
const englishChapterPrefix =
  /^\s*(?:chapter|chap\.?|ch\.?)\s+(?:\d+|[ivxlcdm]+)(?:\s*[:：.\-–—]\s*|\s+)(.+)$/i;
const chineseChapterPrefix =
  /^\s*第\s*[0-9一二三四五六七八九十百零〇两]+\s*章(?:\s*[:：.\-–—]\s*|\s*)(.+)$/i;
const bareChapterNumberPrefix =
  /^\s*\d{1,3}(?:\s*[:：.\-–—]\s*|\s+)(?=\p{L})(.+)$/u;

/** Remove a structural chapter-number prefix while preserving the real title. */
export function cleanChapterTitle(title: string): string {
  const trimmed = title.trim();
  const match =
    englishChapterPrefix.exec(trimmed) ??
    chineseChapterPrefix.exec(trimmed) ??
    bareChapterNumberPrefix.exec(trimmed);
  const cleaned = match?.[1]?.trim();
  return cleaned || trimmed;
}

export function isNumberedChapterTitle(title: string): boolean {
  return !nonChapterPattern.test(title) && numberedChapterPattern.test(title);
}

export function isLikelyChapterTitle(title: string): boolean {
  return (
    !nonChapterPattern.test(title) &&
    (isNumberedChapterTitle(title) || standaloneSectionPattern.test(title))
  );
}

/** Recommend useful citation sections without removing any source bookmarks. */
export function recommendedSplitSelection(entries: TitledEntry[]): boolean[] {
  const hasNumberedChapters = entries.some((entry) =>
    isNumberedChapterTitle(entry.title),
  );
  if (hasNumberedChapters) {
    return entries.map((entry) => isLikelyChapterTitle(entry.title));
  }

  const contentEntries = entries.map(
    (entry) => !nonChapterPattern.test(entry.title),
  );
  return contentEntries.some(Boolean)
    ? contentEntries
    : entries.map(() => true);
}

/** Extend selected outline entries across their unselected descendants. */
export function recommendedRangeEndPages(
  entries: HierarchicalRangeEntry[],
  selection: boolean[],
  totalPages: number,
): number[] {
  return entries.map((entry, index) => {
    if (!selection[index]) return entry.endPage;

    const boundary = entries.find(
      (candidate, candidateIndex) =>
        candidateIndex > index &&
        candidate.startPage > entry.startPage &&
        (selection[candidateIndex] || candidate.level <= entry.level),
    );
    return Math.max(entry.startPage, (boundary?.startPage ?? totalPages) - 1);
  });
}
