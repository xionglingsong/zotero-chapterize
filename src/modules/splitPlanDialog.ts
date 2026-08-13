import { getString } from "../utils/locale";
import { getPref, setPref } from "../utils/prefs";
import {
  searchSectionByTitle,
  type CrossRefMatch,
  type CrossRefSectionMeta,
} from "./crossref";
import type { Chapter } from "./pdf/outline";
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

interface EditableRow extends Chapter {
  id: number;
  enabled: boolean;
  detectedEndPage: number;
  originalTitle: string;
  metadataMatch?: CrossRefMatch | null;
  metadataLoading?: boolean;
  metadataExpanded?: boolean;
  acceptedFields: Set<MetadataField>;
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
};

/** Show the complete split-plan editor and return only a validated plan. */
export async function showSplitPlanDialog(
  input: SplitPlanDialogInput,
): Promise<ChapterPlan[] | null> {
  let nextID = 1;
  let cleanTitles = getPref("cleanChapterNumbers") !== false;
  const fromDetected = () => {
    const recommended = recommendedSplitSelection(input.detectedChapters);
    const recommendedEnds = recommendedRangeEndPages(
      input.detectedChapters,
      recommended,
      input.totalPages,
    );
    return input.detectedChapters.map((chapter, index) => ({
      ...chapter,
      title: cleanTitles ? cleanChapterTitle(chapter.title) : chapter.title,
      endPage: recommendedEnds[index] ?? chapter.endPage,
      id: nextID++,
      enabled: recommended[index] ?? true,
      detectedEndPage: chapter.endPage,
      originalTitle: chapter.title,
      acceptedFields: new Set<MetadataField>(),
    }));
  };
  let rows: EditableRow[] = fromDetected();
  let result: ChapterPlan[] | null = null;

  const dialog = new ztoolkit.Dialog(1, 1);
  const data: Record<string, any> = {
    loadCallback: () => render(dialog.window.document),
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
    if (!metadata || row.acceptedFields.size === 0) return undefined;
    const accepted: Partial<CrossRefSectionMeta> = {};
    for (const field of row.acceptedFields) {
      (accepted as any)[field] = metadata[field];
    }
    return accepted;
  }

  async function matchRow(row: EditableRow, doc: Document): Promise<void> {
    row.metadataLoading = true;
    render(doc);
    row.metadataMatch = await searchSectionByTitle(row.title, {
      bookTitle: input.bookTitle,
      isbn: input.isbn,
    });
    row.metadataLoading = false;
    row.metadataExpanded = !!row.metadataMatch;
    row.acceptedFields = new Set(
      row.metadataMatch
        ? metadataFields.filter(
            (field) =>
              defaultAcceptedFields.has(field) &&
              metadataValue(row.metadataMatch!.metadata, field) !== "",
          )
        : [],
    );
    render(doc);
  }

  async function matchAll(doc: Document): Promise<void> {
    const pending = selectedRows();
    for (let index = 0; index < pending.length; index += 3) {
      await Promise.all(
        pending.slice(index, index + 3).map((row) => matchRow(row, doc)),
      );
    }
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

  function render(doc: Document): void {
    const body = doc.getElementById(ids.rows) as HTMLTableSectionElement | null;
    if (!body) return;
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
        row.title = title.value;
        title.title = title.value;
        refreshStatus(doc);
      });
      titleCell.append(title);
      tr.append(titleCell);

      const metadataCell = doc.createElement("td");
      metadataCell.className = "chapterize-metadata-cell";
      const matchButton = doc.createElement("button");
      matchButton.type = "button";
      matchButton.className = "chapterize-match";
      matchButton.disabled = !!row.metadataLoading;
      matchButton.textContent = row.metadataLoading
        ? getString("dialog-metadata-searching")
        : row.metadataMatch
          ? getString("dialog-metadata-confidence", {
              args: {
                confidence: Math.round(row.metadataMatch.confidence * 100),
              },
            })
          : row.metadataMatch === null
            ? getString("dialog-metadata-none")
            : getString("dialog-metadata-find");
      matchButton.title = getString("dialog-metadata-find-title");
      matchButton.addEventListener("click", () => {
        if (row.metadataMatch) {
          row.metadataExpanded = !row.metadataExpanded;
          render(doc);
        } else {
          void matchRow(row, doc);
        }
      });
      metadataCell.append(matchButton);
      tr.append(metadataCell);

      const printedPages = makeCell(doc, displayedPrintedRange(row));
      printedPages.className = "chapterize-printed-pages";
      printedPages.title = printedPages.textContent ?? "";
      const initialPageCount = row.endPage - row.startPage + 1;
      const pageCount = makeCell(
        doc,
        initialPageCount > 0 ? String(initialPageCount) : "-",
      );
      const status = makeCell(
        doc,
        getString(
          input.isExistingRange(row.startPage, row.endPage)
            ? "dialog-status-existing"
            : "dialog-status-new",
        ),
      );
      status.className = "chapterize-status";
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
          status.textContent = getString(
            exists ? "dialog-status-existing" : "dialog-status-new",
          );
          status.classList.toggle("chapterize-status-existing", exists);
          refreshStatus(doc);
        });
        cell.append(page);
        tr.append(cell);
      }

      const exists = input.isExistingRange(row.startPage, row.endPage);
      status.classList.toggle("chapterize-status-existing", exists);
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

      if (row.metadataExpanded && row.metadataMatch) {
        const detailsRow = doc.createElement("tr");
        detailsRow.className = "chapterize-metadata-details-row";
        const detailsCell = doc.createElement("td");
        detailsCell.colSpan = 10;
        const details = doc.createElement("div");
        details.className = "chapterize-metadata-details";
        const heading = doc.createElement("strong");
        heading.textContent = getString("dialog-metadata-review", {
          args: {
            confidence: Math.round(row.metadataMatch.confidence * 100),
          },
        });
        details.append(heading);
        for (const field of metadataFields) {
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
          name.textContent = getString(`dialog-metadata-field-${field}` as any);
          const fieldValue = doc.createElement("span");
          fieldValue.className = "chapterize-metadata-value";
          fieldValue.textContent = value;
          fieldValue.title = value;
          label.append(accept, name, fieldValue);
          details.append(label);
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
      tag: "div",
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
                --chapterize-danger: oklch(0.48 0.18 25);
                --chapterize-danger-soft: oklch(0.96 0.035 25);
                --chapterize-radius: 6px;
              }
              html, body { box-sizing: border-box; width: 100%; height: 100%; margin: 0; overflow: hidden; background: var(--chapterize-bg); color: var(--chapterize-ink); }
              *, *::before, *::after { box-sizing: inherit; }
              body > vbox, body > vbox > hbox:first-child, body > vbox > hbox:first-child > vbox { min-height: 0; overflow: hidden; }
              body > vbox > hbox:last-child { flex-shrink: 0; gap: 8px; padding: 10px 20px 12px; border-top: 1px solid var(--chapterize-border); background: var(--chapterize-surface); }
              .chapterize-dialog { display: grid; grid-template-rows: auto auto minmax(0, 1fr) auto; gap: 12px; min-width: 700px; width: 100%; height: 100%; min-height: 0; padding: 18px 20px 10px; overflow: hidden; color: var(--chapterize-ink); font: menu; }
              .chapterize-header { display: flex; flex-wrap: wrap; align-items: baseline; justify-content: space-between; gap: 8px 16px; }
              .chapterize-header h1 { margin: 0; color: var(--chapterize-blue-ink); font-size: 20px; font-weight: 650; letter-spacing: 0; }
              .chapterize-source { color: var(--chapterize-muted); }
              .chapterize-toolbar { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; padding: 8px; border: 1px solid var(--chapterize-border); border-radius: var(--chapterize-radius); background: var(--chapterize-surface); }
              .chapterize-toolbar button, .chapterize-delete, #split, #cancel { min-height: 32px; margin: 0; border: 1px solid var(--chapterize-border-strong); border-radius: 5px; background: var(--chapterize-surface); color: var(--chapterize-ink); font: inherit; transition: background-color 160ms ease-out, border-color 160ms ease-out, color 160ms ease-out; }
              .chapterize-toolbar button { padding: 4px 10px; }
              .chapterize-toolbar button:hover, .chapterize-delete:hover, #cancel:hover { border-color: var(--chapterize-blue); background: var(--chapterize-blue-soft); color: var(--chapterize-blue-ink); }
              .chapterize-toolbar button:active, .chapterize-delete:active, #cancel:active { background: var(--chapterize-surface-subtle); }
              .chapterize-toolbar button:disabled { border-color: var(--chapterize-border); color: var(--chapterize-muted); opacity: .58; }
              .chapterize-toolbar button:focus-visible, .chapterize-delete:focus-visible, #split:focus-visible, #cancel:focus-visible, input:focus-visible { outline: 2px solid var(--chapterize-blue); outline-offset: 2px; }
              #chapterize-plan-recommended { border-color: var(--chapterize-blue); background: var(--chapterize-blue-soft); color: var(--chapterize-blue-ink); font-weight: 600; }
              .chapterize-toolbar-separator { width: 1px; height: 24px; margin: 0 2px; background: var(--chapterize-border); }
              .chapterize-summary { margin-left: auto; color: var(--chapterize-muted); font-variant-numeric: tabular-nums; }
              .chapterize-table-wrap { min-height: 0; overflow: auto; border: 1px solid var(--chapterize-border); border-radius: var(--chapterize-radius); background: var(--chapterize-surface); }
              table { width: 100%; border-collapse: collapse; table-layout: fixed; }
              th { position: sticky; top: 0; z-index: 1; background: var(--chapterize-surface-subtle); color: var(--chapterize-blue-ink); text-align: left; font-weight: 650; }
              th, td { padding: 7px 8px; border-bottom: 1px solid var(--chapterize-border); }
              tbody tr { background: var(--chapterize-surface); transition: background-color 160ms ease-out, opacity 160ms ease-out; }
              tbody tr:hover { background: var(--chapterize-blue-soft); }
              tbody tr:last-child td { border-bottom: 0; }
              th:nth-child(1), td:nth-child(1) { width: 68px; text-align: center; }
              th:nth-child(2), td:nth-child(2) { width: 42px; color: var(--chapterize-muted); }
              th:nth-child(4), td:nth-child(4) { width: 110px; }
              th:nth-child(5), td:nth-child(5), th:nth-child(6), td:nth-child(6) { width: 92px; }
              th:nth-child(7), td:nth-child(7) { width: 118px; }
              th:nth-child(8), td:nth-child(8) { width: 64px; }
              th:nth-child(9), td:nth-child(9) { width: 82px; }
              th:nth-child(10), td:nth-child(10) { width: 88px; }
              td input[type="text"], td input[type="number"] { width: 100%; min-height: 30px; border: 1px solid var(--chapterize-border-strong); border-radius: 4px; background: var(--chapterize-surface); color: var(--chapterize-ink); font: inherit; }
              td input[type="checkbox"] { accent-color: var(--chapterize-blue); }
              .chapterize-title-cell { padding-block: 6px; }
              .chapterize-printed-pages { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-variant-numeric: tabular-nums; }
              .chapterize-status { color: var(--chapterize-muted); }
              .chapterize-status::before { display: inline-block; width: 6px; height: 6px; margin-inline-end: 6px; border-radius: 50%; background: var(--chapterize-border-strong); content: ""; vertical-align: 1px; }
              .chapterize-status-existing { color: var(--chapterize-blue-ink); font-weight: 600; }
              .chapterize-status-existing::before { background: var(--chapterize-blue); }
              .chapterize-row-disabled { opacity: .52; }
              .chapterize-row-error, .chapterize-row-error:hover { background: var(--chapterize-danger-soft); }
              .chapterize-row-error input { border-color: var(--chapterize-danger); }
              .chapterize-errors { min-height: 0; padding: 8px 10px; border: 1px solid color-mix(in oklch, var(--chapterize-danger) 35%, white); border-radius: var(--chapterize-radius); background: var(--chapterize-danger-soft); color: var(--chapterize-danger); }
              .chapterize-errors[hidden] { display: none; }
              .chapterize-delete { width: 100%; padding: 3px 8px; color: var(--chapterize-muted); }
              .chapterize-clean-toggle { display: inline-flex; min-height: 32px; align-items: center; gap: 6px; padding: 0 4px; color: var(--chapterize-ink); white-space: nowrap; }
              .chapterize-clean-toggle input { accent-color: var(--chapterize-blue); }
              .chapterize-match { width: 100%; min-height: 30px; border: 1px solid var(--chapterize-border-strong); border-radius: 4px; background: var(--chapterize-blue-soft); color: var(--chapterize-blue-ink); font: inherit; }
              .chapterize-metadata-details-row:hover { background: var(--chapterize-surface); }
              .chapterize-metadata-details { display: grid; grid-template-columns: repeat(auto-fit, minmax(290px, 1fr)); gap: 6px 14px; padding: 10px 12px; border-left: 3px solid var(--chapterize-blue); background: var(--chapterize-surface-subtle); }
              .chapterize-metadata-details > strong { grid-column: 1 / -1; color: var(--chapterize-blue-ink); }
              .chapterize-metadata-field { display: grid; grid-template-columns: auto 76px minmax(0, 1fr); align-items: start; gap: 6px; min-width: 0; }
              .chapterize-metadata-name { color: var(--chapterize-muted); }
              .chapterize-metadata-value { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
              #split, #cancel { min-width: 84px; padding: 5px 14px; }
              #split { border-color: var(--chapterize-blue); background: var(--chapterize-blue); color: white; font-weight: 650; }
              #split:hover { border-color: var(--chapterize-blue-hover); background: var(--chapterize-blue-hover); }
              #split:active { background: var(--chapterize-blue-ink); }
              @media (max-width: 820px) { .chapterize-summary { flex-basis: 100%; margin-left: 0; } }
              @media (prefers-reduced-motion: reduce) { *, *::before, *::after { scroll-behavior: auto !important; transition-duration: .01ms !important; } }
            `,
          },
        },
        {
          tag: "div",
          classList: ["chapterize-header"],
          children: [
            {
              tag: "h1",
              properties: { textContent: getString("dialog-heading") },
            },
            {
              tag: "span",
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
              tag: "label",
              classList: ["chapterize-clean-toggle"],
              children: [
                {
                  tag: "input",
                  id: ids.cleanTitles,
                  attributes: { type: "checkbox" },
                  properties: { checked: cleanTitles },
                  listeners: [
                    {
                      type: "change",
                      listener: (event: Event) => {
                        cleanTitles = (event.target as HTMLInputElement)
                          .checked;
                        setPref("cleanChapterNumbers", cleanTitles);
                        rows.forEach((row) => {
                          row.title = cleanTitles
                            ? cleanChapterTitle(row.originalTitle)
                            : row.originalTitle;
                        });
                        render(dialog.window.document);
                      },
                    },
                  ],
                },
                {
                  tag: "span",
                  properties: {
                    textContent: getString("dialog-clean-chapter-numbers"),
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
                    rows.forEach((row) => (row.title = row.originalTitle));
                    render(dialog.window.document);
                  },
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
            },
          ],
        },
        {
          tag: "div",
          classList: ["chapterize-table-wrap"],
          children: [
            {
              tag: "table",
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
                        "dialog-col-metadata",
                        "dialog-col-start",
                        "dialog-col-end",
                        "dialog-col-printed",
                        "dialog-col-pages",
                        "dialog-col-status",
                        "dialog-col-actions",
                      ].map((key) => ({
                        tag: "th",
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
      width: 1050,
      height: 650,
      centerscreen: true,
      resizable: true,
      fitContent: false,
    });

  await dialog.dialogData.unloadLock?.promise;
  return result;
}
