import { assert } from "chai";
import { splitPlanText } from "../src/modules/splitPlanLocale";

describe("split preview language", function () {
  it("provides Chinese as the explicit default UI language", function () {
    assert.equal(splitPlanText("zh-CN", "dialog-metadata-none"), "未匹配");
    assert.include(splitPlanText("zh-CN", "dialog-guidance"), "DOI");
  });

  it("switches labels and interpolates values in English", function () {
    assert.equal(splitPlanText("en-US", "dialog-col-status"), "Item status");
    assert.equal(
      splitPlanText("en-US", "dialog-metadata-confidence", {
        confidence: 98,
      }),
      "98% match",
    );
  });
});
