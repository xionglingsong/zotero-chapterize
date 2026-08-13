/**
 * Helpers for finding a book's PDF and creating related Book Section items
 * with the split PDF attached.
 */
import {
  canWriteSplitTarget,
  chooseSplitSelection,
  chooseUsablePdfAttachment,
  isReusableChapterizeSection,
  makeChapterizeMarker,
} from "./itemsLogic";
import { cleanChapterTitle } from "../splitPlanSelection";

/**
 * Get the absolute filesystem path of a regular item's primary (best) PDF
 * attachment, or null when there is none.
 */
export async function getPrimaryPdfPath(
  item: Zotero.Item,
): Promise<{ attachment: Zotero.Item; path: string } | null> {
  const candidates = await item.getBestAttachments();
  return chooseUsablePdfAttachment(candidates);
}

export interface SplitTarget {
  bookItem: Zotero.Item;
  pdfAttachment: Zotero.Item | null;
  pdfPath: string | null;
}

/** Resolve either a selected Book or one of its selected PDF attachments. */
export async function resolveSplitTarget(
  selected: Zotero.Item[],
): Promise<SplitTarget | null> {
  const selection = chooseSplitSelection(selected);
  if (!selection) return null;
  const { bookItem, pdfAttachment: selectedPdf } = selection;

  if (selectedPdf?.parentItemID === bookItem.id) {
    const pdfPath = await selectedPdf.getFilePathAsync();
    return {
      bookItem,
      pdfAttachment: selectedPdf,
      pdfPath: pdfPath || null,
    };
  }
  const primary = await getPrimaryPdfPath(bookItem);
  return {
    bookItem,
    pdfAttachment: primary?.attachment ?? null,
    pdfPath: primary?.path ?? null,
  };
}

export function canSplitSelection(selected: Zotero.Item[]): boolean {
  const selection = chooseSplitSelection(selected);
  return selection !== null && canWriteSplitTarget(selection.bookItem);
}

export { canWriteSplitTarget };

export interface SectionPayload {
  title: string;
  /** Page range string, e.g. "12-27" (already in whatever scheme caller chose). */
  pages?: string;
  sourceMarker?: string;
}

const inheritedBookFields = [
  "series",
  "seriesNumber",
  "volume",
  "numberOfVolumes",
  "edition",
  "date",
  "publisher",
  "place",
  "ISBN",
  "language",
  "libraryCatalog",
  "callNumber",
  "rights",
] as const;

/** Copy book-level citation metadata that remains valid for a book section. */
function inheritBookMetadata(
  parent: Zotero.Item,
  section: Zotero.Item,
  onlyMissing = false,
): boolean {
  let changed = false;
  const creators = parent.getCreatorsJSON().map((creator) => ({ ...creator }));
  if (
    creators.length > 0 &&
    (!onlyMissing || section.getCreatorsJSON().length === 0)
  ) {
    section.setCreators(creators);
    changed = true;
  }

  for (const field of inheritedBookFields) {
    const value = parent.getField(field);
    if (value !== "" && (!onlyMissing || section.getField(field) === "")) {
      section.setField(field, value);
      changed = true;
    }
  }
  return changed;
}

/**
 * Create a standalone `bookSection` related to the given book and return it.
 * Regular Zotero items cannot persist `parentID`, so this mirrors Zotero's
 * native "Create Book Section" command with `bookTitle` and Related links.
 */
export async function createBookSection(
  parent: Zotero.Item,
  payload: SectionPayload,
): Promise<Zotero.Item> {
  const section = new Zotero.Item("bookSection");
  section.libraryID = parent.libraryID;
  section.setField("title", payload.title);
  section.setField("bookTitle", String(parent.getField("title")));
  inheritBookMetadata(parent, section);
  if (payload.pages) section.setField("pages", payload.pages);
  if (payload.sourceMarker) section.setField("extra", payload.sourceMarker);
  await section.saveTx();

  try {
    section.addRelatedItem(parent);
    parent.addRelatedItem(section);
    await parent.saveTx({ skipDateModifiedUpdate: true });
    await section.saveTx();
  } catch (error) {
    await rollbackBookSection(parent, section);
    throw error;
  }
  return section;
}

