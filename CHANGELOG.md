# Changelog / 更新日志

All notable changes to Chapterize are documented here in Chinese and English.
Chapterize 的重要更新均在此以中英文记录。

## [0.2.19] - 2026-08-13

### 中文

- 修复母书编者被错误继承为章节作者的问题；没有可靠来源时不再猜测章作者。
- 接入 Crossref `book-chapter` 标题、书名与 ISBN 匹配，显示置信度并支持逐字段确认。
- 第 33 章“Eye-tracking studies in conference interpreting”可匹配 Agnieszka Chmiel、DOI、页码等正确元数据。
- 支持清理纯数字章节前缀，并新增“清理章节编号”设置和预览中的原始标题一键恢复。
- 已有拆分章节可就地回填已确认的元数据，完成提示会报告更新章节数与字段数。

### English

- Fixed book editors being incorrectly inherited as chapter authors; chapter authors are no longer guessed without a reliable source.
- Integrated Crossref `book-chapter` matching by title, book title, and ISBN, with confidence and field-level acceptance.
- Chapter 33, “Eye-tracking studies in conference interpreting,” now matches Agnieszka Chmiel, its DOI, pages, and related metadata.
- Added cleanup for bare numeric chapter prefixes, a title-cleanup preference, and one-click restoration of original bookmark titles.
- Existing generated sections can receive accepted metadata in place, with completion notices reporting changed sections and fields.

## [0.2.18] - 2026-08-13

### 中文

- 将 GitHub Release 的 XPI 资产统一命名为 `chapterize-版本号.xpi`。
- 新增发布前双语更新说明校验，缺少中文或英文内容时阻止发布。
- GitHub Release 自动采用 `CHANGELOG.md` 中对应版本的中英双语说明。
- 将项目 README 重写为功能对齐的中英双语文档。

### English

- Standardized GitHub Release assets as `chapterize-version.xpi`.
- Added a prerelease bilingual-notes check that blocks releases missing Chinese or English content.
- Made GitHub Releases use the matching bilingual section from `CHANGELOG.md` automatically.
- Rewrote the project README as aligned Chinese and English documentation.

## [0.2.17] - 2026-08-13

### 中文

- 新增蓝色系拆分预览，可编辑标题、物理页范围、选择状态并检查遗漏与重叠。
- 修复 Zotero 沙箱中的 PDF.js worker、`console`、`AbortController` 等兼容问题。
- 修复含嵌套书签时章节被提前截断或父子范围重叠的问题。
- 新增父书 creators、出版信息和 ISBN 等元数据继承，并回填已有拆分条目。
- 自动清理 `Chapter 5:`、`Ch. IV`、`第五章` 等结构性章节编号。
- 新增来源指纹去重、并发锁、失败回滚、加密 PDF 检测和版本化自动更新基础设施。

### English

- Added a blue split-preview editor for titles, physical page ranges, selection, omissions, and overlap validation.
- Fixed PDF.js worker, `console`, `AbortController`, and related Zotero sandbox compatibility issues.
- Fixed truncated chapter ranges and parent-child overlaps with nested bookmarks.
- Added inheritance of creators, publication fields, ISBN, and other book metadata, including backfill for existing generated sections.
- Added automatic cleanup of structural prefixes such as `Chapter 5:`, `Ch. IV`, and `第五章`.
- Added source-fingerprint deduplication, run locking, rollback, encrypted-PDF detection, and versioned auto-update infrastructure.
