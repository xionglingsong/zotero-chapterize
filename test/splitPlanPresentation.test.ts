import { assert } from "chai";
import {
  authorStatusPresentation,
  confirmedCreatorMetadata,
  shouldDiscardTitleMatch,
  metadataStatusPresentation,
  sectionStatusPresentation,
  shouldReplaceCreatorDraft,
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
});
