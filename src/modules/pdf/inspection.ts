import {
  readPdfOutlineFromDocument,
  type Chapter,
  type OutlineOptions,
} from "./outline";
import {
  fallbackPdfFingerprint,
  pdfIdentityFromDocument,
  readPageLabelsFromDocument,
  type PdfIdentity,
} from "./pageLabels";
import { loadPdfDoc, releasePdfDoc } from "./pdfjs";

export interface PdfInspection extends PdfIdentity {
  chapters: Chapter[];
  pageLabels: string[];
}

export async function inspectLoadedPdf(
  doc: any,
  opts: OutlineOptions = {},
  fallbackFingerprint?: string,
): Promise<PdfInspection> {
  const [chapters, pageLabels] = await Promise.all([
    readPdfOutlineFromDocument(doc, opts),
    readPageLabelsFromDocument(doc),
  ]);
  return {
    ...pdfIdentityFromDocument(doc, fallbackFingerprint),
    chapters,
    pageLabels,
  };
}

/** Read all preview metadata in one PDF.js document lifecycle. */
export async function inspectPdf(
  bytes: Uint8Array,
  opts: OutlineOptions = {},
): Promise<PdfInspection> {
  const doc = await loadPdfDoc(bytes);
  try {
    const fallback = doc.fingerprints?.[0]
      ? undefined
      : fallbackPdfFingerprint(bytes);
    return await inspectLoadedPdf(doc, opts, fallback);
  } finally {
    await releasePdfDoc(doc);
  }
}
