import { getLocaleID, getString } from "../utils/locale";
import { getPref } from "../utils/prefs";
import {
  createOfficialMenuOptions,
  removeLegacyMenuElement,
} from "./chapterizeMenu";
import { inspectPdf } from "./pdf/inspection";
import type { Chapter } from "./pdf/outline";
import { printedRange } from "./pdf/pageLabels";
import type { ChapterAuthorCandidate } from "./pdf/tocAuthors";
import {
  createPdfPageSplitter,
  isEncryptedPdfError,
  type PdfPageSplitter,
} from "./pdf/splitter";
import { activeProgressOptions, completionProgressType } from "./progress";
import {
  makeSplitRunKey,
  releaseSplitRun,
  tryAcquireSplitRun,
} from "./splitRunLock";
import { showSplitPlanDialog } from "./splitPlanDialog";
import {
  canWriteSplitTarget,
  createBookSectionWithPdf,
  inspectExistingSections,
  makeChapterizeMarker,
  resolveSplitTarget,
  sectionKey,
  updateExistingSection,
  type ExistingSectionsResult,
  type SplitTarget,
} from "./zotero/items";

// IOUtils / PathUtils are chrome-WINDOW globals. They are NOT on the plugin
// sandbox's `globalThis`, so `(globalThis as any).IOUtils` is undefined here.
// Fetch them lazily via ztoolkit.getGlobal (same pattern the template uses for
// ZoteroPane). Resolved at call time, by which point ztoolkit is initialised.
function io(): any {
  const maybe = ztoolkit.getGlobal("IOUtils");
  if (!maybe) {
    throw new Error(
      "IOUtils is unavailable. This plugin requires Zotero 7 or later.",
    );
  }
  return maybe;
}
function paths(): any {
  return ztoolkit.getGlobal("PathUtils");
}
/** Register the right-click "Split into Sections" menu item. */
export function registerChapterizeMenu(win?: Window): void {
  const ref = addon.data.config.addonRef;
  const menuManager = (Zotero as any).MenuManager;
  if (typeof menuManager?.registerMenu === "function") {
    if (addon.data.menuID) return;
    const menuID = menuManager.registerMenu(
      createOfficialMenuOptions({
        menuID: `${ref}-split`,
        pluginID: addon.data.config.addonID,
        l10nID: getLocaleID("menuitem-chapterize-context"),
        icon: `chrome://${ref}/content/icons/favicon@0.5x.png`,
        onRun: (items) => {
          void runSplit(items);
        },
      }),
    );
    if (menuID) addon.data.menuID = menuID;
    return;
  }

  // Zotero 7 compatibility: the official MenuManager was added in Zotero 8.
  const popup = win?.document.querySelector("#zotero-itemmenu");
  if (!popup) return;
  ztoolkit.Menu.register(popup as XUL.MenuPopup, {
    tag: "menuitem",
    id: `${ref}-split`,
    label: getString("menuitem-chapterize-label"),
    icon: `chrome://${ref}/content/icons/favicon@0.5x.png`,
    commandListener: () => {
      void runSplit();
    },
  });
}

export function unregisterChapterizeWindowMenu(win: Window): void {
  removeLegacyMenuElement(win.document, `${addon.data.config.addonRef}-split`);
}

export function unregisterChapterizeMenu(): void {
  if (!addon.data.menuID) return;
  const menuManager = (Zotero as any).MenuManager;
  if (typeof menuManager?.unregisterMenu === "function") {
    menuManager.unregisterMenu(addon.data.menuID);
  }
  addon.data.menuID = undefined;
}

/** Main flow: book -> bookmarks/manual ranges -> bookSection items + PDFs. */
async function runSplit(contextItems?: Zotero.Item[]): Promise<void> {
  // Top-level guard: any unexpected throw in the async flow is logged and
  // surfaced to the user instead of vanishing as an unhandled rejection.
  try {
    await runSplitInner(contextItems);
  } catch (e) {
    ztoolkit.log("Chapterize runSplit failed", e);
    notify(
      getString("error-generic", { args: { message: String(e) } }),
      "fail",
    );
  }
}

