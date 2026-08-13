import { assert } from "chai";
import { inspectLoadedPdf } from "../src/modules/pdf/inspection";

describe("PDF inspection", function () {
  it("collects outline, labels, page count, and fingerprint from one document", async function () {
    const pageRef = { num: 1 };
    const doc = {
      numPages: 4,
      fingerprints: ["PDF-HASH"],
      async getOutline() {
        return [{ title: "Chapter 1", dest: [pageRef] }];
      },
      async getPageIndex(ref: unknown) {
        assert.strictEqual(ref, pageRef);
        return 1;
      },
      async getPageLabels() {
        return ["i", "1", "2", "3"];
      },
    };

    const result = await inspectLoadedPdf(doc, { maxLevel: 2 });

    assert.deepEqual(result, {
      totalPages: 4,
      fingerprint: "PDF-HASH",
      pageLabels: ["i", "1", "2", "3"],
      authorCandidates: [null],
      chapterPageAuthorCandidates: [null],
      chapters: [
        {
          title: "Chapter 1",
          level: 1,
          startPage: 1,
          endPage: 3,
        },
      ],
    });
  });

  it("falls back cleanly when the PDF has no page labels", async function () {
    const result = await inspectLoadedPdf({
      numPages: 1,
      fingerprints: [],
      getOutline: async () => [],
      getPageLabels: async () => {
        throw new Error("missing labels");
      },
    });

    assert.equal(result.fingerprint, "pages-1");
    assert.deepEqual(result.pageLabels, []);
    assert.deepEqual(result.authorCandidates, []);
    assert.deepEqual(result.chapterPageAuthorCandidates, []);
  });

  it("extracts unconfirmed author candidates from bookmarked contents pages", async function () {
    const contentsRef = { num: 1 };
    const chapterRef = { num: 2 };
    const result = await inspectLoadedPdf({
      numPages: 4,
      fingerprints: ["PDF-TOC"],
      getOutline: async () => [
        { title: "Contents", dest: [contentsRef] },
        {
          title: "33 Eye-tracking studies in conference interpreting",
          dest: [chapterRef],
        },
      ],
      getPageIndex: async (ref: unknown) => (ref === contentsRef ? 0 : 2),
      getPageLabels: async () => ["vii", "viii", "457", "458"],
      getPage: async (page: number) => ({
        getTextContent: async () => ({
          items:
            page === 1
              ? [
                  {
                    str: "33 Eye-tracking studies in conference interpreting 457",
                    transform: [1, 0, 0, 1, 20, 700],
                    hasEOL: true,
                  },
                  {
                    str: "Agnieszka Chmiel",
                    transform: [1, 0, 0, 1, 20, 680],
                    hasEOL: true,
                  },
                ]
              : [],
        }),
        cleanup() {},
      }),
    });

    assert.equal(result.authorCandidates[1]?.rawText, "Agnieszka Chmiel");
    assert.equal(result.authorCandidates[1]?.pageIndex, 0);
  });

  it("extracts a byline from the first two physical pages of a chapter", async function () {
    const chapterRef = { num: 1 };
    const requestedPages: number[] = [];
    const result = await inspectLoadedPdf({
      numPages: 5,
      fingerprints: ["PDF-BYLINE"],
      getOutline: async () => [
        {
          title: "33 Eye-tracking studies in conference interpreting",
          dest: [chapterRef],
        },
      ],
      getPageIndex: async () => 2,
      getPageLabels: async () => ["i", "ii", "457", "458", "459"],
      getPage: async (page: number) => {
        requestedPages.push(page);
        return {
          getTextContent: async () => ({
            items:
              page === 3
                ? [
                    {
                      str: "33 Eye-tracking studies in conference interpreting",
                      transform: [1, 0, 0, 1, 20, 700],
                      hasEOL: true,
                    },
                    {
                      str: "By Agnieszka Chmiel",
                      transform: [1, 0, 0, 1, 20, 670],
                      hasEOL: true,
                    },
                  ]
                : [],
          }),
          cleanup() {},
        };
      },
    });

    assert.equal(
      result.chapterPageAuthorCandidates[0]?.rawText,
      "By Agnieszka Chmiel",
    );
    assert.deepEqual(requestedPages, [3, 4]);
  });
});
