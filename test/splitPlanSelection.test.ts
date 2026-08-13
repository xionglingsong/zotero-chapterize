import { assert } from "chai";
import {
  cleanChapterTitle,
  isLikelyChapterTitle,
  recommendedRangeEndPages,
  recommendedSplitSelection,
} from "../src/modules/splitPlanSelection";

describe("split plan recommendations", function () {
  it("removes English and Chinese chapter-number prefixes", function () {
    assert.equal(
      cleanChapterTitle("Chapter 5: Research methods"),
      "Research methods",
    );
    assert.equal(cleanChapterTitle("Ch. IV — Results"), "Results");
    assert.equal(cleanChapterTitle("第五章 研究方法"), "研究方法");
  });

  it("keeps a chapter number when no real title follows it", function () {
    assert.equal(cleanChapterTitle("Chapter 5"), "Chapter 5");
    assert.equal(cleanChapterTitle("第五章"), "第五章");
  });

  it("selects numbered chapters and excludes front matter and part dividers", function () {
    const entries = [
      { title: "Cover" },
      { title: "Table of Contents" },
      { title: "Part I: Introduction and overview" },
      { title: "Chapter 1: Interfaces of translation" },
      { title: "Chapter 2: The bilingual profile" },
    ];

    assert.deepEqual(recommendedSplitSelection(entries), [
      false,
      false,
      false,
      true,
      true,
    ]);
  });

  it("recognizes Chinese chapter titles and standalone introductions", function () {
    assert.isTrue(isLikelyChapterTitle("第一章 研究背景"));
    assert.isTrue(isLikelyChapterTitle("Introduction"));
    assert.isTrue(isLikelyChapterTitle("引言"));
    assert.isFalse(isLikelyChapterTitle("第一部分 理论基础"));
  });

  it("keeps ordinary content titles when the PDF has no numbered chapters", function () {
    const entries = [
      { title: "Copyright" },
      { title: "Introduction" },
      { title: "Translation and society" },
      { title: "Language policy" },
    ];

    assert.deepEqual(recommendedSplitSelection(entries), [
      false,
      true,
      true,
      true,
    ]);
  });

  it("never recommends an empty plan", function () {
    assert.deepEqual(
      recommendedSplitSelection([{ title: "Cover" }, { title: "版权页" }]),
      [true, true],
    );
  });

  it("extends a recommended chapter across nested bookmarks", function () {
    const entries = [
      { level: 1, startPage: 0, endPage: 3 },
      { level: 2, startPage: 4, endPage: 9 },
      { level: 2, startPage: 10, endPage: 19 },
      { level: 1, startPage: 20, endPage: 29 },
    ];

    assert.deepEqual(
      recommendedRangeEndPages(entries, [true, false, false, true], 30),
      [19, 9, 19, 29],
    );
  });

  it("stops a nested chapter before the next parent divider", function () {
    const entries = [
      { level: 1, startPage: 0, endPage: 1 },
      { level: 2, startPage: 2, endPage: 4 },
      { level: 3, startPage: 5, endPage: 9 },
      { level: 1, startPage: 10, endPage: 11 },
      { level: 2, startPage: 12, endPage: 19 },
    ];

    assert.deepEqual(
      recommendedRangeEndPages(entries, [false, true, false, false, true], 20),
      [1, 9, 9, 11, 19],
    );
  });

  it("does not overlap selected parent and child entries", function () {
    const entries = [
      { level: 1, startPage: 0, endPage: 3 },
      { level: 2, startPage: 4, endPage: 9 },
      { level: 3, startPage: 10, endPage: 14 },
      { level: 1, startPage: 15, endPage: 19 },
    ];

    assert.deepEqual(
      recommendedRangeEndPages(entries, [true, true, false, true], 20),
      [3, 14, 14, 19],
    );
  });
});
