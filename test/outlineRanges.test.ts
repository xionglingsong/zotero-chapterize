import { assert } from "chai";
import { buildChapterRanges } from "../src/modules/pdf/outline";

describe("PDF outline ranges", function () {
  it("sorts out-of-order bookmarks and never overlaps nested starts", function () {
    const chapters = buildChapterRanges(
      [
        { title: "Chapter 2", level: 1, page: 10 },
        { title: "Chapter 1", level: 1, page: 0 },
        { title: "Section 1.1", level: 2, page: 0 },
        { title: "Section 1.2", level: 2, page: 5 },
      ],
      20,
    );

    assert.deepEqual(chapters, [
      {
        title: "Chapter 1",
        level: 1,
        startPage: 0,
        endPage: 4,
      },
      {
        title: "Section 1.2",
        level: 2,
        startPage: 5,
        endPage: 9,
      },
      { title: "Chapter 2", level: 1, startPage: 10, endPage: 19 },
    ]);
  });

  it("prefers a chapter over a part divider at the same page", function () {
    const chapters = buildChapterRanges(
      [
        { title: "Part I", level: 1, page: 5 },
        { title: "Chapter 1: Foundations", level: 2, page: 5 },
        { title: "Chapter 2: Methods", level: 2, page: 10 },
      ],
      20,
    );

    assert.deepEqual(
      chapters.map(({ title, startPage, endPage }) => ({
        title,
        startPage,
        endPage,
      })),
      [
        { title: "Chapter 1: Foundations", startPage: 5, endPage: 9 },
        { title: "Chapter 2: Methods", startPage: 10, endPage: 19 },
      ],
    );
  });
});
