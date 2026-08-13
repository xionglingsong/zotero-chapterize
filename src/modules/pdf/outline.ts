import { loadPdfDoc, releasePdfDoc } from "./pdfjs";
import { isLikelyChapterTitle } from "../splitPlanSelection";

/**
 * A detected chapter (a contiguous page range derived from a PDF bookmark).
 *
 * `startPage` / `endPage` are PHYSICAL pages: 0-based positions in the PDF
 * file, inclusive. These are used to SLICE the PDF. For citation metadata
 * (the `pages` field), map these through `pageLabels.printedRange`, which uses
 * the PDF's printed page labels and falls back to physical numbering.
 */
export interface Chapter {
  title: string;
  level: number;
  startPage: number;
  endPage: number;
}

export interface OutlineOptions {
  /** Lowest bookmark level to keep (1 = top level). Defaults to 1. */
  minLevel?: number;
  /** Highest bookmark level to keep. Defaults to 2. */
  maxLevel?: number;
}

export interface OutlineMark {
  title: string;
  level: number;
  page: number;
}

/** Convert valid bookmark starts into sorted, non-overlapping page ranges. */
export function buildChapterRanges(
  marks: OutlineMark[],
  totalPages: number,
  minLevel = 1,
  maxLevel = 2,
): Chapter[] {
  const starts = marks
    .map((mark, order) => ({ ...mark, order }))
    .filter(
      (mark) =>
        mark.level >= minLevel &&
        mark.level <= maxLevel &&
        mark.page >= 0 &&
        mark.page < totalPages,
    )
    .sort((a, b) => {
      if (a.page !== b.page) return a.page - b.page;
      const titlePriority =
        Number(isLikelyChapterTitle(b.title)) -
        Number(isLikelyChapterTitle(a.title));
      return titlePriority || a.level - b.level || a.order - b.order;
    })
    .filter(
      (mark, index, sorted) =>
        index === 0 || mark.page !== sorted[index - 1].page,
    );

  return starts.map((mark, index) => ({
    title: mark.title || `Section ${index + 1}`,
    level: mark.level,
    startPage: mark.page,
    endPage: (starts[index + 1]?.page ?? totalPages) - 1,
  }));
}

/**
 * Read a PDF's bookmark/outline tree and turn it into chapter page ranges.
 *
 * Outline reading uses pdfjs (not pdf-lib) because real publisher PDFs use
 * named destinations stored in `/Names/Dests` name trees, which pdfjs resolves
 * correctly via `getDestination(name)` + `getPageIndex(ref)`. pdf-lib's
 * low-level dest handling is unreliable for those.
 */
export async function readPdfOutline(
  bytes: Uint8Array,
  opts: OutlineOptions = {},
): Promise<Chapter[]> {
  const doc = await loadPdfDoc(bytes);
  try {
    return await readPdfOutlineFromDocument(doc, opts);
  } finally {
    await releasePdfDoc(doc);
  }
}

/** Read bookmark ranges from an already-loaded PDF.js document. */
export async function readPdfOutlineFromDocument(
  doc: any,
  opts: OutlineOptions = {},
): Promise<Chapter[]> {
  const minLevel = opts.minLevel ?? 1;
  const maxLevel = opts.maxLevel ?? 2;

  const outline = (await doc.getOutline()) ?? [];
  const marks: OutlineMark[] = [];

  const walk = async (items: any[], level: number) => {
    if (level > maxLevel) return;
    for (const item of items) {
      // A dest can be an explicit array `[pageRef, /Fit, ...]` or a named
      // destination (string). Resolve named dests through the name tree.
      let dest = item.dest;
      if (typeof dest === "string") {
        try {
          dest = await doc.getDestination(dest);
        } catch {
          dest = null;
        }
      }
      let page = -1;
      if (Array.isArray(dest) && dest[0]) {
        try {
          page = await doc.getPageIndex(dest[0]);
        } catch {
          page = -1;
        }
      }
      marks.push({ title: item.title ?? "", level, page });
      if (item.items?.length) await walk(item.items, level + 1);
    }
  };
  await walk(outline, 1);

  return buildChapterRanges(marks, doc.numPages, minLevel, maxLevel);
}
