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
import type { CrossRefSectionMeta } from "../crossref";

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
  /** Chapter-level metadata accepted by the user in the split preview. */
  metadata?: Partial<CrossRefSectionMeta>;
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
): number {
  let changed = 0;
  for (const field of inheritedBookFields) {
    const value = parent.getField(field);
    if (value !== "" && (!onlyMissing || section.getField(field) === "")) {
      section.setField(field, value);
      changed++;
    }
  }
  return changed;
}

const metadataFieldMap = {
  bookTitle: "bookTitle",
  pages: "pages",
  date: "date",
  publisher: "publisher",
  isbn: "ISBN",
  language: "language",
  doi: "DOI",
  url: "url",
  libraryCatalog: "libraryCatalog",
} as const;

/** Apply only chapter metadata that the user explicitly accepted. */
export function applySectionMetadata(
  section: Zotero.Item,
  metadata: Partial<CrossRefSectionMeta> | undefined,
): number {
  if (!metadata) return 0;
  let changed = 0;
  if (metadata.title && section.getField("title") !== metadata.title) {
    section.setField("title", metadata.title);
    changed++;
  }
  for (const [sourceField, zoteroField] of Object.entries(metadataFieldMap)) {
    const value = metadata[sourceField as keyof typeof metadataFieldMap];
    if (
      typeof value === "string" &&
      value &&
      section.getField(zoteroField) !== value
    ) {
      section.setField(zoteroField, value);
      changed++;
    }
  }
  if (metadata.creators) {
    const next = metadata.creators.map((creator) => ({ ...creator }));
    if (JSON.stringify(section.getCreatorsJSON()) !== JSON.stringify(next)) {
      section.setCreators(next);
      changed++;
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
  applySectionMetadata(section, payload.metadata);
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

export interface ExistingSectionsResult {
  keys: Set<string>;
  sectionsByKey: Map<string, Zotero.Item>;
  repairedItems: number;
  repairedFields: number;
}

/** Inspect reusable generated sections and backfill safe book-level metadata. */
export async function inspectExistingSections(
  parent: Zotero.Item,
  sourceKey: string,
  cleanTitles = true,
): Promise<ExistingSectionsResult> {
  const result: ExistingSectionsResult = {
    keys: new Set<string>(),
    sectionsByKey: new Map<string, Zotero.Item>(),
    repairedItems: 0,
    repairedFields: 0,
  };
  const search = new Zotero.Search();
  (search as any).libraryID = parent.libraryID;
  search.addCondition("itemType", "is", "bookSection");
  search.addCondition("extra", "contains", `Chapterize-Source: ${sourceKey}:`);
  const sectionIDs = await search.search();
  if (sectionIDs.length === 0) return result;

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
    if (
      !isReusableChapterizeSection(
        extra,
        sourceMarker,
        sectionsWithPdf.has(item.id),
      )
    ) {
      continue;
    }

    let fieldChanges = Number(inheritBookMetadata(parent, item, true));
    const currentTitle = String(item.getField("title"));
    const cleanedTitle = cleanTitles
      ? cleanChapterTitle(currentTitle)
      : currentTitle;
    if (cleanedTitle !== currentTitle) {
      item.setField("title", cleanedTitle);
      fieldChanges++;
    }
    if (fieldChanges > 0) {
      try {
        await item.saveTx();
        result.repairedItems++;
        result.repairedFields += fieldChanges;
      } catch (error) {
        ztoolkit.log("Failed to fill existing section metadata", error);
      }
    }

    const key = sectionKey({
      title: String(item.getField("title")),
      pages: String(item.getField("pages")),
      sourceMarker,
    });
    result.keys.add(key);
    result.sectionsByKey.set(key, item);
  }
  return result;
}

/** Update an existing generated section with accepted chapter metadata. */
export async function updateExistingSection(
  item: Zotero.Item,
  payload: SectionPayload,
): Promise<number> {
  let changes = 0;
  const desiredTitle = payload.metadata?.title || payload.title;
  if (desiredTitle && item.getField("title") !== desiredTitle) {
    item.setField("title", desiredTitle);
    changes++;
  }
  const metadata = payload.metadata
    ? { ...payload.metadata, title: undefined }
    : undefined;
  changes += applySectionMetadata(item, metadata);
  if (changes > 0) await item.saveTx();
  return changes;
}

/** Return reusable keys and fill missing book metadata on generated sections. */
export async function getExistingSectionKeys(
  parent: Zotero.Item,
  sourceKey: string,
): Promise<Set<string>> {
  return (await inspectExistingSections(parent, sourceKey)).keys;
}
