# Chapterize

A Zotero plugin that previews and splits a book PDF using its **PDF bookmarks (outline)** or manually entered physical page ranges. It creates a related `Book Section` item for every enabled range and attaches the split PDF.

Built for Zotero 7 / 8 / 9 (tested primarily against 9.x).

The plugin's display name is **Chapterize**.

## What it does

1. Right-click a **Book** item that has a PDF attachment → **Chapterize: Split into Sections**.
2. Reads the PDF's bookmark tree (levels 1–2), or starts a manual plan when the PDF has no bookmarks.
3. Opens a split preview where you can include, rename, add, delete, and adjust chapter ranges with live overlap and bounds validation.
4. Shows physical PDF ranges beside printed page labels, plus coverage and intentionally omitted pages before making changes.
5. For every enabled chapter: splits the range into a standalone PDF, creates a related `bookSection` item with the source book title, and attaches the split PDF.
6. Marks existing ranges in the preview, skips sections from the same source PDF and physical page range even if their title or printed pages were edited later, and rolls back incomplete sections when attachment import fails.

You can start from either the **Book** item or one of its child PDF attachments.

## What's next

- First-page thumbnails for faster visual verification in the preview.
- Reconciliation for updating or replacing sections made by an earlier run.
- Crossref metadata enrichment with field-by-field review.

## Install (try the current build)

1. Build it:
   ```bash
   npm install
   npm run build
   ```
2. In Zotero: **Tools → Add-ons → ⚙ → Install Add-on From File…** and pick
   `.scaffold/build/chapterize.xpi`.
3. Restart Zotero if prompted. Right-click a Book item → **Chapterize: Split into Sections**.

## Requirements / notes

- **Bookmarks vs manual entry.** Bookmarks seed the editable preview. If a PDF
  has no outline, add rows and enter physical page ranges directly.
- **Two page-number systems (important).** Chapterize keeps them separate:
  - **Splitting** always uses the PDF's **physical pages** (the page's position
    in the file). Bookmark dests resolve to physical pages; when you type page
    numbers manually you type physical pages.
  - **Metadata** (`pages` field on each Book Section) shows the **printed page
    numbers** actually on the pages (e.g. `12-27`, `iii-xiv`), read from the
    PDF's `/PageLabels`. If the PDF declares none, it falls back to physical
    numbering.
- Front matter without bookmarks is omitted by default; the preview reports the
  omission and lets you add it explicitly.
- **Encrypted PDFs.** `pdf-lib` cannot safely modify encrypted files. Save a
  decrypted copy first; Chapterize detects encrypted/password-protected input
  before opening the split preview instead of risking damaged output.

## Development

- `npm run build` — type-check + bundle + pack the `.xpi` (no Zotero needed).
- `npm start` — live-reload dev server; needs a `.env` (copy `.env.example`) pointing at your Zotero binary and a dev profile.
- `npm run lint:fix` — format + lint.

### Project layout

```
src/
  hooks.ts                     # lifecycle: registers the menu on window load
  modules/
    chapterize.ts              # right-click menu + split orchestrator
    splitPlanDialog.ts         # validated, editable split preview
    pdf/outline.ts             # pdfjs: bookmark tree -> chapter page ranges
    pdf/ranges.ts              # split-plan parsing, validation, normalization
    pdf/splitter.ts            # pdf-lib: copy a page range into a new PDF
    zotero/items.ts            # find the book's PDF, create related bookSection + attach
    crossref.ts                # CrossRef DOI lookup (M4, ready but not wired)
addon/
  manifest.json                # strict_min 6.999, strict_max 9.*
  bootstrap.js                 # Zotero lifecycle bootstrap
  locale/{en-US,zh-CN}/*.ftl   # strings (keys auto-prefixed at build time)
```

## License

AGPL-3.0-or-later (inherits from the zotero-plugin-template).
