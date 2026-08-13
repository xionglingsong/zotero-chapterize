import { getPref, setPref } from "../utils/prefs";
import {
  fetchSectionByDoi,
  normalizeDoiInput,
  searchBookSections,
  searchSectionByTitle,
  type CrossRefMatch,
  type CrossRefSectionMeta,
  type ZoteroCreator,
} from "./crossref";
import type { Chapter } from "./pdf/outline";
import type { ChapterAuthorCandidate } from "./pdf/tocAuthors";
import {
  normalizeSplitPlan,
  summarizeSplitPlan,
  validateSplitPlan,
  type SplitPlanIssue,
} from "./pdf/ranges";
import { printedRange } from "./pdf/pageLabels";
import {
  cleanChapterTitle,
  recommendedRangeEndPages,
  recommendedSplitSelection,
} from "./splitPlanSelection";
import {
  normalizeSplitPlanLanguage,
  normalizeTitleColumnWidth,
  splitPlanText,
  type SplitPlanLanguage,
} from "./splitPlanLocale";
import {
  authorStatusPresentation,
  confirmedCreatorMetadata,
  metadataStatusPresentation,
  sectionStatusPresentation,
  shouldDiscardTitleMatch,
  shouldReplaceCreatorDraft,
  type AuthorSource,
} from "./splitPlanPresentation";

interface EditableRow extends Chapter {
  id: number;
  enabled: boolean;
  detectedEndPage: number;
  originalTitle: string;
  metadataMatch?: CrossRefMatch | null;
  metadataLoading?: boolean;
  metadataExpanded?: boolean;
  metadataSource?: "title" | "doi";
  acceptedFields: Set<MetadataField>;
  manualDoi: string;
  doiLoading?: boolean;
  doiMessageKey?: string;
  doiError?: boolean;
  creatorDraft: ZoteroCreator[];
  creatorSource?: AuthorSource;
  creatorSourcePage?: number;
  creatorRawText?: string;
  creatorsConfirmed: boolean;
}

type MetadataField = keyof CrossRefSectionMeta;

export interface ChapterPlan extends Chapter {
  metadata?: Partial<CrossRefSectionMeta>;
}

export interface SplitPlanDialogInput {
  detectedChapters: Chapter[];
  totalPages: number;
  pageLabels: string[];
  isExistingRange(startPage: number, endPage: number): boolean;
  bookTitle?: string;
  isbn?: string;
  authorCandidates?: Array<ChapterAuthorCandidate | null>;
}

const ids = {
  rows: "chapterize-plan-rows",
  summary: "chapterize-plan-summary",
  errors: "chapterize-plan-errors",
  add: "chapterize-plan-add",
  reset: "chapterize-plan-reset",
  recommended: "chapterize-plan-recommended",
  selectAll: "chapterize-plan-select-all",
  selectNone: "chapterize-plan-select-none",
  invert: "chapterize-plan-invert",
  cleanTitles: "chapterize-plan-clean-titles",
  restoreTitles: "chapterize-plan-restore-titles",
  matchAll: "chapterize-plan-match-all",
  heading: "chapterize-plan-heading",
  source: "chapterize-plan-source",
  guidance: "chapterize-plan-guidance",
  language: "chapterize-plan-language",
  titleWidth: "chapterize-plan-title-width",
  titleWidthValue: "chapterize-plan-title-width-value",
};

