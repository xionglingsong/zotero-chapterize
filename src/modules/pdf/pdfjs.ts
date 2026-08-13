import { installBrowserGlobals } from "../../utils/runtimeGlobals";

/**
 * pdfjs is loaded LAZILY (dynamic import), not at module top-level.
 *
 * Why: pdfjs-dist's top-level code references browser globals and must not run
 * during plugin startup inside Zotero's sandbox — otherwise the whole plugin
 * fails to load and the context menu never registers. By deferring to first
 * use, startup stays clean; if pdfjs then errors, it's caught by the caller and
 * surfaced as a normal progress error instead of killing the plugin.
 */

let pdfjsLib: any = null;

/**
 * The plugin sandbox is missing browser/DOM globals that pdfjs references
 * (DOMMatrix, Path2D, ImageData, window, document, …). The Zotero main window
 * is a real chrome window that has them, so we lend those into the sandbox
 * global before pdfjs runs. For outline/page-label reading (no rendering) this
 * is sufficient.
 */
function ensureBrowserGlobals(): void {
  const g = globalThis as any;
  let win: any = null;
  try {
    win = Zotero.getMainWindow();
  } catch {
    win = null;
  }
  if (!win) {
    try {
      win = ztoolkit.getGlobal("window");
    } catch {
      win = null;
    }
  }
  if (!win) return;

  installBrowserGlobals(g, win);
}

async function getPdfjs(): Promise<any> {
  ensureBrowserGlobals();
  if (!pdfjsLib) {
    // Zotero's plugin sandbox does not expose a standard Worker. Letting PDF.js
    // fall back by itself also fails because its dynamic module loader expects
    // a Gecko ScriptLoader that is unavailable in this context. Bundling the
    // handler installs PDF.js's supported main-thread loopback worker instead.
    const [library, worker] = await Promise.all([
      import("pdfjs-dist"),
      import("pdfjs-dist/build/pdf.worker.mjs"),
    ]);
    installPdfWorkerHandler(globalThis as any, worker.WorkerMessageHandler);
    pdfjsLib = library;
  }
  return pdfjsLib;
}

export function installPdfWorkerHandler(target: any, handler: any): void {
  if (!handler || typeof handler.setup !== "function") {
    throw new Error("The bundled PDF.js worker handler is unavailable.");
  }
  target.pdfjsWorker = {
    ...(target.pdfjsWorker ?? {}),
    WorkerMessageHandler: handler,
  };
}

/**
 * Load a PDF for outline/label reading via pdfjs. We hand pdfjs a COPY of the
 * bytes because pdfjs may transfer the underlying buffer to its worker
 * (detaching it); the caller still needs the original bytes for pdf-lib based
 * page splitting afterwards.
 */
export async function loadPdfDoc(bytes: Uint8Array) {
  const pdfjs = await getPdfjs();
  const task = pdfjs.getDocument({
    data: bytes.slice(0),
  });
  return awaitPdfLoadingTask(task);
}

/** Destroy rejected loading tasks, which never produce a document to release. */
export async function awaitPdfLoadingTask(task: {
  promise: Promise<any>;
  destroy(): Promise<void>;
}): Promise<any> {
  try {
    return await task.promise;
  } catch (error) {
    try {
      await task.destroy();
    } catch {
      // Preserve the PDF loading error; cleanup failure is secondary.
    }
    throw error;
  }
}

/** Release both per-document resources and the PDF.js worker/loading task. */
export async function releasePdfDoc(doc: any): Promise<void> {
  try {
    await doc.cleanup();
  } finally {
    await doc.loadingTask?.destroy();
  }
}
