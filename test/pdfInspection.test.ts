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
  });
});
