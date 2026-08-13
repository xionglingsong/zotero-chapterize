import type { ZoteroCreator } from "./crossref";

export type MetadataStatus = "idle" | "loading" | "needs-doi" | "matched";
export type MetadataStatusTone = "neutral" | "progress" | "warning" | "success";
export type SectionStatusTone = "new" | "update";
export type AuthorSource = "toc" | "crossref" | "doi" | "manual";

interface StatusPresentation<TTone extends string> {
  tone: TTone;
  labelKey: string;
  helpKey: string;
}

/** Keep metadata state semantics independent from localized UI copy. */
export function metadataStatusPresentation(
  status: MetadataStatus,
): StatusPresentation<MetadataStatusTone> {
  switch (status) {
    case "loading":
      return {
        tone: "progress",
        labelKey: "dialog-metadata-searching",
        helpKey: "dialog-metadata-searching-help",
      };
    case "needs-doi":
      return {
        tone: "warning",
        labelKey: "dialog-metadata-needs-doi",
        helpKey: "dialog-metadata-none-help",
      };
    case "matched":
      return {
        tone: "success",
        labelKey: "dialog-metadata-confidence",
        helpKey: "dialog-metadata-review-help",
      };
    default:
      return {
        tone: "neutral",
        labelKey: "dialog-metadata-find",
        helpKey: "dialog-metadata-find-title",
      };
  }
}

/** Describe what the confirmed split will do, rather than storage internals. */
export function sectionStatusPresentation(
  existing: boolean,
): StatusPresentation<SectionStatusTone> {
  return existing
    ? {
        tone: "update",
        labelKey: "dialog-status-existing",
        helpKey: "dialog-status-existing-help",
      }
    : {
        tone: "new",
        labelKey: "dialog-status-new",
        helpKey: "dialog-status-new-help",
      };
}

export function shouldDiscardTitleMatch(
  source: "title" | "doi" | undefined,
  currentTitle: string,
  nextTitle: string,
): boolean {
  return source === "title" && currentTitle !== nextTitle;
}

export function authorStatusPresentation(
  source: AuthorSource | undefined,
  confirmed: boolean,
  hasCreators: boolean,
): StatusPresentation<MetadataStatusTone> {
  if (!hasCreators) {
    return {
      tone: "neutral",
      labelKey: "dialog-author-add",
      helpKey: "dialog-author-add-help",
    };
  }
  if (confirmed) {
    return {
      tone: "success",
      labelKey: "dialog-author-confirmed",
      helpKey: "dialog-author-confirmed-help",
    };
  }
  return source === "toc"
    ? {
        tone: "warning",
        labelKey: "dialog-author-review",
        helpKey: "dialog-author-review-help",
      }
    : {
        tone: "warning",
        labelKey: "dialog-author-confirm",
        helpKey: "dialog-author-confirm-help",
      };
}

export function confirmedCreatorMetadata(
  creators: ZoteroCreator[],
  confirmed: boolean,
): ZoteroCreator[] | undefined {
  if (!confirmed) return undefined;
  const cleaned = creators
    .map((creator) => ({
      creatorType: "author" as const,
      firstName: creator.firstName?.trim() || undefined,
      lastName: creator.lastName?.trim() || undefined,
    }))
    .filter((creator) => creator.firstName || creator.lastName);
  return cleaned.length > 0 ? cleaned : undefined;
}

export function shouldReplaceCreatorDraft(
  currentSource: AuthorSource | undefined,
  hasCurrentCreators: boolean,
): boolean {
  return currentSource !== "manual" || !hasCurrentCreators;
}
