import { assert } from "chai";
import { PDFDocument } from "pdf-lib";
import {
  awaitPdfLoadingTask,
  installPdfWorkerHandler,
  loadPdfDoc,
  releasePdfDoc,
} from "../src/modules/pdf/pdfjs";

describe("PDF.js lifecycle", function () {
  it("installs the bundled worker handler without discarding other globals", function () {
    const handler = { setup() {} };
    const target = { pdfjsWorker: { existing: true } };

    installPdfWorkerHandler(target, handler);

    assert.isTrue(target.pdfjsWorker.existing);
    assert.strictEqual(target.pdfjsWorker.WorkerMessageHandler, handler);
  });

  it("rejects a missing bundled worker handler", function () {
    assert.throws(
      () => installPdfWorkerHandler({}, undefined),
      "The bundled PDF.js worker handler is unavailable.",
    );
  });

  it("parses a PDF through the bundled main-thread worker", async function () {
    const globals = globalThis as any;
    const originalDOMMatrix = globals.DOMMatrix;
    const originalPath2D = globals.Path2D;
    const originalImageData = globals.ImageData;
    const originalToHex = globals.Uint8Array.prototype.toHex;
    globals.DOMMatrix = class DOMMatrix {};
    globals.Path2D = class Path2D {};
    globals.ImageData = class ImageData {};
    globals.Uint8Array.prototype.toHex = function () {
      return Array.from(this as Uint8Array, (byte) =>
        byte.toString(16).padStart(2, "0"),
      ).join("");
    };

    const source = await PDFDocument.create();
    source.addPage([100, 100]);
    const bytes = await source.save();

    try {
      const doc = await loadPdfDoc(bytes);
      try {
        assert.equal(doc.numPages, 1);
      } finally {
        await releasePdfDoc(doc);
      }
    } finally {
      globals.DOMMatrix = originalDOMMatrix;
      globals.Path2D = originalPath2D;
      globals.ImageData = originalImageData;
      globals.Uint8Array.prototype.toHex = originalToHex;
    }
  });

  it("destroys a loading task when parsing rejects", async function () {
    const failure = new Error("invalid PDF");
    let destroyed = false;
    const task = {
      promise: Promise.reject(failure),
      async destroy() {
        destroyed = true;
      },
    };

    let caught: unknown;
    try {
      await awaitPdfLoadingTask(task);
    } catch (error) {
      caught = error;
    }

    assert.strictEqual(caught, failure);
    assert.isTrue(destroyed);
  });

  it("cleans up the document and destroys its loading task", async function () {
    const calls: string[] = [];
    const doc = {
      async cleanup() {
        calls.push("cleanup");
      },
      loadingTask: {
        async destroy() {
          calls.push("destroy");
        },
      },
    };

    await releasePdfDoc(doc);

    assert.deepEqual(calls, ["cleanup", "destroy"]);
  });
});
