// Deep diagnostic v3: fix size() method usage, flatten /Names/Dests name tree,
// and try resolving the sample named destinations.
import { readFileSync } from "node:fs";
import { PDFDocument, PDFName, PDFHexString } from "pdf-lib";

const path = process.argv[2];
const bytes = readFileSync(path);
const doc = await PDFDocument.load(bytes, {
  updateMetadata: false,
  ignoreEncryption: true,
});
const ctx = doc.context;
const catalog = doc.catalog;

const pageIndexOf = new Map();
doc.getPages().forEach((p, i) => {
  if (p.ref && typeof p.ref.objectNumber === "number") {
    pageIndexOf.set(p.ref.objectNumber, i);
  }
});
console.log(`Pages: ${doc.getPages().length}`);

// Decode a pdf-lib string (name/value) to JS string
const dec = (s) => {
  if (!s) return "";
  if (s instanceof PDFHexString) {
    const hex = s.value ?? "";
    const out = [];
    for (let i = 0; i + 1 < hex.length; i += 2)
      out.push(parseInt(hex.slice(i, i + 2), 16));
    if (out[0] === 0xfe && out[1] === 0xff) {
      let r = "";
      for (let i = 2; i + 1 < out.length; i += 2)
        r += String.fromCharCode((out[i] << 8) | out[i + 1]);
      return r;
    }
    return out.map((b) => String.fromCharCode(b)).join("");
  }
  return typeof s.value === "string" ? s.value : String(s);
};

// Flatten the /Names/Dests name tree -> Map<nameString, pageIndex>
const names = ctx.lookup(catalog.get(PDFName.of("Names")));
const destsRoot =
  names && typeof names.get === "function"
    ? ctx.lookup(names.get(PDFName.of("Dests")))
    : null;
const nameToPage = new Map();
const flatSize = (node) => {
  const n = ctx.lookup(node);
  if (!n || typeof n.get !== "function") return;
  const nums = n.get(PDFName.of("Nums"));
  if (nums && typeof nums.size === "function") {
    for (let i = 0; i + 1 < nums.size(); i += 2) {
      const nameStr = dec(ctx.lookup(nums.get(i)));
      const val = ctx.lookup(nums.get(i + 1)); // array [pageRef, /Fit] or dict
      let arr = val;
      if (
        val &&
        typeof val.get === "function" &&
        !typeof val.size === "function"
      ) {
        // could be a dict with /D
        const d = val.get(PDFName.of("D"));
        if (d) arr = ctx.lookup(d);
      }
      let pidx = -1;
      if (arr && typeof arr.size === "function" && arr.size() > 0) {
        const first = arr.get(0);
        pidx = pageIndexOf.get(first?.objectNumber) ?? -1;
      }
      nameToPage.set(nameStr, pidx);
    }
  }
  const kids = n.get(PDFName.of("Kids"));
  if (kids && typeof kids.size === "function") {
    for (let i = 0; i < kids.size(); i++) flatSize(kids.get(i));
  }
};
if (destsRoot) flatSize(destsRoot);
console.log(`/Names/Dests name tree entries: ${nameToPage.size}`);
console.log(`  sample:`, [...nameToPage.entries()].slice(0, 5));

// Walk outline, resolve each via name tree or explicit array
const outlines = ctx.lookup(catalog.get(PDFName.of("Outlines")));
const first = outlines.get(PDFName.of("First"));
let shown = 0;
const resolveOne = (dict) => {
  let dest = dict.get(PDFName.of("Dest"));
  if (!dest) {
    const action = ctx.lookup(dict.get(PDFName.of("A")));
    if (action && typeof action.get === "function")
      dest = action.get(PDFName.of("D"));
  }
  // explicit array?
  const arr = dest && typeof dest.size === "function" ? dest : ctx.lookup(dest);
  if (arr && typeof arr.size === "function" && arr.size() > 0) {
    return pageIndexOf.get(arr.get(0)?.objectNumber) ?? -1;
  }
  // named (string/name) -> name tree
  const nameStr = dec(
    dest && typeof dest.asString === "function" ? dest : ctx.lookup(dest),
  );
  if (nameStr) return nameToPage.has(nameStr) ? nameToPage.get(nameStr) : -1;
  return -1;
};
const walk = (nodeAny, level) => {
  let cur = nodeAny;
  let guard = 0;
  while (cur && guard++ < 6000) {
    const dict = ctx.lookup(cur);
    if (!dict || typeof dict.get !== "function") break;
    const title = dec(ctx.lookup(dict.get(PDFName.of("Title"))));
    if (shown < 25) {
      console.log(
        `L${level} "${String(title).slice(0, 60)}" -> page ${resolveOne(dict)}`,
      );
    }
    shown++;
    const fc = dict.get(PDFName.of("First"));
    if (fc && level < 2) walk(fc, level + 1);
    cur = dict.get(PDFName.of("Next"));
  }
};
walk(first, 0);
console.log(`\nshown/total: 25/${shown}`);
