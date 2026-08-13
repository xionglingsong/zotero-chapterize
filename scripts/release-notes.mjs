import { readFileSync } from "node:fs";
import { join } from "node:path";

export function releaseNotesForVersion(version, root = process.cwd()) {
  const changelog = readFileSync(join(root, "CHANGELOG.md"), "utf8");
  const escaped = version.replaceAll(".", "\\.");
  const heading = new RegExp(`^## \\[(?:v)?${escaped}\\](?: - .*)?$`, "m");
  const match = heading.exec(changelog);
  if (!match) {
    throw new Error(`CHANGELOG.md has no section for version ${version}.`);
  }

  const start = match.index;
  const nextHeading = changelog.indexOf("\n## [", start + match[0].length);
  const notes = changelog
    .slice(start, nextHeading === -1 ? undefined : nextHeading)
    .trim();
  for (const language of ["中文", "English"]) {
    const languageHeading = `### ${language}`;
    const languageStart = notes.indexOf(languageHeading);
    const contentStart = languageStart + languageHeading.length;
    const followingHeading = notes.indexOf("\n### ", contentStart);
    const section =
      languageStart === -1
        ? ""
        : notes.slice(
            contentStart,
            followingHeading === -1 ? undefined : followingHeading,
          );
    if (!section || !/^[-*] .+/m.test(section)) {
      throw new Error(
        `Version ${version} needs at least one bullet under \"### ${language}\".`,
      );
    }
  }
  return notes;
}
