import { assert } from "chai";
import { installBrowserGlobals } from "../src/utils/runtimeGlobals";

describe("PDF runtime globals", function () {
  it("borrows console from the Zotero chrome window", function () {
    const sandbox: Record<string, unknown> = {};
    const windowConsole = { warn() {}, error() {}, info() {} };

    installBrowserGlobals(sandbox, { console: windowConsole });

    assert.strictEqual(sandbox.console, windowConsole);
  });

  it("borrows the same-realm cancellation globals used by PDF.js", function () {
    class WindowAbortController {}
    class WindowAbortSignal {}
    const sandbox: Record<string, unknown> = {};
    const win = {
      AbortController: WindowAbortController,
      AbortSignal: WindowAbortSignal,
      structuredClone(value: unknown) {
        assert.strictEqual(this, win);
        return value;
      },
    };

    installBrowserGlobals(sandbox, win);

    assert.strictEqual(sandbox.AbortController, WindowAbortController);
    assert.strictEqual(sandbox.AbortSignal, WindowAbortSignal);
    assert.deepEqual(
      (sandbox.structuredClone as (value: unknown) => unknown)({ ok: true }),
      { ok: true },
    );
  });

  it("does not replace globals already supplied by the sandbox", function () {
    const existing = class ExistingAbortController {};
    const sandbox = { AbortController: existing };

    installBrowserGlobals(sandbox, {
      AbortController: class WindowAbortController {},
    });

    assert.strictEqual(sandbox.AbortController, existing);
  });
});
