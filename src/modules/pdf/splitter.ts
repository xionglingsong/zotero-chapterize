import { PDFDocument } from "pdf-lib";

/**
 * Extract a contiguous page range (0-based, inclusive) from a PDF as a new
 * standalone PDF document's bytes. `copyPages` preserves page content and
 * annotations are re-linked to their new pages by pdf-lib.
 */
export type PdfPageSplitter = (
  startPage: number,
  endPage: number,
) => Promise<Uint8Array>;

export class EncryptedPdfUnsupportedError extends Error {
  constructor() {
    super("Encrypted PDFs must be decrypted before Chapterize can split them.");
    this.name = "EncryptedPdfUnsupportedError";
  }
}

export function isEncryptedPdfError(error: unknown): boolean {
  return (
    error instanceof EncryptedPdfUnsupportedError ||
    (typeof error === "object" &&
      error !== null &&
      "name" in error &&
      error.name === "PasswordException")
  );
}

export function assertPdfIsSplittable(
  document: Pick<PDFDocument, "isEncrypted">,
): void {
  if (document.isEncrypted) throw new EncryptedPdfUnsupportedError();
}

/** Load the source once and return a function that can create many ranges. */
export async function createPdfPageSplitter(
  bytes: Uint8Array,
): Promise<PdfPageSplitter> {
  const src = await PDFDocument.load(bytes, {
    updateMetadata: false,
    // See outline.ts: publisher PDFs are commonly owner-password encrypted.
    ignoreEncryption: true,
  });
  assertPdfIsSplittable(src);
  return async (startPage, endPage) => {
    const indices: number[] = [];
    for (let i = startPage; i <= endPage; i++) indices.push(i);
    const out = await PDFDocument.create();
    const copied = await out.copyPages(src, indices);
    copied.forEach((page) => out.addPage(page));
    return out.save();
  };
}

export async function splitPdfPages(
  bytes: Uint8Array,
  startPage: number,
  endPage: number,
): Promise<Uint8Array> {
  const split = await createPdfPageSplitter(bytes);
  return split(startPage, endPage);
}
