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
import {
  readTocAuthorCandidatesFromDocument,
  type ChapterAuthorCandidate,
} from "./tocAuthors";

export interface PdfInspection extends PdfIdentity {
  chapters: Chapter[];
  pageLabels: string[];
  authorCandidates: Array<ChapterAuthorCandidate | null>;
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
  const authorCandidates = await readTocAuthorCandidatesFromDocument(
    doc,
    chapters,
  );
  return {
    ...pdfIdentityFromDocument(doc, fallbackFingerprint),
    chapters,
    pageLabels,
    authorCandidates,
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
