import { assert } from "chai";
import {
  fallbackPdfFingerprint,
  pdfIdentityFromDocument,
  printedRange,
  readPageLabelsFromDocument,
} from "../src/modules/pdf/pageLabels";

describe("PDF page labels", function () {
  it("formats printed labels for ranges and single pages", function () {
    const labels = ["i", "ii", "1", "2"];

    assert.equal(printedRange(labels, 0, 1), "i-ii");
    assert.equal(printedRange(labels, 2, 2), "1");
  });

  it("falls back to one-based physical pages without labels", function () {
    assert.equal(printedRange([], 2, 4), "3-5");
  });

  it("normalizes missing labels and fingerprints", async function () {
    assert.deepEqual(
      await readPageLabelsFromDocument({ getPageLabels: async () => null }),
      [],
    );
    assert.deepEqual(pdfIdentityFromDocument({ numPages: 8 }), {
      totalPages: 8,
      fingerprint: "pages-8",
    });
  });

  it("distinguishes replacement PDFs when PDF.js omits fingerprints", function () {
    const first = fallbackPdfFingerprint(new Uint8Array([1, 2, 3, 4]));
    const replacement = fallbackPdfFingerprint(new Uint8Array([1, 2, 3, 5]));

    assert.notEqual(first, replacement);
    assert.equal(first, fallbackPdfFingerprint(new Uint8Array([1, 2, 3, 4])));
  });
});
