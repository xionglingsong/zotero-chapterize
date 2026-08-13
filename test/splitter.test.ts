import { assert } from "chai";
import { PDFDocument } from "pdf-lib";
import {
  assertPdfIsSplittable,
  createPdfPageSplitter,
  EncryptedPdfUnsupportedError,
  isEncryptedPdfError,
} from "../src/modules/pdf/splitter";

describe("PDF splitter", function () {
  it("rejects encrypted input instead of producing an unsafe output", function () {
    assert.throws(
      () => assertPdfIsSplittable({ isEncrypted: true }),
      EncryptedPdfUnsupportedError,
    );
    assert.isTrue(isEncryptedPdfError({ name: "PasswordException" }));
  });

  it("creates multiple ranges from one reusable source", async function () {
    const source = await PDFDocument.create();
    source.addPage();
    source.addPage();
    source.addPage();
    const split = await createPdfPageSplitter(await source.save());

    const first = await PDFDocument.load(await split(0, 0));
    const second = await PDFDocument.load(await split(1, 2));

    assert.equal(first.getPageCount(), 1);
    assert.equal(second.getPageCount(), 2);
  });
});
