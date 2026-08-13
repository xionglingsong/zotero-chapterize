import { assert } from "chai";
import {
  normalizeSplitPlanLanguage,
  normalizeTitleColumnWidth,
  splitPlanText,
} from "../src/modules/splitPlanLocale";

describe("split preview language", function () {
  it("provides Chinese as the explicit default UI language", function () {
    assert.equal(splitPlanText("zh-CN", "dialog-metadata-none"), "需要 DOI");
    assert.include(splitPlanText("zh-CN", "dialog-guidance"), "DOI");
  });

  it("switches labels and interpolates values in English", function () {
    assert.equal(splitPlanText("en-US", "dialog-col-status"), "Split result");
    assert.equal(
      splitPlanText("en-US", "dialog-metadata-confidence", {
        confidence: 98,
      }),
      "98% match",
    );
  });

  it("reports the remaining author confirmations in the summary", function () {
    assert.include(
      splitPlanText("zh-CN", "dialog-summary", {
        sections: 3,
        authorPending: 2,
        authorConflicts: 1,
      }),
      "待确认作者 2 个",
    );
    assert.include(
      splitPlanText("zh-CN", "dialog-summary", {
        sections: 3,
        authorPending: 2,
        authorConflicts: 1,
      }),
      "冲突 1 个",
    );
  });

  it("uses action-oriented status and recovery copy in both languages", function () {
    assert.equal(splitPlanText("zh-CN", "dialog-status-new"), "将新建");
    assert.equal(splitPlanText("zh-CN", "dialog-status-existing"), "将更新");
    assert.equal(
      splitPlanText("en-US", "dialog-metadata-needs-doi"),
      "DOI needed",
    );
    assert.include(
      splitPlanText("zh-CN", "dialog-metadata-searching-help"),
      "Crossref",
    );
    assert.include(
      splitPlanText("en-US", "dialog-metadata-review-help"),
      "fields",
    );
    assert.include(splitPlanText("zh-CN", "dialog-author-review-help"), "确认");
    assert.equal(
      splitPlanText("en-US", "dialog-author-source-toc", { page: "vii" }),
      "Source: contents page vii",
    );
  });

  it("keeps language and title-width preferences in supported ranges", function () {
    assert.equal(normalizeSplitPlanLanguage("en-US"), "en-US");
    assert.equal(normalizeSplitPlanLanguage("fr-FR"), "zh-CN");
    assert.equal(normalizeTitleColumnWidth(200), 320);
    assert.equal(normalizeTitleColumnWidth(640), 640);
    assert.equal(normalizeTitleColumnWidth("invalid"), 520);
  });

  it("explains author conflicts and bulk confirmation in both languages", function () {
    assert.include(
      splitPlanText("zh-CN", "dialog-author-conflict-help"),
      "来源",
    );
    assert.include(
      splitPlanText("en-US", "dialog-author-conflict-help"),
      "sources",
    );
    assert.equal(
      splitPlanText("zh-CN", "dialog-author-confirm-safe"),
      "确认无冲突作者",
    );
    assert.equal(
      splitPlanText("en-US", "dialog-author-confirm-safe"),
      "Confirm non-conflicting authors",
    );
  });
});
