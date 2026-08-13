import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import {
  getDocument,
  GlobalWorkerOptions,
} from "pdfjs-dist/legacy/build/pdf.mjs";

const require = createRequire(import.meta.url);
// Point pdfjs at its own worker file so it can run in Node.
GlobalWorkerOptions.workerSrc =
  require.resolve("pdfjs-dist/legacy/build/pdf.worker.mjs");

const bytes = new Uint8Array(readFileSync(process.argv[2]));
const doc = await getDocument({
  data: bytes,
  useWorkerFetch: false,
  isEvalSupported: false,
}).promise;

console.log(`Pages: ${doc.numPages}`);

const outline = await doc.getOutline();
console.log(`Top-level outline items: ${outline.length}`);

let total = 0;
let resolved = 0;
const show = async (items, depth) => {
  for (const item of items) {
    let dest = item.dest;
    if (typeof dest === "string") dest = await doc.getDestination(dest);
    let pageIdx = -1;
    if (Array.isArray(dest) && dest[0]) {
      try {
        pageIdx = await doc.getPageIndex(dest[0]);
      } catch {}
    }
    total++;
    if (pageIdx >= 0) resolved++;
    if (total <= 30) {
      const t = (item.title || "").toString().slice(0, 60);
      console.log(`${"  ".repeat(depth)}L${depth} "${t}" -> page ${pageIdx}`);
    }
    if (item.items && item.items.length) await show(item.items, depth + 1);
  }
};
await show(outline, 0);
console.log(`\nresolved ${resolved}/${total} outline items to a page`);
await doc.destroy();
