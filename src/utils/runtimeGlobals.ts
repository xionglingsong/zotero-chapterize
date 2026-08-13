const browserConstructors = [
  "DOMMatrix",
  "DOMMatrixReadOnly",
  "DOMRect",
  "DOMRectReadOnly",
  "DOMPoint",
  "DOMPointReadOnly",
  "DOMQuad",
  "Path2D",
  "ImageData",
  "ImageBitmap",
  "OffscreenCanvas",
  "HTMLCanvasElement",
  "CanvasRenderingContext2D",
  "AbortController",
  "AbortSignal",
  "Event",
  "EventTarget",
  "MessageEvent",
] as const;

const browserFunctions = ["structuredClone"] as const;

/** Borrow browser globals from a chrome window for libraries in the sandbox. */
export function installBrowserGlobals(target: any, win: any): void {
  if (target.console === undefined && win.console !== undefined) {
    target.console = win.console;
  }
  for (const name of browserConstructors) {
    if (target[name] === undefined && typeof win[name] !== "undefined") {
      target[name] = win[name];
    }
  }
  for (const name of browserFunctions) {
    if (target[name] === undefined && typeof win[name] === "function") {
      target[name] = win[name].bind(win);
    }
  }
  if (target.window === undefined) target.window = win;
  if (target.self === undefined) target.self = target;
  if (target.document === undefined && win.document)
    target.document = win.document;
  if (target.navigator === undefined && win.navigator) {
    target.navigator = win.navigator;
  }
}
