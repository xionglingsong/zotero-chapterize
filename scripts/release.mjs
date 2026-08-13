import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { releaseNotesForVersion } from "./release-notes.mjs";

const args = process.argv.slice(2);
if (args.includes("--help") || args.includes("-h")) {
  console.log(`Usage: npm run release -- <major|minor|patch|version> [--yes]

Add bilingual notes for the target version to CHANGELOG.md before releasing.`);
  process.exit(0);
}

const pkg = JSON.parse(
  readFileSync(join(process.cwd(), "package.json"), "utf8"),
);
const target = args.find((arg) => !arg.startsWith("-")) ?? "patch";
const [major, minor, patch] = pkg.version.split("-")[0].split(".").map(Number);
const targetVersion =
  target === "major"
    ? `${major + 1}.0.0`
    : target === "minor"
      ? `${major}.${minor + 1}.0`
      : target === "patch"
        ? `${major}.${minor}.${patch + 1}`
        : target.replace(/^v/, "");

releaseNotesForVersion(targetVersion);
console.log(`[release] bilingual notes verified for v${targetVersion}`);

const options = args.filter((arg) => arg.startsWith("-"));
const result = spawnSync(
  "npx",
  ["zotero-plugin", "release", targetVersion, ...options],
  { stdio: "inherit" },
);
process.exit(result.status ?? 1);
