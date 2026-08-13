import { assert } from "chai";
import {
  activeProgressOptions,
  completionProgressType,
} from "../src/modules/progress";

describe("progress behavior", function () {
  it("keeps active jobs open and non-dismissible", function () {
    assert.deepEqual(activeProgressOptions(), {
      closeOnClick: false,
      closeTime: -1,
    });
  });

  it("marks any partial failure as failed", function () {
    assert.equal(completionProgressType(0), "success");
    assert.equal(completionProgressType(1), "fail");
  });
});
