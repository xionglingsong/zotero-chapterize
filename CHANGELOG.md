# Changelog / 更新日志

All notable changes to Chapterize are documented here in Chinese and English.
Chapterize 的重要更新均在此以中英文记录。

## [0.2.25] - 2026-08-13

### 中文

- 将 Zotero 中显示为空且无法可靠切换的语言下拉框改为“中文 / English”分段按钮；点击后立即刷新界面、窗口标题和底部操作，并保存选择。
- 移除固定标题列右侧多余的边框与阴影，消除标题栏和 DOI 栏之间突兀的竖线。
- 清除表格文本框的系统默认外边距并统一 DOI 单元格内边距，使 DOI 输入框与列边缘、其他行控件一致对齐。
- 将 PDF 起始页和结束页列宽从 88px 增至 104px，并禁止表头换行，避免中英文标题断成两行。
- 新增语言选中态与表格布局回归测试，覆盖语言持久化、DOI 对齐和页码表头稳定性。

### English

- Replaced the blank, unreliable Zotero language select with a visible Chinese / English segmented control that immediately refreshes the interface, window title, and footer actions while persisting the choice.
- Removed the redundant border and shadow from the sticky title edge, eliminating the harsh vertical line between Title and DOI.
- Removed platform-default text-input margins and normalized DOI cell spacing so DOI controls align consistently with the column and neighboring rows.
- Increased the PDF start/end columns from 88px to 104px and prevented header wrapping in both languages.
- Added regression coverage for language pressed state and persistence, DOI alignment, and stable page headers.

## [0.2.24] - 2026-08-13

### 中文

- 当目录页没有可靠作者时，仅扫描章节开头最多两个物理页，并在匹配章节标题后的邻近位置提取署名候选。
- 章节首页解析会拒绝 `Edited by`、编者标签、正文句子以及 Research Methods 等常见小标题，降低把非作者文本写入 Zotero 的风险。
- 合并目录页、章节首页、Crossref 标题匹配和 DOI 作者来源；相同作者自动折叠，不同作者明确标记为来源冲突。
- 冲突章节显示所有候选来源和姓名，必须由用户选择并确认后才会写入；DOI 精确结果可清除自动来源冲突，但不会覆盖非空的人工作者。
- 顶部摘要新增作者冲突数量，并提供“确认无冲突作者”操作；冲突项不会被批量确认越过。

### English

- When the contents page has no reliable author, scan only the first two physical pages of a chapter and extract a byline near the matching chapter title.
- Reject `Edited by` labels, editor markers, prose sentences, and common subheadings such as Research Methods to reduce false author metadata.
- Merge contents-page, chapter-opening, Crossref title-match, and DOI author sources; identical authors collapse while disagreements become explicit source conflicts.
- Show every conflicting source and name for user selection and confirmation; exact DOI results clear automatic-source conflicts but never overwrite non-empty manual authors.
- Report author conflicts in the summary and add a Confirm non-conflicting authors action that never bypasses conflicted rows.

## [0.2.23] - 2026-08-13

### 中文

- Crossref 无可靠匹配时，从明确书签标记的 Contents/目录页提取章节作者候选；支持标题折行、作者另起一行和同一行版式。
- 作者候选按章节标题严格锚定，来源标记显示目录印刷页码和原始文本；候选默认待确认，不会静默写入 Zotero。
- 在拆分预览中新增逐作者的名、姓编辑框，以及添加、移除、清空和确认操作；人工修改后自动撤销确认。
- 顶部摘要显示待确认作者数量；无候选时仍可手工添加作者。
- Crossref 标题匹配和 DOI 作者继续自动采用，但非空的人工录入作者不会被后续重新匹配覆盖。
- 保持父书 creators 与章节作者隔离，最终 metadata 只包含明确确认且非空的作者。

### English

- Extracted chapter-author candidates from explicitly bookmarked Contents pages when Crossref has no reliable match, including wrapped-title, next-line, and same-line layouts.
- Anchored candidates strictly to chapter titles and displayed the printed source page and original text; candidates remain pending and are never silently written to Zotero.
- Added per-author first/last-name editing plus add, remove, clear, and confirm actions; any manual edit revokes confirmation.
- Added the number of pending author confirmations to the summary and kept manual author entry available when no candidate exists.
- Continued to accept Crossref title-match and DOI authors automatically while protecting non-empty manual authors from later rematching.
- Kept parent creators isolated from chapter authors and serialized only explicitly confirmed, non-empty creators.

