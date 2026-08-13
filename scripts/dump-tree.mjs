// Dump the raw structure of /Names/Dests to understand the name tree layout.
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

const dumpKeys = (label, node) => {
  const n = ctx.lookup(node);
  if (!n || typeof n.get !== "function") {
    console.log(`${label}: <not a dict>`);
    return;
  }
  const keys = n.dict?.map
    ? [...n.dict.map.keys()].map((k) => k.toString())
    : [];
  console.log(`${label}: keys = [${keys.join(", ")}]`);
  return n;
};

const names = ctx.lookup(catalog.get(PDFName.of("Names")));
console.log("=== /Names keys ===");
dumpKeys("/Names", names);
const destsRoot = ctx.lookup(names.get(PDFName.of("Dests")));
console.log("\n=== /Names/Dests keys ===");
const root = dumpKeys("/Names/Dests", names.get(PDFName.of("Dests")));

// If it has Kids, go one level down
const kids = root && root.get ? root.get(PDFName.of("Kids")) : null;
if (kids && typeof kids.size === "function") {
  console.log(`\n/Kids count: ${kids.size()}`);
  const k0 = ctx.lookup(kids.get(0));
  const kk = k0?.dict?.map
    ? [...k0.dict.map.keys()].map((k) => k.toString())
    : [];
  console.log(`Kid[0] keys = [${kk.join(", ")}]`);
  const nums = k0?.get ? k0.get(PDFName.of("Nums")) : null;
  if (nums && typeof nums.size === "function") {
    console.log(`Kid[0].Nums size: ${nums.size()}`);
    for (let i = 0; i + 1 < nums.size() && i < 10; i += 2) {
      const nm = dec(ctx.lookup(nums.get(i)));
      console.log(`   name="${nm}"`);
    }
  }
}
const nums0 = root && root.get ? root.get(PDFName.of("Nums")) : null;
if (nums0 && typeof nums0.size === "function") {
  console.log(`\n/Nums (direct) size: ${nums0.size()}`);
}
