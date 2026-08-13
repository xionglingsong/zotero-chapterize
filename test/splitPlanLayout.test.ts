import { assert } from "chai";
import { splitPlanTableLayout } from "../src/modules/splitPlanLayout";

describe("split preview table layout", function () {
  it("keeps the DOI controls aligned and page headers on one line", function () {
    assert.deepEqual(splitPlanTableLayout, {
      doiWidth: 304,
      pageWidth: 104,
      headerWhiteSpace: "nowrap",
      stickyTitleDivider: false,
      controlMargin: 0,
    });
  });
});
