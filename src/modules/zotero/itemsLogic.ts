export interface PdfAttachmentCandidate {
  isPDFAttachment(): boolean;
}

export interface SplitSelectionCandidate extends PdfAttachmentCandidate {
  id: number;
  itemType: string;
  isRegularItem(): boolean;
  isAttachment(): boolean;
  isEditable(): boolean;
  library: { filesEditable: boolean };
  parentItem?: SplitSelectionCandidate;
}

const markerPrefix = "Chapterize-Source:";

export function choosePdfAttachment<T extends PdfAttachmentCandidate>(
  candidates: T[],
): T | null {
  return candidates.find((item) => item.isPDFAttachment()) ?? null;
}

export async function chooseUsablePdfAttachment<
  T extends PdfAttachmentCandidate & {
    getFilePathAsync(): Promise<string | false>;
  },
>(candidates: T[]): Promise<{ attachment: T; path: string } | null> {
  for (const attachment of candidates) {
    if (!attachment.isPDFAttachment()) continue;
    const path = await attachment.getFilePathAsync();
    if (path) return { attachment, path };
  }
  return null;
}

/** Resolve one unambiguous Book/PDF selection without touching Zotero globals. */
export function chooseSplitSelection<T extends SplitSelectionCandidate>(
  selected: T[],
): { bookItem: T; pdfAttachment: T | null } | null {
  if (selected.length === 0) return null;

  let bookItem: T | null = null;
  let pdfAttachment: T | null = null;
  for (const item of selected) {
    let candidateBook: T | null = null;
    if (item.isRegularItem() && item.itemType === "book") {
      candidateBook = item;
    } else if (
      item.isAttachment() &&
      item.isPDFAttachment() &&
      item.parentItem?.itemType === "book"
    ) {
      candidateBook = item.parentItem as T;
      if (pdfAttachment && pdfAttachment.id !== item.id) return null;
      pdfAttachment = item;
    } else {
      return null;
    }

    if (bookItem && bookItem.id !== candidateBook.id) return null;
    bookItem = candidateBook;
  }

  return bookItem ? { bookItem, pdfAttachment } : null;
}

export function canWriteSplitTarget(target: SplitSelectionCandidate): boolean {
  return target.isEditable() && target.library.filesEditable;
}

export function makeChapterizeMarker(
  sourceKey: string,
  startPage: number,
  endPage: number,
): string {
  return `${markerPrefix} ${sourceKey}:${startPage}-${endPage}`;
}

export function hasChapterizeMarker(extra: string, marker: string): boolean {
  return extra
    .split(/\r?\n/)
    .map((line) => line.trim())
    .includes(marker);
}

export function isReusableChapterizeSection(
  extra: string,
  marker: string,
  hasPdfAttachment: boolean,
): boolean {
  return hasPdfAttachment && hasChapterizeMarker(extra, marker);
}
