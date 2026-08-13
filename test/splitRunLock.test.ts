import { assert } from "chai";
import {
  makeSplitRunKey,
  releaseSplitRun,
  tryAcquireSplitRun,
} from "../src/modules/splitRunLock";

describe("split run lock", function () {
  it("allows only one active run for the same library item", function () {
    const key = makeSplitRunKey(2, 10);

    assert.isTrue(tryAcquireSplitRun(key));
    assert.isFalse(tryAcquireSplitRun(key));
    releaseSplitRun(key);
    assert.isTrue(tryAcquireSplitRun(key));
    releaseSplitRun(key);
  });
});
