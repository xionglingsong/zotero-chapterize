# Chapterize Product Review

## Product goal

Turn a book PDF into trustworthy Zotero Book Section records with the least
possible cleanup. Success means users can verify the split before it writes to
their library, understand which page-number system is being used, and safely
run the operation again.

## Opportunity themes

### 1. Confidence before writing

The old prompt compressed every chapter into one text field. It made long
outlines difficult to scan and hid overlaps, gaps, and accidental page edits.
This is the highest-impact opportunity because every user passes through it.

Implemented response: a resizable preview table with per-section inclusion,
title and physical-page editing, add/delete/reset actions, live validation, and
coverage/omission totals. The table is the only scrolling region, while the
dialog action bar remains visible. Bookmark levels are indented, and bulk
selection includes a conservative recommended-chapters preset that leaves all
source bookmarks available for manual selection. Same-page bookmark conflicts
prefer explicit chapter titles, while books without numbered chapters retain
ordinary content headings instead of collapsing to an introduction alone.

The preview now shows physical PDF ranges and printed page labels side by side.
Test with five real publisher PDFs containing Roman-numbered front matter. If
users still struggle to verify boundaries, add first-page thumbnails.

### 2. Library integrity

A failed attachment import could previously leave an empty Book Section, and a
failed temporary-file cleanup could leak files. This is lower visibility but
the highest data-risk problem.

Implemented response: section creation and PDF attachment now behave as one
module. The incomplete section is erased when attachment import fails, and
temporary files are removed in a `finally` block.

The command is disabled when the target library cannot edit metadata or stored
files. New sections explicitly inherit the source book's library and use
Zotero's native standalone Book Section model: `bookTitle` metadata plus a
bidirectional Related relation to the source Book.

### 3. Repeatability

Users rerun extraction after correcting bookmarks or changing page ranges.
Creating the same related sections again makes the plugin feel unsafe.

Implemented response: existing related sections carry a source-attachment key,
PDF fingerprint, and physical page range marker that remains stable when users
edit title or printed-page metadata. The completion message reports created,
skipped, and failed counts, and an in-memory per-book lock prevents concurrent
runs from racing the duplicate check. The preview identifies new and existing
ranges before writing, while a Zotero condition search avoids scanning every
item in large libraries.

High-risk assumption: users who edit generated titles or printed page fields
expect a later run to preserve those edits rather than create a new section.
Test books with repeated chapter names and supplements before adding automatic
reconciliation.

## Prioritized next work

1. Add first-page thumbnails to the preview.
2. Add a reconciliation mode for updating or replacing sections created by an
   earlier run, backed by source-PDF and range fingerprints.
3. Add metadata inheritance and optional Crossref enrichment after the split
   workflow is stable, with user review before overwriting Zotero fields.

Deferred: deep bookmark-level rules, automatic title cleanup, and large-book
virtualization. These are useful, but they do not improve the reliability of
the core job as much as the three opportunities above.
