import { assert } from "chai";
import {
  chooseCrossRefMatch,
  mapCrossRefMessage,
  normalizeDoiInput,
} from "../src/modules/crossref";

const eyeTrackingChapter = {
  title: ["Eye-tracking studies  in conference interpreting"],
  author: [{ given: "Agnieszka", family: "Chmiel" }],
  "container-title": ["The Routledge Handbook of Conference Interpreting"],
  issued: { "date-parts": [[2021, 11, 18]] },
  page: "457-470",
  publisher: "Routledge",
  ISBN: ["9780429297878"],
  DOI: "10.4324/9780429297878-40",
  URL: "https://doi.org/10.4324/9780429297878-40",
  language: "en",
  type: "book-chapter",
};

describe("Crossref chapter matching", function () {
  it("normalizes DOI labels and resolver URLs pasted by users", function () {
    assert.equal(
      normalizeDoiInput(" https://doi.org/10.4324/9780429297878-40 "),
      "10.4324/9780429297878-40",
    );
    assert.equal(
      normalizeDoiInput("DOI: 10.4324/9780429297878-40"),
      "10.4324/9780429297878-40",
    );
  });

  it("maps chapter authors and citation fields without using book editors", function () {
    assert.deepInclude(mapCrossRefMessage(eyeTrackingChapter), {
      title: "Eye-tracking studies in conference interpreting",
      pages: "457-470",
      date: "2021-11-18",
      doi: "10.4324/9780429297878-40",
      url: "https://doi.org/10.4324/9780429297878-40",
      libraryCatalog: "DOI.org (Crossref)",
    });
    assert.deepEqual(mapCrossRefMessage(eyeTrackingChapter)?.creators, [
      {
        creatorType: "author",
        firstName: "Agnieszka",
        lastName: "Chmiel",
      },
    ]);
  });

  it("finds chapter 33 by its cleaned title with high confidence", function () {
    const match = chooseCrossRefMatch(
      "33 Eye-tracking studies in conference interpreting",
      "The Routledge Handbook of Conference Interpreting",
      [
        {
          ...eyeTrackingChapter,
          title: ["Unrelated chapter"],
          DOI: "10.0000/wrong",
        },
        eyeTrackingChapter,
      ],
    );

    assert.equal(match?.metadata.doi, "10.4324/9780429297878-40");
    assert.equal(match?.confidenceLevel, "high");
    assert.isAtLeast(match?.confidence ?? 0, 0.9);
  });
});
