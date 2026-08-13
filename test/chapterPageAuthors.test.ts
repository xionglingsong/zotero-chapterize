import { assert } from "chai";
import {
  findChapterPageAuthorCandidate,
  readChapterPageAuthorCandidatesFromDocument,
} from "../src/modules/pdf/chapterPageAuthors";

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

  it("anchors a title split across three lines before reading the byline", function () {
    const candidate = findChapterPageAuthorCandidate(
      [
        { pageIndex: 182, text: "33" },
        { pageIndex: 182, text: "Eye-tracking studies in" },
        { pageIndex: 182, text: "conference interpreting" },
        { pageIndex: 182, text: "Agnieszka Chmiel" },
      ],
      "33 Eye-tracking studies in conference interpreting",
    );

    assert.equal(candidate?.rawText, "Agnieszka Chmiel");
    assert.deepEqual(candidate?.creators, [
      {
        creatorType: "author",
        firstName: "Agnieszka",
        lastName: "Chmiel",
      },
    ]);
  });

  it("joins a name split into adjacent PDF text lines", function () {
    const candidate = findChapterPageAuthorCandidate(
      [
        { pageIndex: 50, text: "Working memory in interpreting" },
        { pageIndex: 50, text: "Agnieszka" },
        { pageIndex: 50, text: "Chmiel" },
        { pageIndex: 50, text: "Jagiellonian University" },
      ],
      "Working memory in interpreting",
    );

    assert.equal(candidate?.rawText, "Agnieszka Chmiel");
    assert.deepEqual(candidate?.creators, [
      {
        creatorType: "author",
        firstName: "Agnieszka",
        lastName: "Chmiel",
      },
    ]);
  });

  it("removes trailing affiliation markers from a byline", function () {
    const candidate = findChapterPageAuthorCandidate(
      [
        { pageIndex: 70, text: "Eye-tracking studies" },
        { pageIndex: 70, text: "By Agnieszka Chmiel 1,*" },
      ],
      "Eye-tracking studies",
    );

    assert.equal(candidate?.rawText, "By Agnieszka Chmiel 1,*");
    assert.deepEqual(candidate?.creators, [
      {
        creatorType: "author",
        firstName: "Agnieszka",
        lastName: "Chmiel",
      },
    ]);
  });

  it("does not join an affiliation into the author name", function () {
    const candidate = findChapterPageAuthorCandidate(
      [
        { pageIndex: 90, text: "Interpreting expertise" },
        { pageIndex: 90, text: "Agnieszka Chmiel" },
        { pageIndex: 90, text: "Jagiellonian University" },
      ],
      "Interpreting expertise",
    );

    assert.equal(candidate?.rawText, "Agnieszka Chmiel");
    assert.lengthOf(candidate?.creators ?? [], 1);
  });

  it("does not anchor on a partial title and treat its remainder as an author", function () {
    const candidate = findChapterPageAuthorCandidate(
      [
        { pageIndex: 92, text: "Eye-tracking Studies" },
        { pageIndex: 92, text: "Conference Interpreting" },
        { pageIndex: 92, text: "Agnieszka Chmiel" },
      ],
      "Eye-tracking Studies Conference Interpreting",
    );

    assert.equal(candidate?.rawText, "Agnieszka Chmiel");
  });

  it("does not use an institution when no author byline is present", function () {
    assert.isNull(
      findChapterPageAuthorCandidate(
        [
          { pageIndex: 93, text: "Interpreting expertise" },
          { pageIndex: 93, text: "Jagiellonian University" },
          { pageIndex: 93, text: "Abstract" },
        ],
        "Interpreting expertise",
      ),
    );
  });

  it("collects multiple authors printed on separate lines", function () {
    const candidate = findChapterPageAuthorCandidate(
      [
        { pageIndex: 94, text: "Technology-mediated interpreting" },
        { pageIndex: 94, text: "Agnieszka Chmiel" },
        { pageIndex: 94, text: "Franz Pochhacker" },
        { pageIndex: 94, text: "University of Vienna" },
      ],
      "Technology-mediated interpreting",
    );

    assert.equal(candidate?.rawText, "Agnieszka Chmiel; Franz Pochhacker");
    assert.deepEqual(candidate?.creators, [
      {
        creatorType: "author",
        firstName: "Agnieszka",
        lastName: "Chmiel",
      },
      {
        creatorType: "author",
        firstName: "Franz",
        lastName: "Pochhacker",
      },
    ]);
  });

  it("scans an unnumbered content bookmark but skips front matter", async function () {
    const candidates = await readChapterPageAuthorCandidatesFromDocument(
      {
        getPage: async (page: number) => ({
          getTextContent: async () => ({
            items:
              page === 2
                ? [
                    {
                      str: "Working memory in interpreting",
                      transform: [1, 0, 0, 1, 20, 700],
                      hasEOL: true,
                    },
                    {
                      str: "Agnieszka Chmiel",
                      transform: [1, 0, 0, 1, 20, 670],
                      hasEOL: true,
                    },
                  ]
                : [],
          }),
          cleanup() {},
        }),
      },
      [
        { title: "Contents", level: 1, startPage: 0, endPage: 0 },
        {
          title: "Working memory in interpreting",
          level: 1,
          startPage: 1,
          endPage: 2,
        },
      ],
    );

    assert.isNull(candidates[0]);
    assert.equal(candidates[1]?.rawText, "Agnieszka Chmiel");
  });
});
