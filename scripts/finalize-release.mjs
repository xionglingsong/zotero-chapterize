import { readFileSync } from "node:fs";
import { join } from "node:path";
import { releaseNotesForVersion } from "./release-notes.mjs";

const root = process.cwd();
const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
const version = pkg.version;
const notes = releaseNotesForVersion(version, root);

if (process.argv.includes("--check")) {
  console.log(`[release] bilingual notes found for v${version}`);
  process.exit(0);
}

const repository = process.env.GITHUB_REPOSITORY;
const token = process.env.GITHUB_TOKEN;
if (!repository || !token) {
  throw new Error("GITHUB_REPOSITORY and GITHUB_TOKEN are required.");
}

async function github(path, init = {}) {
  const response = await fetch(`https://api.github.com${path}`, {
    ...init,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      ...init.headers,
    },
  });
  if (!response.ok) {
    throw new Error(`GitHub API ${response.status}: ${await response.text()}`);
  }
  return response.status === 204 ? null : response.json();
}

const release = await github(`/repos/${repository}/releases/tags/v${version}`);
const expectedName = `${pkg.config.addonRef}-${version}.xpi`;
const xpi = release.assets.find((asset) => asset.name.endsWith(".xpi"));
if (!xpi) throw new Error(`Release v${version} has no XPI asset.`);

if (xpi.name !== expectedName) {
  await github(`/repos/${repository}/releases/assets/${xpi.id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: expectedName }),
  });
  console.log(`[release] renamed ${xpi.name} to ${expectedName}`);
}

await github(`/repos/${repository}/releases/${release.id}`, {
  method: "PATCH",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    name: `Chapterize v${version}`,
    body: notes,
  }),
});
console.log(`[release] published bilingual notes for v${version}`);
