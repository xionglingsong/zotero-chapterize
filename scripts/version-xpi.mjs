// After `zotero-plugin build`, copy the produced .xpi into a VISIBLE,
// version-named file under ./dist so it's easy to find in Finder and obvious
// which version it is. The scaffold itself writes to hidden .scaffold/build
// and does not version the xpi name, so we add this post-build step.
import {
  readdirSync,
  readFileSync,
  writeFileSync,
  mkdirSync,
  existsSync,
} from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
const version = pkg.version;
const baseName = pkg.config?.addonRef ?? pkg.name;

const buildDir = join(root, ".scaffold", "build");
if (!existsSync(buildDir)) {
  console.error(`[version-xpi] build dir not found: ${buildDir}`);
  process.exit(1);
}
const xpis = readdirSync(buildDir).filter((f) => f.endsWith(".xpi"));
if (xpis.length === 0) {
  console.error(`[version-xpi] no .xpi found in ${buildDir}`);
  process.exit(1);
}

const src = join(buildDir, xpis[0]);
const outDir = join(root, "dist");
mkdirSync(outDir, { recursive: true });
const outName = `${baseName}-${version}.xpi`;
writeFileSync(join(outDir, outName), readFileSync(src));
console.log(`[version-xpi] wrote dist/${outName}`);
