import { assert } from "chai";
import {
  findTocAuthorCandidates,
  parseCreatorNames,
} from "../src/modules/pdf/tocAuthors";

describe("table of contents author candidates", function () {
  it("anchors an author line to the matching chapter title", function () {
    const candidates = findTocAuthorCandidates(
      [
        { pageIndex: 7, text: "32 Interpreting expertise 441" },
        { pageIndex: 7, text: "Elisabet Tiselius" },
        {
          pageIndex: 7,
          text: "33 Eye-tracking studies in conference interpreting 457",
        },
        { pageIndex: 7, text: "Agnieszka Chmiel" },
        { pageIndex: 7, text: "34 Technology-mediated interpreting 471" },
        { pageIndex: 7, text: "Franz Pochhacker" },
      ],
      [
        "32 Interpreting expertise",
        "33 Eye-tracking studies in conference interpreting",
        "34 Technology-mediated interpreting",
      ],
    );

    assert.deepEqual(candidates[1], {
      chapterTitle: "33 Eye-tracking studies in conference interpreting",
      creators: [
        {
          creatorType: "author",
          firstName: "Agnieszka",
          lastName: "Chmiel",
        },
      ],
      rawText: "Agnieszka Chmiel",
      pageIndex: 7,
      confidence: "medium",
    });
  });

  it("parses comma names and multiple natural-order names", function () {
    assert.deepEqual(parseCreatorNames("Chmiel, Agnieszka"), [
      {
        creatorType: "author",
        firstName: "Agnieszka",
        lastName: "Chmiel",
      },
    ]);
    assert.deepEqual(
      parseCreatorNames("Agnieszka Chmiel and Franz Pochhacker"),
      [
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
      ],
    );
  });

  it("rejects structural lines and does not borrow the next chapter title", function () {
    assert.deepEqual(parseCreatorNames("Part V Research methods"), []);
    const candidates = findTocAuthorCandidates(
      [
        { pageIndex: 4, text: "1 Introduction 1" },
        { pageIndex: 4, text: "2 Research methods 17" },
        { pageIndex: 4, text: "Jane Smith" },
      ],
      ["1 Introduction", "2 Research methods"],
    );
    assert.isNull(candidates[0]);
    assert.equal(candidates[1]?.rawText, "Jane Smith");
  });

  it("handles wrapped titles and same-line authors", function () {
    const wrapped = findTocAuthorCandidates(
      [
        { pageIndex: 8, text: "33 Eye-tracking studies in conference" },
        { pageIndex: 8, text: "interpreting 457" },
        { pageIndex: 8, text: "Agnieszka Chmiel" },
      ],
      ["33 Eye-tracking studies in conference interpreting"],
    );
    assert.equal(wrapped[0]?.rawText, "Agnieszka Chmiel");

    const sameLine = findTocAuthorCandidates(
      [
        {
          pageIndex: 8,
          text: "33 Eye-tracking studies in conference interpreting 457 Agnieszka Chmiel",
        },
      ],
      ["33 Eye-tracking studies in conference interpreting"],
    );
    assert.equal(sameLine[0]?.rawText, "Agnieszka Chmiel");
  });
});