/**
 * Import a PDF file as a stored-file attachment under the given section item.
 */
export async function attachPdfFile(
  sectionItem: Zotero.Item,
  filePath: string,
  fileBaseName?: string,
): Promise<Zotero.Item> {
  const safeBaseName = fileBaseName
    ? (Zotero as any).File.getValidFileName(fileBaseName) || "chapter"
    : undefined;
  return (await Zotero.Attachments.importFromFile({
    file: filePath,
    parentItemID: sectionItem.id,
    fileBaseName: safeBaseName,
  })) as Zotero.Item;
}

/** Create a section and attachment together; remove the section on failure. */
export async function createBookSectionWithPdf(
  parent: Zotero.Item,
  payload: SectionPayload,
  filePath: string,
): Promise<Zotero.Item> {
  const section = await createBookSection(parent, payload);
  try {
    await attachPdfFile(section, filePath, payload.title);
    return section;
  } catch (error) {
    await rollbackBookSection(parent, section);
    throw error;
  }
}

async function rollbackBookSection(
  parent: Zotero.Item,
  section: Zotero.Item,
): Promise<void> {
  try {
    parent.removeRelatedItem(section);
    await parent.saveTx({ skipDateModifiedUpdate: true });
  } catch (rollbackError) {
    ztoolkit.log("Failed to roll back the book relation", rollbackError);
  }
  try {
    await section.eraseTx();
  } catch (rollbackError) {
    ztoolkit.log("Failed to roll back incomplete section", rollbackError);
  }
}

export function sectionKey(payload: SectionPayload): string {
  if (payload.sourceMarker) return `source\u0000${payload.sourceMarker}`;
  return [
    "metadata",
    payload.title.trim().toLowerCase(),
    payload.pages || "",
  ].join("\u0000");
}

export { makeChapterizeMarker };

/** Return reusable keys and fill missing book metadata on generated sections. */
export async function getExistingSectionKeys(
  parent: Zotero.Item,
  sourceKey: string,
): Promise<Set<string>> {
  const keys = new Set<string>();
  const search = new Zotero.Search();
  (search as any).libraryID = parent.libraryID;
  search.addCondition("itemType", "is", "bookSection");
  search.addCondition("extra", "contains", `Chapterize-Source: ${sourceKey}:`);
  const sectionIDs = await search.search();
  if (sectionIDs.length === 0) return keys;

  const sections = await Zotero.Items.getAsync(sectionIDs);
  const attachmentIDs = sections.flatMap((item) => item.getAttachments());
  const attachments = attachmentIDs.length
    ? await Zotero.Items.getAsync(attachmentIDs)
    : [];
  const sectionsWithPdf = new Set(
    attachments
      .filter((attachment) => attachment.isPDFAttachment())
      .map((attachment) => attachment.parentItemID),
  );

  for (const item of sections) {
    const extra = String(item.getField("extra"));
    const sourceMarker = extra
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find((line) => line.startsWith(`Chapterize-Source: ${sourceKey}:`));
    if (!sourceMarker) continue;

    const hasPdfAttachment = sectionsWithPdf.has(item.id);
    if (!isReusableChapterizeSection(extra, sourceMarker, hasPdfAttachment)) {
      continue;
    }

    let changed = inheritBookMetadata(parent, item, true);
    const currentTitle = String(item.getField("title"));
    const cleanedTitle = cleanChapterTitle(currentTitle);
    if (cleanedTitle !== currentTitle) {
      item.setField("title", cleanedTitle);
      changed = true;
    }
    if (changed) {
      try {
        await item.saveTx();
      } catch (error) {
        ztoolkit.log("Failed to fill existing section metadata", error);
      }
    }

    keys.add(
      sectionKey({
        title: String(item.getField("title")),
        pages: String(item.getField("pages")),
        sourceMarker,
      }),
    );
  }

  return keys;
}
