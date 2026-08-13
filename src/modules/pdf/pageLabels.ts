import { loadPdfDoc, releasePdfDoc } from "./pdfjs";

/**
 * Page numbers come in two flavors, and Chapterize must keep them apart:
 *
 *   • PHYSICAL page — the 0-based position of a page in the PDF file. This is
 *     what we slice on (bookmarks resolve to physical pages; when a user types
 *     page numbers for a bookmark-less PDF they type physical page numbers).
 *
 *   • PRINTED page label — the number/letter actually printed on the page
 *     ("iii", "12", "A-4"). This is what belongs in a citation, so it goes in
 *     the `pages` field of each Book Section item.
 *
 * pdfjs's `getPageLabels()` reads the PDF's `/PageLabels` tree for us. Safe
 * fallback: any error / missing tree yields `[]`, and callers then fall back
 * to physical page numbers.
 */

/**
 * Return printed page labels indexed by PHYSICAL page (0-based). Empty array
 * means the PDF declares no page labels — fall back to physical numbering.
 */
export async function getPageLabels(bytes: Uint8Array): Promise<string[]> {
  try {
    const doc = await loadPdfDoc(bytes);
    try {
      return await readPageLabelsFromDocument(doc);
    } finally {
      await releasePdfDoc(doc);
    }
  } catch {
    return [];
  }
}

/** Read labels from an existing PDF.js document; absence is a safe fallback. */
export async function readPageLabelsFromDocument(doc: any): Promise<string[]> {
  try {
    const labels = await doc.getPageLabels();
    return Array.isArray(labels) ? labels : [];
  } catch {
    return [];
  }
}

/**
 * Build the citation `pages` string for a physical page range, using printed
 * labels when available and falling back to 1-based physical pages otherwise.
 */
export function printedRange(
  labels: string[],
  startPhysical: number,
  endPhysical: number,
): string {
  const a = labels[startPhysical];
  const b = labels[endPhysical];
  if (a && b) {
    return startPhysical === endPhysical ? a : `${a}-${b}`;
  }
  const pa = startPhysical + 1;
  const pb = endPhysical + 1;
  return startPhysical === endPhysical ? String(pa) : `${pa}-${pb}`;
}

/** Total number of physical pages in the PDF (for bounds-checking user input). */
export async function getPhysicalPageCount(bytes: Uint8Array): Promise<number> {
  return (await getPdfIdentity(bytes)).totalPages;
}

export interface PdfIdentity {
  totalPages: number;
  fingerprint: string;
}

export function fallbackPdfFingerprint(bytes: Uint8Array): string {
  let first = 0x811c9dc5;
  let second = 0x9e3779b9;
  for (const byte of bytes) {
    first = Math.imul(first ^ byte, 0x01000193);
    second = Math.imul(second ^ byte, 0x85ebca6b);
  }
  const hex = (value: number) => (value >>> 0).toString(16).padStart(8, "0");
  return `bytes-${bytes.length}-${hex(first)}${hex(second)}`;
}

export function pdfIdentityFromDocument(
  doc: any,
  fallbackFingerprint = `pages-${doc.numPages}`,
): PdfIdentity {
  return {
    totalPages: doc.numPages,
    fingerprint: doc.fingerprints?.[0] || fallbackFingerprint,
  };
}

/** Stable PDF identity used to invalidate deduplication after file replacement. */
export async function getPdfIdentity(bytes: Uint8Array): Promise<PdfIdentity> {
  const doc = await loadPdfDoc(bytes);
  try {
    const fallback = doc.fingerprints?.[0]
      ? undefined
      : fallbackPdfFingerprint(bytes);
    return pdfIdentityFromDocument(doc, fallback);
  } finally {
    await releasePdfDoc(doc);
  }
}
