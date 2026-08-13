import { assert } from "chai";
import {
  choosePdfAttachment,
  chooseSplitSelection,
  canWriteSplitTarget,
  chooseUsablePdfAttachment,
  hasChapterizeMarker,
  isReusableChapterizeSection,
  makeChapterizeMarker,
} from "../src/modules/zotero/itemsLogic";

describe("Zotero item selection and deduplication", function () {
  it("ignores a preferred HTML snapshot when a PDF is available", function () {
    const snapshot = { isPDFAttachment: () => false };
    const pdf = { isPDFAttachment: () => true };

    assert.strictEqual(choosePdfAttachment([snapshot, pdf]), pdf);
  });

  it("skips a missing PDF file when a later PDF is available", async function () {
    const missing = {
      isPDFAttachment: () => true,
      getFilePathAsync: async () => false as const,
    };
    const available = {
      isPDFAttachment: () => true,
      getFilePathAsync: async () => "/book.pdf",
    };

    const result = await chooseUsablePdfAttachment([missing, available]);

    assert.strictEqual(result?.attachment, available);
    assert.equal(result?.path, "/book.pdf");
  });

  it("accepts a book and its own selected PDF as one target", function () {
    const book = selectionItem(1, "book");
    const pdf = selectionItem(2, "attachment", book, true);

    assert.deepEqual(chooseSplitSelection([book, pdf]), {
      bookItem: book,
      pdfAttachment: pdf,
    });
  });

  it("rejects selections spanning multiple books", function () {
    const first = selectionItem(1, "book");
    const second = selectionItem(2, "book");

    assert.isNull(chooseSplitSelection([first, second]));
  });

  it("rejects a target when metadata or files are read-only", function () {
    const readOnly = selectionItem(1, "book", undefined, false, false, true);
    const filesReadOnly = selectionItem(
      2,
      "book",
      undefined,
      false,
      true,
      false,
    );

    assert.isFalse(canWriteSplitTarget(readOnly));
    assert.isFalse(canWriteSplitTarget(filesReadOnly));
  });

  it("does not treat a manual section as a Chapterize result", function () {
    const marker = makeChapterizeMarker("SOURCE1", 0, 9);

    assert.isFalse(hasChapterizeMarker("", marker));
    assert.isFalse(hasChapterizeMarker("User notes", marker));
    assert.isTrue(hasChapterizeMarker(`User notes\n${marker}`, marker));
  });

  it("does not reuse a marked section whose split PDF is missing", function () {
    const marker = makeChapterizeMarker("SOURCE1", 0, 9);

    assert.isFalse(isReusableChapterizeSection(marker, marker, false));
    assert.isTrue(isReusableChapterizeSection(marker, marker, true));
  });
});

function selectionItem(
  id: number,
  itemType: string,
  parentItem?: any,
  isPdf = false,
  editable = true,
  filesEditable = true,
): any {
  return {
    id,
    itemType,
    parentItem,
    isRegularItem: () => itemType !== "attachment",
    isAttachment: () => itemType === "attachment",
    isPDFAttachment: () => isPdf,
    isEditable: () => editable,
    library: { filesEditable },
  };
}