## [0.2.22] - 2026-08-13

### 中文

- 按选择、标题、元数据和结构操作重新梳理拆分预览的信息层级，增加组间留白并保持紧凑的 Zotero 工具风格。
- 横向滚动时固定启用、序号和标题列，长标题始终保留上下文；缩小次要列宽并优化窄窗口布局。
- 将元数据状态改为“查找中、需要 DOI、匹配率”等可执行提示，将条目状态改为“将新建、将更新”，并提供明确的下一步说明。
- 为 DOI 错误、结果摘要、表格和字段预览补充读屏语义、键盘焦点、强制配色和减少动态效果支持。
- 修复批量清理或恢复标题后仍保留旧 Crossref 标题匹配的问题；DOI 精确匹配会保留，但不再覆盖用户编辑后的标题。
- 将“删除”改为更准确的“移除”，明确该操作只影响当前拆分计划，不会删除原 PDF。

### English

- Reorganized the split preview around selection, title, metadata, and structure actions, with clearer grouping while preserving Zotero's compact tool style.
- Kept the Include, number, and title columns visible during horizontal scrolling, reduced secondary column widths, and improved narrow-window behavior.
- Replaced opaque metadata and item states with actionable labels such as Searching, DOI needed, match confidence, Will create, and Will update, each with recovery guidance.
- Added screen-reader semantics for DOI errors, summaries, tables, and field previews, plus stronger keyboard focus, forced-colors, and reduced-motion support.
- Fixed stale Crossref title matches surviving batch title cleanup or restoration; exact DOI metadata remains available without overwriting a user-edited title.
- Renamed Delete to Remove and clarified that it only changes the current split plan, never the source PDF.

## [0.2.21] - 2026-08-13

### 中文

- 修复拆分预览语言下拉框不保留选中值、切换英文后界面不刷新的问题。
- 将“清理章节编号”改为按钮，并避免清理时覆盖用户手工编辑的标题。
- 新增标题栏宽度滑杆，可在 320–800 px 范围调节并记住设置；长标题保留完整悬浮提示。
- 扩宽 DOI 栏并增加输入框与“获取”按钮的间距、独立边框和键盘焦点样式。
- 修改标题后自动清除过期的标题匹配结果，避免旧 DOI/元数据误写入新标题。
- 自动 Crossref 匹配仅处理当前启用章节，减少无关前置页查询和“未匹配”噪声。

### English

- Fixed the split-preview language selector not retaining its value or refreshing the interface after switching to English.
- Replaced the chapter-number cleanup checkbox with a button and preserved manually edited titles during cleanup.
- Added a persistent 320–800 px title-column width slider, while retaining full-title hover text.
- Widened the DOI column and separated the input and Fetch button with clearer spacing, borders, and keyboard focus styles.
- Invalidated stale title-based DOI/metadata matches after a title edit to prevent writing metadata for the previous title.
- Limited automatic Crossref matching to enabled sections, reducing irrelevant front-matter lookups and “No match” noise.

## [0.2.20] - 2026-08-13

### 中文

- 在拆分预览中新增 DOI 栏，按母书 ISBN/书名批量匹配 Crossref 并自动填入 DOI。
- 标题匹配失败时支持粘贴 DOI 或 doi.org 链接，精确获取完整章节元数据。
- 为“未匹配”和“新建/已存在”状态增加页面说明与悬浮提示。
- 拆分预览新增中文/英文即时切换，默认中文并记住用户选择。
- DOI 精确查询默认勾选全部非空 Crossref 字段，仍可逐项取消。

### English

- Added an editable DOI column that batch-matches Crossref by parent ISBN/book title and fills DOI values automatically.
- Added exact metadata lookup from a pasted DOI or doi.org URL when title matching fails.
- Added inline guidance and tooltips explaining “No match” and “New/Existing” item status.
- Added live Chinese/English switching in the split preview, defaulting to Chinese and remembering the choice.
- Exact DOI lookup selects every non-empty Crossref field by default while preserving field-level opt-out.

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
