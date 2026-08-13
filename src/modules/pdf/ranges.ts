import type { Chapter } from "./outline";

export type SplitPlanEntry = Chapter;

export interface ParseSplitPlanResult {
  entries: SplitPlanEntry[];
  errors: string[];
}

export type SplitPlanIssueCode =
  | "empty-title"
  | "invalid-range"
  | "out-of-bounds"
  | "overlap";

export interface SplitPlanIssue {
  code: SplitPlanIssueCode;
  index: number;
  relatedIndex?: number;
}

export interface SplitPlanSummary {
  sectionCount: number;
  coveredPages: number;
  omittedPages: number;
}

/**
 * Human-editable split plan format:
 *
 *   Chapter title: 1-12
 *   Another title: 13-24
 *
 * Separators may be newlines or semicolons. Page numbers are user-facing
 * physical pages (1-based); returned ranges are 0-based and inclusive.
 */
export function parseSplitPlan(
  input: string,
  totalPages: number,
): ParseSplitPlanResult {
  const entries: SplitPlanEntry[] = [];
  const errors: string[] = [];
  const chunks = input
    .split(/[\n;]+/)
    .map((line) => line.trim())
    .filter(Boolean);

  chunks.forEach((line, index) => {
    const match = line.match(/^(?:(.+?)\s*:\s*)?(\d+)\s*(?:[-–—]\s*(\d+))?$/);
    if (!match) {
      errors.push(`Line ${index + 1}: expected "Title: 1-12".`);
      return;
    }

    const title = (match[1] || `Section ${index + 1}`).trim();
    const start = Number(match[2]);
    const end = Number(match[3] || match[2]);

    if (!Number.isInteger(start) || !Number.isInteger(end)) {
      errors.push(`Line ${index + 1}: page numbers must be integers.`);
      return;
    }
    if (start < 1 || end < 1 || start > end) {
      errors.push(`Line ${index + 1}: invalid page range ${start}-${end}.`);
      return;
    }
    if (end > totalPages) {
      errors.push(
        `Line ${index + 1}: page ${end} exceeds PDF length ${totalPages}.`,
      );
    }

    entries.push({
      title,
      level: 1,
      startPage: start - 1,
      endPage: end - 1,
    });
  });

  entries.sort((a, b) => a.startPage - b.startPage || a.endPage - b.endPage);

  let previous = entries[0];
  for (let i = 1; i < entries.length; i++) {
    const current = entries[i];
    if (previous && current.startPage <= previous.endPage) {
      errors.push(`Range "${current.title}" overlaps "${previous.title}".`);
    }
    if (!previous || current.endPage > previous.endPage) previous = current;
  }

  return { entries, errors };
}

export function formatSplitPlan(entries: SplitPlanEntry[]): string {
  return entries
    .map(
      (entry) => `${entry.title}: ${entry.startPage + 1}-${entry.endPage + 1}`,
    )
    .join("; ");
}

/** Validate physical, 0-based inclusive ranges without mutating their order. */
export function validateSplitPlan(
  entries: SplitPlanEntry[],
  totalPages: number,
): SplitPlanIssue[] {
  const issues: SplitPlanIssue[] = [];

  entries.forEach((entry, index) => {
    if (!entry.title.trim()) issues.push({ code: "empty-title", index });
    if (
      !Number.isInteger(entry.startPage) ||
      !Number.isInteger(entry.endPage) ||
      entry.startPage < 0 ||
      entry.startPage > entry.endPage
    ) {
      issues.push({ code: "invalid-range", index });
    } else if (entry.endPage >= totalPages) {
      issues.push({ code: "out-of-bounds", index });
    }
  });

  const sortable = entries
    .map((entry, index) => ({ entry, index }))
    .filter(
      ({ entry }) =>
        Number.isInteger(entry.startPage) &&
        Number.isInteger(entry.endPage) &&
        entry.startPage >= 0 &&
        entry.startPage <= entry.endPage,
    )
    .sort(
      (a, b) =>
        a.entry.startPage - b.entry.startPage ||
        a.entry.endPage - b.entry.endPage,
    );

  let previous = sortable[0];
  for (let i = 1; i < sortable.length; i++) {
    const current = sortable[i];
    if (previous && current.entry.startPage <= previous.entry.endPage) {
      issues.push({
        code: "overlap",
        index: current.index,
        relatedIndex: previous.index,
      });
    }
    if (!previous || current.entry.endPage > previous.entry.endPage) {
      previous = current;
    }
  }

  return issues;
}

export function normalizeSplitPlan(
  entries: SplitPlanEntry[],
): SplitPlanEntry[] {
  return entries
    .map((entry) => ({ ...entry, title: entry.title.trim() }))
    .sort((a, b) => a.startPage - b.startPage || a.endPage - b.endPage);
}

export function summarizeSplitPlan(
  entries: SplitPlanEntry[],
  totalPages: number,
): SplitPlanSummary {
  const intervals = entries
    .filter(
      (entry) =>
        Number.isInteger(entry.startPage) &&
        Number.isInteger(entry.endPage) &&
        entry.startPage <= entry.endPage,
    )
    .map((entry) => ({
      start: Math.max(0, entry.startPage),
      end: Math.min(totalPages - 1, entry.endPage),
    }))
    .filter((interval) => interval.start <= interval.end)
    .sort((a, b) => a.start - b.start || a.end - b.end);

  let coveredPages = 0;
  let current = intervals[0];
  for (let i = 1; i < intervals.length; i++) {
    const next = intervals[i];
    if (next.start <= current.end + 1) {
      current.end = Math.max(current.end, next.end);
    } else {
      coveredPages += current.end - current.start + 1;
      current = next;
    }
  }
  if (current) coveredPages += current.end - current.start + 1;

  return {
    sectionCount: entries.length,
    coveredPages,
    omittedPages: Math.max(0, totalPages - coveredPages),
  };
}
