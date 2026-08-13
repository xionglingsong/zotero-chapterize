import { assert } from "chai";
import {
  authorStatusPresentation,
  canBulkConfirmCreators,
  creatorCandidatesAgree,
  confirmedCreatorMetadata,
  shouldDiscardTitleMatch,
  metadataStatusPresentation,
  mergeCreatorCandidate,
  sectionStatusPresentation,
  shouldReplaceCreatorDraft,
  resolveCreatorCandidates,
} from "../src/modules/splitPlanPresentation";

describe("split preview presentation", function () {
  it("gives every metadata state a visible label and recovery hint", function () {
    assert.deepEqual(metadataStatusPresentation("idle"), {
      tone: "neutral",
      labelKey: "dialog-metadata-find",
      helpKey: "dialog-metadata-find-title",
    });
    assert.deepEqual(metadataStatusPresentation("loading"), {
      tone: "progress",
      labelKey: "dialog-metadata-searching",
      helpKey: "dialog-metadata-searching-help",
    });
    assert.deepEqual(metadataStatusPresentation("needs-doi"), {
      tone: "warning",
      labelKey: "dialog-metadata-needs-doi",
      helpKey: "dialog-metadata-none-help",
    });
    assert.deepEqual(metadataStatusPresentation("matched"), {
      tone: "success",
      labelKey: "dialog-metadata-confidence",
      helpKey: "dialog-metadata-review-help",
    });
  });

  it("describes the result of splitting rather than database state", function () {
    assert.deepEqual(sectionStatusPresentation(false), {
      tone: "new",
      labelKey: "dialog-status-new",
      helpKey: "dialog-status-new-help",
    });
    assert.deepEqual(sectionStatusPresentation(true), {
      tone: "update",
      labelKey: "dialog-status-existing",
      helpKey: "dialog-status-existing-help",
    });
  });

  it("discards title matches when a title-editing command changes the title", function () {
    assert.isTrue(
      shouldDiscardTitleMatch(
        "title",
        "33 Eye-tracking studies",
        "Eye-tracking studies",
      ),
    );
    assert.isFalse(
      shouldDiscardTitleMatch(
        "doi",
        "33 Eye-tracking studies",
        "Eye-tracking studies",
      ),
    );
    assert.isFalse(
      shouldDiscardTitleMatch("title", "Introduction", "Introduction"),
    );
  });

  it("requires confirmation for TOC and manually edited authors", function () {
    assert.deepEqual(authorStatusPresentation("toc", false, true), {
      tone: "warning",
      labelKey: "dialog-author-review",
      helpKey: "dialog-author-review-help",
    });
    assert.deepEqual(authorStatusPresentation("manual", false, true), {
      tone: "warning",
      labelKey: "dialog-author-confirm",
      helpKey: "dialog-author-confirm-help",
    });
    assert.deepEqual(authorStatusPresentation("chapter-page", false, true), {
      tone: "warning",
      labelKey: "dialog-author-review",
      helpKey: "dialog-author-review-help",
    });
    assert.deepEqual(authorStatusPresentation("manual", true, true), {
      tone: "success",
      labelKey: "dialog-author-confirmed",
      helpKey: "dialog-author-confirmed-help",
    });
    assert.deepEqual(authorStatusPresentation(undefined, false, false), {
      tone: "neutral",
      labelKey: "dialog-author-add",
      helpKey: "dialog-author-add-help",
    });
  });

  it("returns creator metadata only after explicit confirmation", function () {
    const creators = [
      {
        creatorType: "author" as const,
        firstName: " Agnieszka ",
        lastName: " Chmiel ",
      },
      { creatorType: "author" as const, firstName: "", lastName: "" },
    ];
    assert.isUndefined(confirmedCreatorMetadata(creators, false));
    assert.deepEqual(confirmedCreatorMetadata(creators, true), [
      {
        creatorType: "author",
        firstName: "Agnieszka",
        lastName: "Chmiel",
      },
    ]);
  });

  it("preserves non-empty manual authors during later metadata matching", function () {
    assert.isFalse(shouldReplaceCreatorDraft("manual", true));
    assert.isTrue(shouldReplaceCreatorDraft("manual", false));
    assert.isTrue(shouldReplaceCreatorDraft("toc", true));
    assert.isTrue(shouldReplaceCreatorDraft("crossref", true));
  });

  it("marks disagreeing TOC and chapter-page authors as a conflict", function () {
    const toc = {
      source: "toc" as const,
      creators: [
        {
          creatorType: "author" as const,
          firstName: "Michaela",
          lastName: "Albl-Mikasa",
        },
      ],
    };
    const chapterPage = {
      source: "chapter-page" as const,
      creators: [
        {
          creatorType: "author" as const,
          firstName: "Agnieszka",
          lastName: "Chmiel",
        },
      ],
    };

    assert.isFalse(creatorCandidatesAgree(toc.creators, chapterPage.creators));
    assert.deepEqual(resolveCreatorCandidates([toc, chapterPage]), {
      selected: toc,
      alternatives: [toc, chapterPage],
      conflict: true,
    });
  });

  it("collapses matching author sources into one non-conflicting candidate", function () {
    const toc = {
      source: "toc" as const,
      creators: [
        {
          creatorType: "author" as const,
          firstName: "Agnieszka",
          lastName: "Chmiel",
        },
      ],
    };
    const chapterPage = {
      source: "chapter-page" as const,
      creators: [
        {
          creatorType: "author" as const,
          firstName: " agnieszka ",
          lastName: "CHMIEL",
        },
      ],
    };

    assert.isTrue(creatorCandidatesAgree(toc.creators, chapterPage.creators));
    assert.deepEqual(resolveCreatorCandidates([toc, chapterPage]), {
      selected: toc,
      alternatives: [toc],
      conflict: false,
    });
  });

  it("requires review when a Crossref title match conflicts with a local source", function () {
    const local = {
      source: "chapter-page" as const,
      creators: [
        {
          creatorType: "author" as const,
          firstName: "Agnieszka",
          lastName: "Chmiel",
        },
      ],
    };
    const crossref = {
      source: "crossref" as const,
      creators: [
        {
          creatorType: "author" as const,
          firstName: "Michaela",
          lastName: "Albl-Mikasa",
        },
      ],
    };

    const result = mergeCreatorCandidate([local], crossref);
    assert.equal(result.selected?.source, "crossref");
    assert.isTrue(result.conflict);
    assert.lengthOf(result.alternatives, 2);
    assert.deepEqual(authorStatusPresentation("crossref", false, true, true), {
      tone: "warning",
      labelKey: "dialog-author-conflict",
      helpKey: "dialog-author-conflict-help",
    });
  });

  it("lets a DOI candidate replace conflicts but protects manual authors", function () {
    const manual = {
      source: "manual" as const,
      creators: [
        {
          creatorType: "author" as const,
          firstName: "Agnieszka",
          lastName: "Chmiel",
        },
      ],
    };
    const doi = {
      source: "doi" as const,
      creators: [
        {
          creatorType: "author" as const,
          firstName: "Jane",
          lastName: "Smith",
        },
      ],
    };

    assert.deepEqual(mergeCreatorCandidate([], doi), {
      selected: doi,
      alternatives: [doi],
      conflict: false,
    });
    assert.deepEqual(mergeCreatorCandidate([manual], doi), {
      selected: manual,
      alternatives: [manual],
      conflict: false,
    });
  });

  it("bulk-confirms only non-conflicting unconfirmed creator drafts", function () {
    const creators = [
      {
        creatorType: "author" as const,
        firstName: "Agnieszka",
        lastName: "Chmiel",
      },
    ];
    assert.isTrue(canBulkConfirmCreators(creators, false, false));
    assert.isFalse(canBulkConfirmCreators(creators, false, true));
    assert.isFalse(canBulkConfirmCreators(creators, true, false));
    assert.isFalse(canBulkConfirmCreators([], false, false));
  });
});
