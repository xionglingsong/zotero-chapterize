import { assert } from "chai";
import { findChapterPageAuthorCandidate } from "../src/modules/pdf/chapterPageAuthors";

describe("chapter first-page author candidates", function () {
  it("extracts a byline only when it follows the matching chapter title", function () {
    const candidate = findChapterPageAuthorCandidate(
      [
        { pageIndex: 182, text: "33 Eye-tracking studies in conference" },
        { pageIndex: 182, text: "interpreting" },
        { pageIndex: 182, text: "By Agnieszka Chmiel" },
        { pageIndex: 182, text: "This chapter reviews eye-tracking research." },
      ],
      "33 Eye-tracking studies in conference interpreting",
    );

    assert.deepEqual(candidate, {
      chapterTitle: "33 Eye-tracking studies in conference interpreting",
      creators: [
        {
          creatorType: "author",
          firstName: "Agnieszka",
          lastName: "Chmiel",
        },
      ],
      rawText: "By Agnieszka Chmiel",
      pageIndex: 182,
      confidence: "medium",
    });
  });

  it("rejects editor labels and prose that are not chapter bylines", function () {
    assert.isNull(
      findChapterPageAuthorCandidate(
        [
          { pageIndex: 20, text: "Research methods" },
          { pageIndex: 20, text: "Edited by Michaela Albl-Mikasa" },
          {
            pageIndex: 20,
            text: "Agnieszka Chmiel examines eye-tracking in this chapter.",
          },
        ],
        "Research methods",
      ),
    );
  });

  it("does not use a name when the chapter title is absent", function () {
    assert.isNull(
      findChapterPageAuthorCandidate(
        [{ pageIndex: 33, text: "By Agnieszka Chmiel" }],
        "Eye-tracking studies in conference interpreting",
      ),
    );
  });

  it("does not mistake a short section heading for an unmarked byline", function () {
    assert.isNull(
      findChapterPageAuthorCandidate(
        [
          { pageIndex: 12, text: "Interpreting technology" },
          { pageIndex: 12, text: "Research Methods" },
          { pageIndex: 12, text: "Introduction" },
        ],
        "Interpreting technology",
      ),
    );
  });
});