/** Show the complete split-plan editor and return only a validated plan. */
export async function showSplitPlanDialog(
  input: SplitPlanDialogInput,
): Promise<ChapterPlan[] | null> {
  let nextID = 1;
  let cleanTitles = getPref("cleanChapterNumbers") !== false;
  let language: SplitPlanLanguage = normalizeSplitPlanLanguage(
    getPref("interfaceLanguage"),
  );
  let titleColumnWidth = normalizeTitleColumnWidth(getPref("titleColumnWidth"));
  const getString = (
    key: string,
    options: { args?: Record<string, unknown> } = {},
  ) => splitPlanText(language, key, options.args);
  const fromDetected = () => {
    const recommended = recommendedSplitSelection(input.detectedChapters);
    const recommendedEnds = recommendedRangeEndPages(
      input.detectedChapters,
      recommended,
      input.totalPages,
    );
    return input.detectedChapters.map((chapter, index) => {
      const authorCandidate = input.authorCandidates?.[index];
      return {
        ...chapter,
        title: cleanTitles ? cleanChapterTitle(chapter.title) : chapter.title,
        endPage: recommendedEnds[index] ?? chapter.endPage,
        id: nextID++,
        enabled: recommended[index] ?? true,
        detectedEndPage: chapter.endPage,
        originalTitle: chapter.title,
        acceptedFields: new Set<MetadataField>(),
        manualDoi: "",
        creatorDraft: authorCandidate?.creators.map((creator) => ({
          ...creator,
        })) ?? [{ creatorType: "author" as const }],
        creatorSource: authorCandidate ? ("toc" as const) : undefined,
        creatorSourcePage: authorCandidate?.pageIndex,
        creatorRawText: authorCandidate?.rawText,
        creatorsConfirmed: false,
      };
    });
  };
  let rows: EditableRow[] = fromDetected();
  let result: ChapterPlan[] | null = null;

  const dialog = new ztoolkit.Dialog(1, 1);
  let autoMatchStarted = false;
  const data: Record<string, any> = {
    loadCallback: () => {
      const doc = dialog.window.document;
      render(doc);
      if (!autoMatchStarted) {
        autoMatchStarted = true;
        void matchAll(doc);
      }
    },
  };

  function selectedRows(): EditableRow[] {
    return rows.filter((row) => row.enabled);
  }

  function toChapter(row: EditableRow): Chapter {
    return {
      title: row.title,
      level: row.level,
      startPage: row.startPage,
      endPage: row.endPage,
    };
  }

  const metadataFields: MetadataField[] = [
    "title",
    "creators",
    "doi",
    "url",
    "libraryCatalog",
    "bookTitle",
    "pages",
    "date",
    "publisher",
    "isbn",
    "language",
  ];
  const defaultAcceptedFields = new Set<MetadataField>([
    "title",
    "creators",
    "doi",
    "url",
    "libraryCatalog",
    "pages",
    "date",
  ]);

  function metadataValue(
    metadata: CrossRefSectionMeta,
    field: MetadataField,
  ): string {
    if (field === "creators") {
      return metadata.creators
        .map((creator) =>
          [creator.lastName, creator.firstName].filter(Boolean).join(", "),
        )
        .join("; ");
    }
    return String(metadata[field] ?? "");
  }

  function acceptedMetadata(
    row: EditableRow,
  ): Partial<CrossRefSectionMeta> | undefined {
    const metadata = row.metadataMatch?.metadata;
    const accepted: Partial<CrossRefSectionMeta> = {};
    if (metadata) {
      for (const field of row.acceptedFields) {
        (accepted as any)[field] = metadata[field];
      }
    }
    const creators = confirmedCreatorMetadata(
      row.creatorDraft,
      row.creatorsConfirmed,
    );
    if (creators) accepted.creators = creators;
    return Object.keys(accepted).length > 0 ? accepted : undefined;
  }

  function replaceCreatorDraft(
    row: EditableRow,
    creators: ZoteroCreator[],
    source: AuthorSource,
    confirmed: boolean,
  ): void {
    row.creatorDraft = creators.length
      ? creators.map((creator) => ({ ...creator }))
      : [{ creatorType: "author" }];
    row.creatorSource = source;
    row.creatorSourcePage = undefined;
    row.creatorRawText = undefined;
    row.creatorsConfirmed = confirmed;
    row.acceptedFields.delete("creators");
  }

  function changeRowTitle(row: EditableRow, nextTitle: string): void {
    if (shouldDiscardTitleMatch(row.metadataSource, row.title, nextTitle)) {
      if (row.creatorSource === "crossref") {
        replaceCreatorDraft(row, [], "manual", false);
        row.creatorSource = undefined;
      }
      row.metadataMatch = undefined;
      row.metadataSource = undefined;
      row.metadataExpanded = false;
      row.acceptedFields.clear();
      row.manualDoi = "";
    } else if (row.metadataSource === "doi" && row.title !== nextTitle) {
      row.acceptedFields.delete("title");
    }
    row.title = nextTitle;
  }

  function applyMatch(
    row: EditableRow,
    match: CrossRefMatch | null,
    expand = false,
    acceptAll = false,
    source: "title" | "doi" = "title",
  ): void {
    row.metadataMatch = match;
    row.metadataSource = match ? source : undefined;
    row.metadataExpanded = !!match && expand;
    row.acceptedFields = new Set(
      match
        ? metadataFields.filter(
            (field) =>
              field !== "creators" &&
              (acceptAll || defaultAcceptedFields.has(field)) &&
              metadataValue(match.metadata, field) !== "",
          )
        : [],
    );
    if (
      match?.metadata.creators.length &&
      shouldReplaceCreatorDraft(
        row.creatorSource,
        !!confirmedCreatorMetadata(row.creatorDraft, true),
      )
    ) {
      replaceCreatorDraft(
        row,
        match.metadata.creators,
        source === "doi" ? "doi" : "crossref",
        true,
      );
    }
    if (match?.metadata.doi) row.manualDoi = match.metadata.doi;
  }

  async function matchRow(row: EditableRow, doc: Document): Promise<void> {
    row.metadataLoading = true;
    render(doc);
    const match = await searchSectionByTitle(row.title, {
      bookTitle: input.bookTitle,
      isbn: input.isbn,
    });
    row.metadataLoading = false;
    applyMatch(row, match);
    render(doc);
  }

  async function lookupDoi(row: EditableRow, doc: Document): Promise<void> {
    const doi = normalizeDoiInput(row.manualDoi);
    if (!doi) {
      row.doiError = true;
      row.doiMessageKey = "dialog-doi-required";
      render(doc);
      return;
    }
    row.manualDoi = doi;
    row.doiLoading = true;
    row.doiError = false;
    row.doiMessageKey = undefined;
    render(doc);
    const metadata = await fetchSectionByDoi(doi);
    row.doiLoading = false;
    if (!metadata) {
      row.doiError = true;
      row.doiMessageKey = "dialog-doi-invalid";
      render(doc);
      return;
    }
    applyMatch(
      row,
      {
        metadata,
        confidence: 1,
        confidenceLevel: "high",
        titleSimilarity: 1,
        bookSimilarity: 1,
      },
      true,
      true,
      "doi",
    );
    row.doiError = false;
    row.doiMessageKey = "dialog-doi-success";
    render(doc);
  }

  async function matchAll(doc: Document): Promise<void> {
    const pending = selectedRows().filter((row) => !row.metadataLoading);
    pending.forEach((row) => (row.metadataLoading = true));
    render(doc);
    const matches = await searchBookSections(
      pending.map((row) => row.title),
      { bookTitle: input.bookTitle, isbn: input.isbn },
    );
    pending.forEach((row, index) => {
      row.metadataLoading = false;
      applyMatch(row, matches[index] ?? null);
    });
    render(doc);
  }

  function setSelection(
    doc: Document,
    selection: (row: EditableRow, index: number) => boolean,
    rangeMode: "detected" | "recommended" = "detected",
  ): void {
    rows.forEach((row, index) => {
      row.enabled = selection(row, index);
      row.endPage = row.detectedEndPage;
    });
    if (rangeMode === "recommended") {
      const recommendedEnds = recommendedRangeEndPages(
        rows,
        rows.map((row) => row.enabled),
        input.totalPages,
      );
      rows.forEach((row, index) => {
        row.endPage = recommendedEnds[index] ?? row.endPage;
      });
    }
    render(doc);
  }

  function issueText(issue: SplitPlanIssue, selected: EditableRow[]): string {
    const row = selected[issue.index];
    const rowNumber =
      rows.findIndex((candidate) => candidate.id === row.id) + 1;
    switch (issue.code) {
      case "empty-title":
        return getString("dialog-error-empty-title", {
          args: { row: rowNumber },
        });
      case "invalid-range":
        return getString("dialog-error-invalid-range", {
          args: { row: rowNumber },
        });
      case "out-of-bounds":
        return getString("dialog-error-out-of-bounds", {
          args: { row: rowNumber, pages: input.totalPages },
        });
      case "overlap": {
        const other = selected[issue.relatedIndex ?? issue.index];
        const otherNumber =
          rows.findIndex((candidate) => candidate.id === other.id) + 1;
        return getString("dialog-error-overlap", {
          args: { row: rowNumber, other: otherNumber },
        });
      }
    }
  }

  function refreshStatus(doc: Document): SplitPlanIssue[] {
    const selected = selectedRows();
    const chapters = selected.map(toChapter);
    const issues = validateSplitPlan(chapters, input.totalPages);
    const summary = summarizeSplitPlan(chapters, input.totalPages);
    const existing = selected.filter((row) =>
      input.isExistingRange(row.startPage, row.endPage),
    ).length;
    const authorPending = selected.filter(
      (row) =>
        !!confirmedCreatorMetadata(row.creatorDraft, true) &&
        !row.creatorsConfirmed,
    ).length;
    const summaryNode = doc.getElementById(ids.summary);
    const errorNode = doc.getElementById(ids.errors) as HTMLElement | null;
    if (summaryNode) {
      summaryNode.textContent = getString("dialog-summary", {
        args: {
          sections: summary.sectionCount,
          pending: summary.sectionCount - existing,
          existing,
          covered: summary.coveredPages,
          omitted: summary.omittedPages,
          authorPending,
        },
      });
    }
    doc.querySelectorAll("tr[data-row-id]").forEach((node: Element) => {
      node.classList.remove("chapterize-row-error");
    });
    for (const issue of issues) {
      const row = selected[issue.index];
      doc
        .querySelector(`tr[data-row-id="${row.id}"]`)
        ?.classList.add("chapterize-row-error");
    }
    if (errorNode) {
      const messages = issues.map((issue) => issueText(issue, selected));
      if (selected.length === 0)
        messages.unshift(getString("dialog-error-empty"));
      errorNode.textContent = messages.join(" ");
      errorNode.hidden = messages.length === 0;
    }
    return selected.length === 0
      ? [{ code: "invalid-range", index: 0 }]
      : issues;
  }

  function makeCell(doc: Document, text: string): HTMLTableCellElement {
    const cell = doc.createElement("td");
    cell.textContent = text;
    return cell;
  }

  function updateSectionStatus(
    status: HTMLTableCellElement,
    existing: boolean,
  ): void {
    const presentation = sectionStatusPresentation(existing);
    status.textContent = getString(presentation.labelKey);
    status.title = getString(presentation.helpKey);
    status.setAttribute(
      "aria-label",
      `${getString(presentation.labelKey)}. ${getString(presentation.helpKey)}`,
    );
    status.className = `chapterize-status chapterize-status-${presentation.tone}`;
  }

  function authorSourceText(row: EditableRow): string {
    switch (row.creatorSource) {
      case "toc":
        return getString("dialog-author-source-toc", {
          args: {
            page:
              row.creatorSourcePage === undefined
                ? "-"
                : (input.pageLabels[row.creatorSourcePage] ??
                  row.creatorSourcePage + 1),
          },
        });
      case "crossref":
        return getString("dialog-author-source-crossref");
      case "doi":
        return getString("dialog-author-source-doi");
      case "manual":
        return getString("dialog-author-source-manual");
      default:
        return getString("dialog-author-source-empty");
    }
  }

  function markCreatorsEdited(row: EditableRow): void {
    row.creatorSource = "manual";
    row.creatorSourcePage = undefined;
    row.creatorRawText = undefined;
    row.creatorsConfirmed = false;
    row.acceptedFields.delete("creators");
  }

  function appendAuthorEditor(
    doc: Document,
    row: EditableRow,
    container: HTMLElement,
  ): void {
    const editor = doc.createElement("section");
    editor.className = "chapterize-author-editor";
    const header = doc.createElement("div");
    header.className = "chapterize-author-header";
    const heading = doc.createElement("strong");
    heading.textContent = getString("dialog-author-heading");
    const source = doc.createElement("span");
    source.className = `chapterize-author-source chapterize-author-source-${row.creatorSource ?? "empty"}`;
    source.textContent = authorSourceText(row);
    header.append(heading, source);
    editor.append(header);
    if (row.creatorRawText) {
      const raw = doc.createElement("p");
      raw.className = "chapterize-author-raw";
      raw.textContent = getString("dialog-author-toc-raw", {
        args: { text: row.creatorRawText },
      });
      editor.append(raw);
    }

    const list = doc.createElement("div");
    list.className = "chapterize-author-list";
    row.creatorDraft.forEach((creator, creatorIndex) => {
      const creatorRow = doc.createElement("div");
      creatorRow.className = "chapterize-author-row";
      const firstLabel = doc.createElement("label");
      const firstName = doc.createElement("span");
      firstName.textContent = getString("dialog-author-first-name");
      const firstInput = doc.createElement("input");
      firstInput.type = "text";
      firstInput.name = `chapterize-author-${row.id}-${creatorIndex}-first`;
      firstInput.autocomplete = "given-name";
      firstInput.value = creator.firstName ?? "";
      firstInput.addEventListener("input", () => {
        creator.firstName = firstInput.value;
        markCreatorsEdited(row);
        source.className =
          "chapterize-author-source chapterize-author-source-manual";
        source.textContent = authorSourceText(row);
        confirm.disabled = !confirmedCreatorMetadata(row.creatorDraft, true);
      });
      firstLabel.append(firstName, firstInput);

      const lastLabel = doc.createElement("label");
      const lastName = doc.createElement("span");
      lastName.textContent = getString("dialog-author-last-name");
      const lastInput = doc.createElement("input");
      lastInput.type = "text";
      lastInput.name = `chapterize-author-${row.id}-${creatorIndex}-last`;
      lastInput.autocomplete = "family-name";
      lastInput.value = creator.lastName ?? "";
      lastInput.addEventListener("input", () => {
        creator.lastName = lastInput.value;
        markCreatorsEdited(row);
        source.className =
          "chapterize-author-source chapterize-author-source-manual";
        source.textContent = authorSourceText(row);
        confirm.disabled = !confirmedCreatorMetadata(row.creatorDraft, true);
      });
      lastLabel.append(lastName, lastInput);

      const remove = doc.createElement("button");
      remove.type = "button";
      remove.className = "chapterize-author-remove";
      remove.textContent = "−";
      remove.title = getString("dialog-author-remove");
      remove.setAttribute("aria-label", getString("dialog-author-remove"));
      remove.addEventListener("click", () => {
        if (row.creatorDraft.length === 1) {
          row.creatorDraft = [{ creatorType: "author" }];
        } else {
          row.creatorDraft.splice(creatorIndex, 1);
        }
        markCreatorsEdited(row);
        render(doc);
      });
      creatorRow.append(firstLabel, lastLabel, remove);
      list.append(creatorRow);
    });
    editor.append(list);

    const actions = doc.createElement("div");
    actions.className = "chapterize-author-actions";
    const add = doc.createElement("button");
    add.type = "button";
    add.textContent = getString("dialog-author-add-another");
    add.addEventListener("click", () => {
      row.creatorDraft.push({ creatorType: "author" });
      markCreatorsEdited(row);
      render(doc);
    });
    const confirm = doc.createElement("button");
    confirm.type = "button";
    confirm.className = "chapterize-author-confirm";
    confirm.textContent = row.creatorsConfirmed
      ? getString("dialog-author-confirmed")
      : getString("dialog-author-confirm");
    confirm.disabled =
      !confirmedCreatorMetadata(row.creatorDraft, true) ||
      row.creatorsConfirmed;
    confirm.addEventListener("click", () => {
      const creators = confirmedCreatorMetadata(row.creatorDraft, true);
      if (!creators) return;
      row.creatorDraft = creators;
      row.creatorsConfirmed = true;
      render(doc);
    });
    const clear = doc.createElement("button");
    clear.type = "button";
    clear.textContent = getString("dialog-author-clear");
    clear.addEventListener("click", () => {
      replaceCreatorDraft(row, [], "manual", false);
      render(doc);
    });
    actions.append(add, clear, confirm);
    editor.append(actions);
    container.append(editor);
  }

  function displayedPrintedRange(row: EditableRow): string {
    if (
      !Number.isInteger(row.startPage) ||
      !Number.isInteger(row.endPage) ||
      row.startPage < 0 ||
      row.startPage > row.endPage ||
      row.endPage >= input.totalPages
    ) {
      return "-";
    }
    return printedRange(input.pageLabels, row.startPage, row.endPage);
  }

  function refreshStaticText(doc: Document): void {
    const labels: Record<string, string> = {
      [ids.heading]: "dialog-heading",
      [ids.recommended]: "dialog-select-recommended",
      [ids.selectAll]: "dialog-select-all",
      [ids.selectNone]: "dialog-select-none",
      [ids.invert]: "dialog-select-invert",
      [ids.cleanTitles]: "dialog-clean-chapter-numbers",
      [ids.restoreTitles]: "dialog-restore-original-titles",
      [ids.matchAll]: "dialog-metadata-match-all",
      [ids.add]: "dialog-add",
      [ids.reset]: "dialog-reset",
      [ids.guidance]: "dialog-guidance",
      split: "dialog-split",
      cancel: "dialog-cancel",
    };
    for (const [id, key] of Object.entries(labels)) {
      const node = doc.getElementById(id);
      if (node) node.textContent = getString(key);
    }
    const source = doc.getElementById(ids.source);
    if (source) {
      source.textContent = getString(
        input.detectedChapters.length > 0
          ? "dialog-source-bookmarks"
          : "dialog-source-manual",
        { args: { pages: input.totalPages } },
      );
    }
    const languageSelect = doc.getElementById(
      ids.language,
    ) as HTMLSelectElement | null;
    if (languageSelect) {
      languageSelect.value = language;
      Array.from(languageSelect.options).forEach((node) => {
        const option = node as HTMLOptionElement;
        option.selected = option.value === language;
      });
    }
    const titleWidth = doc.getElementById(
      ids.titleWidth,
    ) as HTMLInputElement | null;
    if (titleWidth) titleWidth.value = String(titleColumnWidth);
    const titleWidthValue = doc.getElementById(ids.titleWidthValue);
    if (titleWidthValue) titleWidthValue.textContent = `${titleColumnWidth}px`;
    const root = doc.querySelector(".chapterize-dialog") as HTMLElement | null;
    root?.style.setProperty(
      "--chapterize-title-width",
      `${titleColumnWidth}px`,
    );
    const cleanButton = doc.getElementById(ids.cleanTitles);
    cleanButton?.setAttribute("aria-pressed", String(cleanTitles));
    cleanButton?.classList.toggle("chapterize-button-active", cleanTitles);
    doc.querySelectorAll("[data-i18n-key]").forEach((node: Element) => {
      const element = node as HTMLElement;
      element.textContent = getString(element.dataset.i18nKey ?? "");
    });
    doc.querySelectorAll("[data-i18n-aria-label]").forEach((node: Element) => {
      const element = node as HTMLElement;
      element.setAttribute(
        "aria-label",
        getString(element.dataset.i18nAriaLabel ?? ""),
      );
    });
    const title = getString("dialog-title");
    doc.title = title;
    doc.documentElement?.setAttribute("title", title);
  }

  function render(doc: Document): void {
    const body = doc.getElementById(ids.rows) as HTMLTableSectionElement | null;
    if (!body) return;
    refreshStaticText(doc);
    body.replaceChildren();

    rows.forEach((row, index) => {
      const tr = doc.createElement("tr");
      tr.dataset.rowId = String(row.id);
      tr.classList.toggle("chapterize-row-included", row.enabled);

      const enabledCell = doc.createElement("td");
      const checkbox = doc.createElement("input");
      checkbox.type = "checkbox";
      checkbox.checked = row.enabled;
      checkbox.setAttribute("aria-label", getString("dialog-col-include"));
      checkbox.addEventListener("change", () => {
        row.enabled = checkbox.checked;
        tr.classList.toggle("chapterize-row-disabled", !row.enabled);
        tr.classList.toggle("chapterize-row-included", row.enabled);
        refreshStatus(doc);
      });
      enabledCell.append(checkbox);
      tr.append(enabledCell, makeCell(doc, String(index + 1)));

      const titleCell = doc.createElement("td");
      titleCell.className = "chapterize-title-cell";
      titleCell.style.paddingInlineStart = `${
        8 + Math.max(0, row.level - 1) * 18
      }px`;
      const title = doc.createElement("input");
      title.type = "text";
      title.setAttribute("aria-label", getString("dialog-col-title"));
      title.value = row.title;
      title.title = row.title;
      title.addEventListener("input", () => {
        changeRowTitle(row, title.value);
        title.title = title.value;
        refreshStatus(doc);
      });
      titleCell.append(title);
      tr.append(titleCell);

      const doiCell = doc.createElement("td");
      doiCell.className = "chapterize-doi-cell";
      const doiControls = doc.createElement("div");
      doiControls.className = "chapterize-doi-controls";
      const doiInput = doc.createElement("input");
      doiInput.type = "text";
      doiInput.id = `chapterize-doi-${row.id}`;
      doiInput.value = row.manualDoi;
      doiInput.placeholder = getString("dialog-doi-placeholder");
      doiInput.setAttribute("aria-label", getString("dialog-col-doi"));
      doiInput.setAttribute("aria-invalid", String(!!row.doiError));
      doiInput.setAttribute(
        "aria-describedby",
        `chapterize-doi-message-${row.id}`,
      );
      doiInput.classList.toggle("chapterize-input-error", !!row.doiError);
      const doiMessage = row.doiMessageKey ? getString(row.doiMessageKey) : "";
      doiInput.title = doiMessage || getString("dialog-doi-lookup-title");
      const message = doc.createElement("div");
      message.id = `chapterize-doi-message-${row.id}`;
      message.className = row.doiError
        ? "chapterize-doi-message chapterize-doi-message-error"
        : "chapterize-doi-message";
      message.setAttribute("role", row.doiError ? "alert" : "status");
      message.setAttribute("aria-live", row.doiError ? "assertive" : "polite");
      message.textContent = doiMessage;
      doiInput.addEventListener("input", () => {
        row.manualDoi = doiInput.value;
        row.doiError = false;
        row.doiMessageKey = undefined;
        doiInput.classList.remove("chapterize-input-error");
        doiInput.setAttribute("aria-invalid", "false");
        doiInput.title = getString("dialog-doi-lookup-title");
        message.className = "chapterize-doi-message";
        message.setAttribute("role", "status");
        message.setAttribute("aria-live", "polite");
        message.textContent = "";
      });
      doiInput.addEventListener("keydown", (event: KeyboardEvent) => {
        if (event.key === "Enter") {
          event.preventDefault();
          void lookupDoi(row, doc);
        }
      });
      const doiLookup = doc.createElement("button");
      doiLookup.type = "button";
      doiLookup.className = "chapterize-doi-lookup";
      doiLookup.disabled = !!row.doiLoading;
      doiLookup.textContent = row.doiLoading
        ? "…"
        : getString("dialog-doi-lookup");
      doiLookup.title = getString("dialog-doi-lookup-title");
      doiLookup.addEventListener("click", () => void lookupDoi(row, doc));
      doiControls.append(doiInput, doiLookup);
      doiCell.append(doiControls, message);
      tr.append(doiCell);

      const metadataCell = doc.createElement("td");
      metadataCell.className = "chapterize-metadata-cell";
      const metadataControls = doc.createElement("div");
      metadataControls.className = "chapterize-metadata-controls";
      const matchButton = doc.createElement("button");
      matchButton.type = "button";
      const metadataState = row.metadataLoading
        ? "loading"
        : row.metadataMatch
          ? "matched"
          : row.metadataMatch === null
            ? "needs-doi"
            : "idle";
      const metadataPresentation = metadataStatusPresentation(metadataState);
      matchButton.className = `chapterize-match chapterize-match-${metadataPresentation.tone}`;
      matchButton.disabled = !!row.metadataLoading;
      matchButton.textContent = getString(metadataPresentation.labelKey, {
        args: {
          confidence: Math.round((row.metadataMatch?.confidence ?? 0) * 100),
        },
      });
      matchButton.title = getString(metadataPresentation.helpKey);
      if (row.metadataMatch) {
        matchButton.setAttribute(
          "aria-expanded",
          String(!!row.metadataExpanded),
        );
        matchButton.setAttribute(
          "aria-controls",
          `chapterize-metadata-details-${row.id}`,
        );
      }
      matchButton.addEventListener("click", () => {
        if (row.metadataMatch) {
          row.metadataExpanded = !row.metadataExpanded;
          render(doc);
        } else {
          void matchRow(row, doc);
        }
      });
      const hasCreators = !!confirmedCreatorMetadata(row.creatorDraft, true);
      const authorPresentation = authorStatusPresentation(
        row.creatorSource,
        row.creatorsConfirmed,
        hasCreators,
      );
      const authorButton = doc.createElement("button");
      authorButton.type = "button";
      authorButton.className = `chapterize-author-button chapterize-match-${authorPresentation.tone}`;
      authorButton.textContent = getString(authorPresentation.labelKey);
      authorButton.title = `${getString(authorPresentation.helpKey)} ${authorSourceText(row)}`;
      authorButton.setAttribute(
        "aria-expanded",
        String(!!row.metadataExpanded),
      );
      authorButton.setAttribute(
        "aria-controls",
        `chapterize-metadata-details-${row.id}`,
      );
      authorButton.addEventListener("click", () => {
        row.metadataExpanded = !row.metadataExpanded;
        render(doc);
      });
      metadataControls.append(matchButton, authorButton);
      metadataCell.append(metadataControls);
      tr.append(metadataCell);

      const printedPages = makeCell(doc, displayedPrintedRange(row));
      printedPages.className = "chapterize-printed-pages";
      printedPages.title = printedPages.textContent ?? "";
      const initialPageCount = row.endPage - row.startPage + 1;
      const pageCount = makeCell(
        doc,
        initialPageCount > 0 ? String(initialPageCount) : "-",
      );
      const status = makeCell(doc, "");
      updateSectionStatus(
        status,
        input.isExistingRange(row.startPage, row.endPage),
      );
      for (const field of ["startPage", "endPage"] as const) {
        const cell = doc.createElement("td");
        const page = doc.createElement("input");
        page.type = "number";
        page.min = "1";
        page.max = String(input.totalPages);
        page.value = String(row[field] + 1);
        page.setAttribute(
          "aria-label",
          getString(
            field === "startPage" ? "dialog-col-start" : "dialog-col-end",
          ),
        );
        page.addEventListener("input", () => {
          row[field] = Number(page.value) - 1;
          const count = row.endPage - row.startPage + 1;
          pageCount.textContent =
            Number.isFinite(count) && count > 0 ? String(count) : "-";
          printedPages.textContent = displayedPrintedRange(row);
          printedPages.title = printedPages.textContent;
          const exists = input.isExistingRange(row.startPage, row.endPage);
          updateSectionStatus(status, exists);
          refreshStatus(doc);
        });
        cell.append(page);
        tr.append(cell);
      }

      tr.append(printedPages, pageCount, status);
      const actions = doc.createElement("td");
      const remove = doc.createElement("button");
      remove.type = "button";
      remove.className = "chapterize-delete";
      remove.textContent = getString("dialog-delete");
      remove.title = getString("dialog-delete-title");
      remove.addEventListener("click", () => {
        rows = rows.filter((candidate) => candidate.id !== row.id);
        render(doc);
      });
      actions.append(remove);
      tr.append(actions);
      tr.classList.toggle("chapterize-row-disabled", !row.enabled);
      body.append(tr);

      if (row.metadataExpanded) {
        const detailsRow = doc.createElement("tr");
        detailsRow.className = "chapterize-metadata-details-row";
        const detailsCell = doc.createElement("td");
        detailsCell.colSpan = 11;
        const details = doc.createElement("div");
        details.id = `chapterize-metadata-details-${row.id}`;
        details.className = "chapterize-metadata-details";
        appendAuthorEditor(doc, row, details);
        if (row.metadataMatch) {
          const heading = doc.createElement("strong");
          heading.textContent = getString("dialog-metadata-review", {
            args: {
              confidence: Math.round(row.metadataMatch.confidence * 100),
            },
          });
          details.append(heading);
          for (const field of metadataFields) {
            if (field === "creators") continue;
            const value = metadataValue(row.metadataMatch.metadata, field);
            if (!value) continue;
            const label = doc.createElement("label");
            label.className = "chapterize-metadata-field";
            const accept = doc.createElement("input");
            accept.type = "checkbox";
            accept.checked = row.acceptedFields.has(field);
            accept.addEventListener("change", () => {
              if (accept.checked) row.acceptedFields.add(field);
              else row.acceptedFields.delete(field);
            });
            const name = doc.createElement("span");
            name.className = "chapterize-metadata-name";
            name.textContent = getString(
              `dialog-metadata-field-${field}` as any,
            );
            const fieldValue = doc.createElement("span");
            fieldValue.className = "chapterize-metadata-value";
            fieldValue.textContent = value;
            fieldValue.title = value;
            label.append(accept, name, fieldValue);
            details.append(label);
          }
        }
        detailsCell.append(details);
        detailsRow.append(detailsCell);
        body.append(detailsRow);
      }
    });
    refreshStatus(doc);
  }

  dialog
    .addCell(0, 0, {
      tag: "main",
      namespace: "html",
      classList: ["chapterize-dialog"],
      children: [
        {
          tag: "style",
          properties: {
            textContent: `
              :root {
                --chapterize-bg: oklch(0.985 0.004 255);
                --chapterize-surface: oklch(1 0 0);
                --chapterize-surface-subtle: oklch(0.965 0.012 255);
                --chapterize-ink: oklch(0.22 0.025 255);
                --chapterize-muted: oklch(0.48 0.025 255);
                --chapterize-border: oklch(0.88 0.018 255);
                --chapterize-border-strong: oklch(0.76 0.045 255);
                --chapterize-blue: oklch(0.53 0.19 255);
                --chapterize-blue-hover: oklch(0.46 0.18 255);
                --chapterize-blue-soft: oklch(0.95 0.035 255);
                --chapterize-blue-ink: oklch(0.38 0.16 255);
                --chapterize-success: oklch(0.43 0.12 155);
                --chapterize-success-soft: oklch(0.96 0.025 155);
                --chapterize-warning: oklch(0.47 0.11 75);
                --chapterize-warning-soft: oklch(0.96 0.035 85);
                --chapterize-danger: oklch(0.48 0.18 25);
                --chapterize-danger-soft: oklch(0.96 0.035 25);
                --chapterize-radius: 6px;
              }
              html, body { box-sizing: border-box; width: 100%; height: 100%; margin: 0; overflow: hidden; overscroll-behavior: contain; background: var(--chapterize-bg); color: var(--chapterize-ink); -moz-osx-font-smoothing: grayscale; }
              *, *::before, *::after { box-sizing: inherit; }
              body > vbox, body > vbox > hbox:first-child, body > vbox > hbox:first-child > vbox { min-height: 0; overflow: hidden; }
              body > vbox > hbox:last-child { flex-shrink: 0; gap: 8px; padding: 10px 20px 12px; border-top: 1px solid var(--chapterize-border); background: var(--chapterize-surface); }
              .chapterize-dialog { display: grid; grid-template-rows: auto auto auto minmax(0, 1fr) auto; gap: 12px; width: 100%; height: 100%; min-height: 0; padding: 18px 20px 10px; overflow: hidden; color: var(--chapterize-ink); font: menu; line-height: 1.4; }
              .chapterize-header { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 8px 20px; }
              .chapterize-header h1 { margin: 0; color: var(--chapterize-blue-ink); font-size: 20px; font-weight: 650; letter-spacing: 0; }
              .chapterize-header-tools { display: flex; flex-wrap: wrap; align-items: center; justify-content: flex-end; gap: 8px 16px; }
              .chapterize-source { color: var(--chapterize-muted); }
              .chapterize-language { display: inline-flex; align-items: center; gap: 6px; color: var(--chapterize-muted); }
              .chapterize-language select { width: 112px; min-height: 34px; padding: 3px 28px 3px 8px; border: 1px solid var(--chapterize-border-strong); border-radius: 4px; background: var(--chapterize-surface); color: var(--chapterize-ink); font: inherit; }
              .chapterize-toolbar { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; padding: 9px 10px; border: 1px solid var(--chapterize-border); border-radius: var(--chapterize-radius); background: var(--chapterize-surface); }
              .chapterize-toolbar button, .chapterize-delete, #split, #cancel { min-height: 34px; margin: 0; border: 1px solid var(--chapterize-border-strong); border-radius: 5px; background: var(--chapterize-surface); color: var(--chapterize-ink); font: inherit; }
              .chapterize-toolbar button { padding: 4px 11px; }
              .chapterize-toolbar button:hover, .chapterize-delete:hover, #cancel:hover { border-color: var(--chapterize-blue); background: var(--chapterize-blue-soft); color: var(--chapterize-blue-ink); }
              .chapterize-toolbar button:active, .chapterize-delete:active, #cancel:active { background: var(--chapterize-surface-subtle); }
              .chapterize-toolbar button:disabled { border-color: var(--chapterize-border); color: var(--chapterize-muted); opacity: .58; }
              .chapterize-toolbar button:focus-visible, .chapterize-delete:focus-visible, .chapterize-doi-lookup:focus-visible, .chapterize-match:focus-visible, .chapterize-author-button:focus-visible, .chapterize-author-editor button:focus-visible, #split:focus-visible, #cancel:focus-visible, input:focus-visible, select:focus-visible { outline: 2px solid var(--chapterize-blue); outline-offset: 2px; }
              #chapterize-plan-recommended { border-color: var(--chapterize-blue); background: var(--chapterize-blue-soft); color: var(--chapterize-blue-ink); font-weight: 600; }
              .chapterize-button-active { border-color: var(--chapterize-blue) !important; background: var(--chapterize-blue-soft) !important; color: var(--chapterize-blue-ink) !important; font-weight: 600; }
              .chapterize-toolbar-separator { width: 1px; height: 26px; margin-inline: 8px; background: var(--chapterize-border); }
              #chapterize-plan-match-all, #chapterize-plan-add { margin-inline-start: 10px; }
              .chapterize-summary { margin-inline-start: auto; color: var(--chapterize-muted); font-variant-numeric: tabular-nums; white-space: nowrap; }
              .chapterize-guidance { padding: 8px 11px; border-inline-start: 3px solid var(--chapterize-blue); background: var(--chapterize-blue-soft); color: var(--chapterize-blue-ink); font-size: .94em; line-height: 1.45; }
              .chapterize-table-wrap { min-height: 0; overflow: auto; overscroll-behavior: contain; border: 1px solid var(--chapterize-border); border-radius: var(--chapterize-radius); background: var(--chapterize-surface); scrollbar-gutter: stable; }
              table { width: 100%; min-width: calc(var(--chapterize-title-width, 520px) + 1050px); border-collapse: separate; border-spacing: 0; table-layout: fixed; }
              th { position: sticky; top: 0; z-index: 3; background: var(--chapterize-surface-subtle); color: var(--chapterize-blue-ink); text-align: start; font-weight: 650; }
              th, td { padding: 7px 8px; border-bottom: 1px solid var(--chapterize-border); }
              tbody tr { background: var(--chapterize-surface); }
              tbody tr:hover { background: var(--chapterize-blue-soft); }
              tbody tr:last-child td { border-bottom: 0; }
              th:nth-child(1), td:nth-child(1) { width: 68px; text-align: center; }
              th:nth-child(2), td:nth-child(2) { width: 42px; color: var(--chapterize-muted); }
              th:nth-child(3), td:nth-child(3) { width: var(--chapterize-title-width, 520px); }
              th:nth-child(4), td:nth-child(4) { width: 290px; }
              th:nth-child(5), td:nth-child(5) { width: 116px; }
              th:nth-child(6), td:nth-child(6), th:nth-child(7), td:nth-child(7) { width: 88px; }
              th:nth-child(8), td:nth-child(8) { width: 112px; }
              th:nth-child(9), td:nth-child(9) { width: 58px; }
              th:nth-child(10), td:nth-child(10) { width: 104px; }
              th:nth-child(11), td:nth-child(11) { width: 82px; }
              th:nth-child(1), tbody tr:not(.chapterize-metadata-details-row) > td:nth-child(1) { position: sticky; left: 0; z-index: 2; background: inherit; }
              th:nth-child(2), tbody tr:not(.chapterize-metadata-details-row) > td:nth-child(2) { position: sticky; left: 68px; z-index: 2; background: inherit; }
              th:nth-child(3), tbody tr:not(.chapterize-metadata-details-row) > td:nth-child(3) { position: sticky; left: 110px; z-index: 2; border-inline-end: 1px solid var(--chapterize-border-strong); background: inherit; box-shadow: 5px 0 8px -8px var(--chapterize-ink); }
              th:nth-child(-n+3) { z-index: 4; background: var(--chapterize-surface-subtle); }
              td input[type="text"], td input[type="number"] { width: 100%; min-height: 30px; border: 1px solid var(--chapterize-border-strong); border-radius: 4px; background: var(--chapterize-surface); color: var(--chapterize-ink); font: inherit; }
              td input[type="checkbox"] { accent-color: var(--chapterize-blue); }
              .chapterize-title-cell { min-width: 0; padding-block: 6px; }
              .chapterize-title-cell input { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
              .chapterize-printed-pages { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-variant-numeric: tabular-nums; }
              .chapterize-status { color: var(--chapterize-muted); font-weight: 600; white-space: nowrap; }
              .chapterize-status::before { display: inline-block; width: 7px; height: 7px; margin-inline-end: 6px; border: 2px solid currentColor; border-radius: 50%; content: ""; vertical-align: 0; }
              .chapterize-status-update { color: var(--chapterize-blue-ink); }
              .chapterize-status-new { color: var(--chapterize-success); }
              .chapterize-row-disabled { color: var(--chapterize-muted); background: var(--chapterize-surface-subtle); }
              .chapterize-row-disabled input { background: var(--chapterize-surface-subtle); }
              .chapterize-row-error, .chapterize-row-error:hover { background: var(--chapterize-danger-soft); }
              .chapterize-row-error input { border-color: var(--chapterize-danger); }
              .chapterize-errors { min-height: 0; padding: 8px 10px; border: 1px solid color-mix(in oklch, var(--chapterize-danger) 35%, white); border-radius: var(--chapterize-radius); background: var(--chapterize-danger-soft); color: var(--chapterize-danger); }
              .chapterize-errors[hidden] { display: none; }
              .chapterize-delete { width: 100%; padding: 3px 8px; color: var(--chapterize-muted); }
              .chapterize-title-width { display: inline-flex; min-height: 34px; align-items: center; gap: 6px; padding: 0 4px; color: var(--chapterize-muted); white-space: nowrap; }
              .chapterize-title-width input { width: 112px; accent-color: var(--chapterize-blue); }
              .chapterize-title-width output { width: 42px; color: var(--chapterize-ink); font-variant-numeric: tabular-nums; }
              .chapterize-match { width: 100%; min-height: 30px; border: 1px solid var(--chapterize-border-strong); border-radius: 4px; background: var(--chapterize-surface); color: var(--chapterize-ink); font: inherit; font-weight: 600; }
              .chapterize-metadata-controls { display: grid; gap: 5px; }
              .chapterize-author-button { width: 100%; min-height: 28px; border: 1px solid var(--chapterize-border-strong); border-radius: 4px; background: var(--chapterize-surface); color: var(--chapterize-ink); font: inherit; font-size: .9em; font-weight: 600; }
              .chapterize-match-progress { color: var(--chapterize-muted); }
              .chapterize-match-warning { border-color: color-mix(in oklch, var(--chapterize-warning) 45%, white); background: var(--chapterize-warning-soft); color: var(--chapterize-warning); }
              .chapterize-match-success { border-color: color-mix(in oklch, var(--chapterize-success) 45%, white); background: var(--chapterize-success-soft); color: var(--chapterize-success); }
              .chapterize-doi-controls { display: grid; grid-template-columns: minmax(0, 1fr) 60px; align-items: center; gap: 10px; }
              .chapterize-doi-controls input { min-width: 0; padding-inline: 8px; }
              .chapterize-doi-lookup { width: 60px; min-height: 30px; padding: 3px 8px; border: 1px solid var(--chapterize-blue); border-radius: 4px; background: var(--chapterize-blue-soft); color: var(--chapterize-blue-ink); font: inherit; white-space: nowrap; }
              .chapterize-input-error { border-color: var(--chapterize-danger) !important; background: var(--chapterize-danger-soft) !important; }
              .chapterize-doi-message { min-height: 1.15em; margin-top: 4px; color: var(--chapterize-blue-ink); font-size: .88em; line-height: 1.2; }
              .chapterize-doi-message-error { color: var(--chapterize-danger); }
              .chapterize-metadata-details-row:hover { background: var(--chapterize-surface); }
              .chapterize-metadata-details { display: grid; grid-template-columns: repeat(auto-fit, minmax(290px, 1fr)); gap: 6px 14px; padding: 10px 12px; border-left: 3px solid var(--chapterize-blue); background: var(--chapterize-surface-subtle); }
              .chapterize-metadata-details > strong { grid-column: 1 / -1; color: var(--chapterize-blue-ink); }
              .chapterize-author-editor { grid-column: 1 / -1; display: grid; gap: 8px; margin-bottom: 8px; padding-bottom: 12px; border-bottom: 1px solid var(--chapterize-border); }
              .chapterize-author-header { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 12px; }
              .chapterize-author-source { padding: 2px 7px; border: 1px solid var(--chapterize-border-strong); border-radius: 999px; background: var(--chapterize-surface); color: var(--chapterize-muted); font-size: .88em; }
              .chapterize-author-source-toc { border-color: color-mix(in oklch, var(--chapterize-warning) 45%, white); background: var(--chapterize-warning-soft); color: var(--chapterize-warning); }
              .chapterize-author-source-crossref, .chapterize-author-source-doi { border-color: color-mix(in oklch, var(--chapterize-success) 45%, white); background: var(--chapterize-success-soft); color: var(--chapterize-success); }
              .chapterize-author-raw { margin: 0; color: var(--chapterize-muted); font-size: .9em; }
              .chapterize-author-list { display: grid; gap: 7px; }
              .chapterize-author-row { display: grid; grid-template-columns: minmax(140px, 1fr) minmax(140px, 1fr) 34px; align-items: end; gap: 10px; }
              .chapterize-author-row label { display: grid; gap: 3px; color: var(--chapterize-muted); font-size: .88em; }
              .chapterize-author-row input { width: 100%; min-height: 32px; border: 1px solid var(--chapterize-border-strong); border-radius: 4px; background: var(--chapterize-surface); color: var(--chapterize-ink); font: inherit; font-size: 1.1em; }
              .chapterize-author-remove { width: 34px; min-height: 32px; border: 1px solid var(--chapterize-border-strong); border-radius: 4px; background: var(--chapterize-surface); color: var(--chapterize-muted); font: inherit; font-size: 18px; }
              .chapterize-author-actions { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 8px; }
              .chapterize-author-actions button { min-height: 32px; padding: 4px 10px; border: 1px solid var(--chapterize-border-strong); border-radius: 4px; background: var(--chapterize-surface); color: var(--chapterize-ink); font: inherit; }
              .chapterize-author-actions .chapterize-author-confirm { border-color: var(--chapterize-blue); background: var(--chapterize-blue); color: white; font-weight: 600; }
              .chapterize-author-actions .chapterize-author-confirm:disabled { border-color: var(--chapterize-border); background: var(--chapterize-surface-subtle); color: var(--chapterize-muted); }
              .chapterize-metadata-field { display: grid; grid-template-columns: auto 76px minmax(0, 1fr); align-items: start; gap: 6px; min-width: 0; }
              .chapterize-metadata-name { color: var(--chapterize-muted); }
              .chapterize-metadata-value { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
              #split, #cancel { min-width: 84px; padding: 5px 14px; }
              #split { border-color: var(--chapterize-blue); background: var(--chapterize-blue); color: white; font-weight: 650; }
              #split:hover { border-color: var(--chapterize-blue-hover); background: var(--chapterize-blue-hover); }
              #split:active { background: var(--chapterize-blue-ink); }
              @media (max-width: 1100px) { .chapterize-summary { flex-basis: 100%; margin-inline-start: 0; padding-top: 4px; } }
              @media (max-width: 760px) { .chapterize-dialog { padding-inline: 12px; } .chapterize-header-tools { justify-content: flex-start; } .chapterize-guidance { max-height: 4.5em; overflow: auto; } .chapterize-author-row { grid-template-columns: 1fr 1fr 34px; } }
              @media (prefers-reduced-motion: no-preference) { .chapterize-toolbar button, .chapterize-delete, #split, #cancel, tbody tr { transition: background-color 160ms ease-out, border-color 160ms ease-out, color 160ms ease-out, opacity 160ms ease-out; } }
              @media (forced-colors: active) { .chapterize-status::before, .chapterize-guidance, .chapterize-metadata-details { border-color: CanvasText; } }
            `,
          },
        },
        {
          tag: "div",
          classList: ["chapterize-header"],
          children: [
            {
              tag: "h1",
              id: ids.heading,
              properties: { textContent: getString("dialog-heading") },
            },
            {
              tag: "div",
              classList: ["chapterize-header-tools"],
              children: [
                {
                  tag: "span",
                  id: ids.source,
                  classList: ["chapterize-source"],
                  properties: {
                    textContent: getString(
                      input.detectedChapters.length > 0
                        ? "dialog-source-bookmarks"
                        : "dialog-source-manual",
                      { args: { pages: input.totalPages } },
                    ),
                  },
                },
                {
                  tag: "label",
                  classList: ["chapterize-language"],
                  children: [
                    {
                      tag: "span",
                      attributes: { "data-i18n-key": "dialog-language" },
                      properties: { textContent: getString("dialog-language") },
                    },
                    {
                      tag: "select",
                      id: ids.language,
                      properties: { value: language },
                      children: [
                        {
                          tag: "option",
                          attributes: { value: "zh-CN" },
                          properties: {
                            textContent: getString("dialog-language-zh"),
                          },
                        },
                        {
                          tag: "option",
                          attributes: { value: "en-US" },
                          properties: {
                            textContent: getString("dialog-language-en"),
                          },
                        },
                      ],
                      listeners: [
                        {
                          type: "change",
                          listener: (event: Event) => {
                            language = normalizeSplitPlanLanguage(
                              (event.currentTarget as HTMLSelectElement).value,
                            );
                            setPref("interfaceLanguage", language);
                            render(dialog.window.document);
                          },
                        },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        },
        {
          tag: "div",
          classList: ["chapterize-toolbar"],
          children: [
            {
              tag: "button",
              id: ids.recommended,
              attributes: { type: "button" },
              properties: {
                textContent: getString("dialog-select-recommended"),
                disabled: input.detectedChapters.length === 0,
              },
              listeners: [
                {
                  type: "click",
                  listener: () => {
                    const recommended = recommendedSplitSelection(rows);
                    setSelection(
                      dialog.window.document,
                      (_row, index) => recommended[index] ?? true,
                      "recommended",
                    );
                  },
                },
              ],
            },
            {
              tag: "button",
              id: ids.selectAll,
              attributes: { type: "button" },
              properties: { textContent: getString("dialog-select-all") },
              listeners: [
                {
                  type: "click",
                  listener: () =>
                    setSelection(dialog.window.document, () => true),
                },
              ],
            },
            {
              tag: "button",
              id: ids.selectNone,
              attributes: { type: "button" },
              properties: { textContent: getString("dialog-select-none") },
              listeners: [
                {
                  type: "click",
                  listener: () =>
                    setSelection(dialog.window.document, () => false),
                },
              ],
            },
            {
              tag: "button",
              id: ids.invert,
              attributes: { type: "button" },
              properties: { textContent: getString("dialog-select-invert") },
              listeners: [
                {
                  type: "click",
                  listener: () =>
                    setSelection(dialog.window.document, (row) => !row.enabled),
                },
              ],
            },
            {
              tag: "span",
              classList: ["chapterize-toolbar-separator"],
              attributes: { "aria-hidden": "true" },
            },
            {
              tag: "button",
              id: ids.cleanTitles,
              attributes: {
                type: "button",
                "aria-pressed": String(cleanTitles),
              },
              properties: {
                textContent: getString("dialog-clean-chapter-numbers"),
              },
              listeners: [
                {
                  type: "click",
                  listener: () => {
                    cleanTitles = true;
                    setPref("cleanChapterNumbers", true);
                    rows.forEach((row) => {
                      changeRowTitle(row, cleanChapterTitle(row.title));
                    });
                    render(dialog.window.document);
                  },
                },
              ],
            },
            {
              tag: "button",
              id: ids.restoreTitles,
              attributes: { type: "button" },
              properties: {
                textContent: getString("dialog-restore-original-titles"),
              },
              listeners: [
                {
                  type: "click",
                  listener: () => {
                    cleanTitles = false;
                    setPref("cleanChapterNumbers", false);
                    rows.forEach((row) =>
                      changeRowTitle(row, row.originalTitle),
                    );
                    render(dialog.window.document);
                  },
                },
              ],
            },
            {
              tag: "label",
              classList: ["chapterize-title-width"],
              children: [
                {
                  tag: "span",
                  attributes: { "data-i18n-key": "dialog-title-width" },
                  properties: { textContent: getString("dialog-title-width") },
                },
                {
                  tag: "input",
                  id: ids.titleWidth,
                  attributes: {
                    type: "range",
                    min: "320",
                    max: "800",
                    step: "40",
                  },
                  properties: { value: String(titleColumnWidth) },
                  listeners: [
                    {
                      type: "input",
                      listener: (event: Event) => {
                        titleColumnWidth = normalizeTitleColumnWidth(
                          (event.currentTarget as HTMLInputElement).value,
                        );
                        const root = dialog.window.document.querySelector(
                          ".chapterize-dialog",
                        ) as HTMLElement | null;
                        root?.style.setProperty(
                          "--chapterize-title-width",
                          `${titleColumnWidth}px`,
                        );
                        const output = dialog.window.document.getElementById(
                          ids.titleWidthValue,
                        );
                        if (output)
                          output.textContent = `${titleColumnWidth}px`;
                      },
                    },
                    {
                      type: "change",
                      listener: () =>
                        setPref("titleColumnWidth", titleColumnWidth),
                    },
                  ],
                },
                {
                  tag: "output",
                  id: ids.titleWidthValue,
                  attributes: {
                    for: ids.titleWidth,
                  },
                  properties: { textContent: `${titleColumnWidth}px` },
                },
              ],
            },
            {
              tag: "button",
              id: ids.matchAll,
              attributes: { type: "button" },
              properties: {
                textContent: getString("dialog-metadata-match-all"),
              },
              listeners: [
                {
                  type: "click",
                  listener: () => void matchAll(dialog.window.document),
                },
              ],
            },
            {
              tag: "button",
              id: ids.add,
              attributes: { type: "button" },
              properties: { textContent: getString("dialog-add") },
              listeners: [
                {
                  type: "click",
                  listener: () => {
                    const lastEnd = rows.reduce(
                      (max, row) => Math.max(max, row.endPage),
                      -1,
                    );
                    const start = Math.min(lastEnd + 1, input.totalPages - 1);
                    rows.push({
                      id: nextID++,
                      enabled: true,
                      title: getString("dialog-new-section", {
                        args: { number: rows.length + 1 },
                      }),
                      level: 1,
                      startPage: start,
                      endPage: start,
                      detectedEndPage: start,
                      originalTitle: getString("dialog-new-section", {
                        args: { number: rows.length + 1 },
                      }),
                      acceptedFields: new Set<MetadataField>(),
                      manualDoi: "",
                      creatorDraft: [{ creatorType: "author" }],
                      creatorsConfirmed: false,
                    });
                    render(dialog.window.document);
                  },
                },
              ],
            },
            {
              tag: "button",
              id: ids.reset,
              attributes: { type: "button" },
              properties: {
                textContent: getString("dialog-reset"),
                disabled: input.detectedChapters.length === 0,
              },
              listeners: [
                {
                  type: "click",
                  listener: () => {
                    rows = fromDetected();
                    render(dialog.window.document);
                  },
                },
              ],
            },
            {
              tag: "span",
              id: ids.summary,
              classList: ["chapterize-summary"],
              attributes: { role: "status", "aria-live": "polite" },
            },
          ],
        },
        {
          tag: "div",
          id: ids.guidance,
          classList: ["chapterize-guidance"],
          attributes: { role: "note" },
          properties: { textContent: getString("dialog-guidance") },
        },
        {
          tag: "div",
          classList: ["chapterize-table-wrap"],
          children: [
            {
              tag: "table",
              attributes: {
                "aria-label": getString("dialog-table-label"),
                "data-i18n-aria-label": "dialog-table-label",
                "aria-describedby": `${ids.guidance} ${ids.summary}`,
              },
              children: [
                {
                  tag: "thead",
                  children: [
                    {
                      tag: "tr",
                      children: [
                        "dialog-col-include",
                        "dialog-col-number",
                        "dialog-col-title",
                        "dialog-col-doi",
                        "dialog-col-metadata",
                        "dialog-col-start",
                        "dialog-col-end",
                        "dialog-col-printed",
                        "dialog-col-pages",
                        "dialog-col-status",
                        "dialog-col-actions",
                      ].map((key) => ({
                        tag: "th",
                        attributes: {
                          scope: "col",
                          "data-i18n-key": key,
                        },
                        properties: { textContent: getString(key as any) },
                      })),
                    },
                  ],
                },
                { tag: "tbody", id: ids.rows },
              ],
            },
          ],
        },
        {
          tag: "div",
          id: ids.errors,
          classList: ["chapterize-errors"],
          attributes: { role: "alert" },
        },
      ],
    })
    .addButton(getString("dialog-cancel"), "cancel")
    .addButton(getString("dialog-split"), "split", {
      noClose: true,
      callback: () => {
        const issues = refreshStatus(dialog.window.document);
        if (issues.length > 0) return;
        result = normalizeSplitPlan(selectedRows().map(toChapter)).map(
          (chapter) => {
            const row = selectedRows().find(
              (candidate) =>
                candidate.startPage === chapter.startPage &&
                candidate.endPage === chapter.endPage,
            );
            return {
              ...chapter,
              metadata: row ? acceptedMetadata(row) : undefined,
            };
          },
        );
        dialog.window.close();
      },
    })
    .setDialogData(data)
    .open(getString("dialog-title"), {
      width: 1320,
      height: 650,
      centerscreen: true,
      resizable: true,
      fitContent: false,
    });

  await dialog.dialogData.unloadLock?.promise;
  return result;
}
