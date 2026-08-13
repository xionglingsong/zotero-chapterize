import { assert } from "chai";
import {
  formatSplitPlan,
  normalizeSplitPlan,
  parseSplitPlan,
  summarizeSplitPlan,
  validateSplitPlan,
} from "../src/modules/pdf/ranges";

describe("split plan parsing", function () {
  it("parses titled physical page ranges", function () {
    const result = parseSplitPlan(
      "Intro: 1-3; Chapter 1: 4-20\nChapter 2: 21",
      30,
    );

    assert.deepEqual(result.errors, []);
    assert.deepEqual(
      result.entries.map((entry) => ({
        title: entry.title,
        startPage: entry.startPage,
        endPage: entry.endPage,
      })),
      [
        { title: "Intro", startPage: 0, endPage: 2 },
        { title: "Chapter 1", startPage: 3, endPage: 19 },
        { title: "Chapter 2", startPage: 20, endPage: 20 },
      ],
    );
  });

  it("reports out-of-bounds and overlapping ranges", function () {
    const result = parseSplitPlan("A: 1-5; B: 5-11", 10);

    assert.lengthOf(result.errors, 2);
    assert.include(result.errors[0], "exceeds PDF length");
    assert.include(result.errors[1], "overlaps");
  });

  it("formats ranges for prompt editing", function () {
    const result = parseSplitPlan("A: 1-5; B: 6-10", 10);

    assert.equal(formatSplitPlan(result.entries), "A: 1-5; B: 6-10");
  });

  it("validates titles, bounds, and overlaps with row references", function () {
    const issues = validateSplitPlan(
      [
        { title: "A", level: 1, startPage: 0, endPage: 4 },
        { title: "", level: 1, startPage: 4, endPage: 8 },
        { title: "C", level: 1, startPage: 9, endPage: 12 },
      ],
      10,
    );

    assert.deepInclude(issues, { code: "empty-title", index: 1 });
    assert.deepInclude(issues, {
      code: "overlap",
      index: 1,
      relatedIndex: 0,
    });
    assert.deepInclude(issues, { code: "out-of-bounds", index: 2 });
  });

  it("flags every range nested inside a longer earlier range", function () {
    const issues = validateSplitPlan(
      [
        { title: "Outer", level: 1, startPage: 0, endPage: 9 },
        { title: "Inner A", level: 1, startPage: 1, endPage: 2 },
        { title: "Inner B", level: 1, startPage: 3, endPage: 4 },
      ],
      10,
    );

    assert.deepInclude(issues, {
      code: "overlap",
      index: 1,
      relatedIndex: 0,
    });
    assert.deepInclude(issues, {
      code: "overlap",
      index: 2,
      relatedIndex: 0,
    });
  });

  it("normalizes order and summarizes intentionally omitted pages", function () {
    const normalized = normalizeSplitPlan([
      { title: " B ", level: 1, startPage: 5, endPage: 7 },
      { title: "A", level: 1, startPage: 1, endPage: 3 },
    ]);

    assert.deepEqual(
      normalized.map(({ title, startPage }) => ({ title, startPage })),
      [
        { title: "A", startPage: 1 },
        { title: "B", startPage: 5 },
      ],
    );
    assert.deepEqual(summarizeSplitPlan(normalized, 10), {
      sectionCount: 2,
      coveredPages: 6,
      omittedPages: 4,
    });
  });
});
