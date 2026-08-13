import { assert } from "chai";
import {
  shouldDiscardTitleMatch,
  metadataStatusPresentation,
  sectionStatusPresentation,
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
});