async function runSplitInner(contextItems?: Zotero.Item[]): Promise<void> {
  const selected: Zotero.Item[] =
    contextItems ??
    (ztoolkit.getGlobal("ZoteroPane") as any).getSelectedItems();

  const target = await resolveSplitTarget(selected);
  if (!target) {
    notify(getString("error-not-book"), "fail");
    return;
  }
  const { bookItem, pdfAttachment, pdfPath } = target;
  if (!pdfAttachment || !pdfPath) {
    notify(getString("error-no-pdf"), "fail");
    return;
  }
  if (!canWriteSplitTarget(bookItem)) {
    notify(getString("error-read-only"), "fail");
    return;
  }

  const runKey = makeSplitRunKey(bookItem.libraryID, bookItem.id);
  if (!tryAcquireSplitRun(runKey)) {
    notify(getString("error-already-running"), "fail");
    return;
  }

  try {
    await runSplitTarget({ bookItem, pdfAttachment, pdfPath });
  } finally {
    releaseSplitRun(runKey);
  }
}

async function runSplitTarget(target: SplitTarget): Promise<void> {
  const { bookItem, pdfAttachment, pdfPath } = target;
  if (!pdfAttachment || !pdfPath) return;

  const progress = new ztoolkit.ProgressWindow(
    addon.data.config.addonName,
    activeProgressOptions(),
  )
    .createLine({
      text: getString("progress-reading"),
      type: "default",
      progress: 0,
    })
    .show();

  let bytes: Uint8Array;
  let detectedChapters: Chapter[] = [];
  let totalPages = 0;
  let pdfFingerprint = "";
  let pageLabels: string[] = [];
  let authorCandidates: Array<ChapterAuthorCandidate | null> = [];
  let sourceKey = "";
  let existingKeys = new Set<string>();
  let existingSections: ExistingSectionsResult = {
    keys: existingKeys,
    sectionsByKey: new Map(),
    repairedItems: 0,
    repairedFields: 0,
  };
  let splitPages: PdfPageSplitter;
  try {
    const raw: any = await io().read(pdfPath);
    // IOUtils runs in the chrome realm, so `raw` is a Uint8Array built with a
    // DIFFERENT constructor than this sandbox's. That makes `instanceof
    // Uint8Array` (ours and pdf-lib's internal check) fail with a misleading
    // "type NaN". Re-wrap the bytes into this realm's Uint8Array.
    if (raw instanceof Uint8Array) {
      bytes = raw;
    } else if (raw && typeof raw.byteLength === "number" && raw.buffer) {
      bytes = new Uint8Array(raw.buffer, raw.byteOffset || 0, raw.byteLength);
    } else if (raw instanceof ArrayBuffer) {
      bytes = new Uint8Array(raw);
    } else {
      throw new Error(
        `Reading the PDF returned ${
          raw === null ? "null" : typeof raw
        }, expected bytes (path: ${pdfPath}).`,
      );
    }
    const [inspection, pageSplitter] = await Promise.all([
      inspectPdf(bytes, { minLevel: 1, maxLevel: 2 }),
      createPdfPageSplitter(bytes),
    ]);
    detectedChapters = inspection.chapters;
    totalPages = inspection.totalPages;
    pdfFingerprint = inspection.fingerprint;
    pageLabels = inspection.pageLabels;
    authorCandidates = inspection.authorCandidates;
    splitPages = pageSplitter;
    sourceKey = `${pdfAttachment.key}:${pdfFingerprint}`;
    existingSections = await inspectExistingSections(
      bookItem,
      sourceKey,
      getPref("cleanChapterNumbers") !== false,
    );
    existingKeys = existingSections.keys;
  } catch (e) {
    progress.changeLine({
      text: isEncryptedPdfError(e)
        ? getString("error-encrypted-pdf")
        : getString("error-generic", { args: { message: String(e) } }),
      type: "fail",
      progress: 100,
    });
    progress.startCloseTimer(6000);
    return;
  }

  progress.win.close();
  if (existingSections.repairedItems > 0) {
    notify(
      getString("progress-metadata-repaired", {
        args: {
          items: existingSections.repairedItems,
          fields: existingSections.repairedFields,
        },
      }),
      "success",
    );
  }
  const chapters = await showSplitPlanDialog({
    detectedChapters,
    totalPages,
    pageLabels,
    bookTitle: String(bookItem.getField("title")),
    isbn: String(bookItem.getField("ISBN")),
    authorCandidates,
    isExistingRange: (startPage, endPage) =>
      existingKeys.has(
        sectionKey({
          sourceMarker: makeChapterizeMarker(sourceKey, startPage, endPage),
          title: "",
        }),
      ),
  });
  if (!chapters) {
    return;
  }

  const splitProgress = new ztoolkit.ProgressWindow(
    addon.data.config.addonName,
    activeProgressOptions(),
  )
    .createLine({
      text: getString("progress-splitting"),
      type: "default",
      progress: 5,
    })
    .show();

  let created = 0;
  let skipped = 0;
  let failed = 0;
  let updated = 0;
  let updatedFields = 0;
  for (let i = 0; i < chapters.length; i++) {
    const ch = chapters[i];
    const payload = {
      title: ch.title,
      pages: printedRange(pageLabels, ch.startPage, ch.endPage),
      sourceMarker: makeChapterizeMarker(sourceKey, ch.startPage, ch.endPage),
      metadata: ch.metadata,
    };
    const key = sectionKey(payload);
    if (existingKeys.has(key)) {
      const existingItem = existingSections.sectionsByKey.get(key);
      if (existingItem) {
        try {
          const changes = await updateExistingSection(existingItem, payload);
          if (changes > 0) {
            updated++;
            updatedFields += changes;
          }
        } catch (e) {
          ztoolkit.log(`Failed to update section "${ch.title}"`, e);
          failed++;
        }
      }
      skipped++;
      splitProgress.changeLine({
        text: `[${i + 1}/${chapters.length}] ${ch.title}`,
        progress: 5 + Math.round(((i + 1) / chapters.length) * 95),
      });
      continue;
    }

    let tmpPath: string | null = null;
    try {
      // Split on PHYSICAL pages (0-based, inclusive). ch.startPage/endPage
      // are physical — bookmark dests resolve to physical pages.
      const partBytes = await splitPages(ch.startPage, ch.endPage);
      const outputPath = paths().join(
        (Zotero as any).getTempDirectory().path,
        `chapterize-${bookItem.id}-${i}-${Date.now()}.pdf`,
      );
      tmpPath = outputPath;
      await io().write(outputPath, partBytes);

      await createBookSectionWithPdf(bookItem, payload, outputPath);
      existingKeys.add(key);
      created++;
    } catch (e) {
      ztoolkit.log(`Failed to create section "${ch.title}"`, e);
      failed++;
    } finally {
      if (tmpPath) {
        try {
          await io().remove(tmpPath);
        } catch {
          /* best-effort cleanup */
        }
      }
    }

    splitProgress.changeLine({
      text: `[${i + 1}/${chapters.length}] ${ch.title}`,
      progress: 5 + Math.round(((i + 1) / chapters.length) * 95),
    });
  }

  splitProgress.changeLine({
    text: getString("progress-done", {
      args: { created, updated, fields: updatedFields, skipped, failed },
    }),
    type: completionProgressType(failed),
    progress: 100,
  });
  splitProgress.startCloseTimer(6000);
}

function notify(
  text: string,
  type: "success" | "fail" | "default" = "default",
): void {
  new ztoolkit.ProgressWindow(addon.data.config.addonName, {
    closeOnClick: true,
    closeTime: 5000,
  })
    .createLine({ text, type, progress: 100 })
    .show();
}
