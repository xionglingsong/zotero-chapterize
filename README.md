# Chapterize

[中文](#中文) | [English](#english)

## 中文

Chapterize 是一个 Zotero 插件，可按 PDF 书签或手动页码范围预览并拆分整本书。每个启用的范围都会创建为关联的“书籍章节”（Book Section）条目，并附上独立的拆分 PDF。

支持 Zotero 7、8 和 9，主要在 Zotero 9 上测试。

### 主要功能

- 从“书籍”条目或其 PDF 附件启动拆分。
- 读取 PDF 一、二级书签；没有书签时可手动添加范围。
- 在拆分前预览、选择、重命名和修改物理页范围。
- 可调节标题栏宽度，完整标题也可通过悬浮提示查看。
- 同时显示物理页码、印刷页码、覆盖页数、遗漏和重叠错误。
- 智能选择正文章节，并正确覆盖未选中的嵌套子书签。
- 自动清理章节编号，并可在预览中恢复原始标题。
- 自动按 ISBN、书名和章节标题匹配 Crossref，并填入 DOI。
- 标题匹配失败时可手动粘贴 DOI，获取完整章节元数据。
- 提供置信度、字段级预览和逐项接受；父书编者不会被误作章作者。
- Crossref 无匹配时可从带书签的目录页提取章作者候选，显示来源页并要求人工确认。
- 可逐个编辑、添加或移除章作者；手工编辑的作者优先于后续自动匹配。
- 拆分预览支持中文和英文即时切换，默认中文。
- 继承出版者、日期、ISBN、语言等可靠的父书元数据。
- 使用来源指纹和物理页范围去重，避免重复拆分。
- 检测加密 PDF，并在创建附件失败时回滚不完整条目。

### 安装与自动更新

1. 从 [Latest Release](https://github.com/xionglingsong/zotero-chapterize/releases/latest) 下载带版本号的 `chapterize-版本号.xpi`。
2. 在 Zotero 中打开“工具 → 附加组件 → 齿轮菜单 → 从文件安装附加组件”。
3. 选择 XPI 文件；需要升级时无需先卸载旧版本。

首次安装 GitHub Release 版本后，Zotero 会通过公开的 `update.json` 检查后续更新。

### 页码与元数据

- **拆分范围**始终使用 PDF 中从 1 开始显示的物理页位置。
- **Pages 元数据**优先使用 PDF `/PageLabels` 中的印刷页码，例如 `iii-xiv` 或 `57-76`；没有页码标签时回退到物理页码。
- 父书 DOI、URL 和 Extra 不会复制给章节，以免把整本书的标识符错误地当作章节标识符。
- 父书 creators 不会复制为章作者。章作者可以来自 Crossref/DOI、目录页候选或手工录入；目录候选和手工修改必须明确确认，未确认内容不会写入。

### 开发

```bash
npm install
npm run lint:check
npm test
npm run build
```

本地版本化 XPI 输出到 `dist/chapterize-版本号.xpi`。

发布新版本前，在 `CHANGELOG.md` 中添加目标版本的 `### 中文` 和 `### English` 条目，然后运行：

```bash
npm run release -- patch
```

发布流程会拒绝缺少双语说明的版本，并在 GitHub Release 中发布带版本号的 XPI 和中英双语 Release Notes。

## English

Chapterize is a Zotero plugin for previewing and splitting a book-length PDF by its bookmarks or manually entered page ranges. Every enabled range becomes a related Book Section item with its own split PDF attachment.

It supports Zotero 7, 8, and 9 and is tested primarily with Zotero 9.

### Features

- Start from a Book item or one of its PDF attachments.
- Read level 1-2 PDF bookmarks or create a manual plan when no outline exists.
- Preview, select, rename, and edit physical page ranges before writing files.
- Resize the title column and inspect complete long titles from hover text.
- Show physical pages, printed page labels, coverage, omissions, and overlap errors.
- Recommend content chapters while correctly spanning unselected nested bookmarks.
- Remove chapter-number prefixes and restore original titles from the preview.
- Match Crossref automatically by ISBN, book title, and chapter title to fill DOI values.
- Accept a manually pasted DOI when title matching fails and fetch complete chapter metadata.
- Show confidence and field-level acceptance; book editors are never treated as chapter authors.
- Extract chapter-author candidates from bookmarked contents pages when Crossref has no match, show the source page, and require explicit review.
- Edit, add, or remove chapter authors individually; manually edited authors take precedence over later automatic matching.
- Switch the split preview between Chinese and English, with Chinese as the default.
- Inherit reliable book metadata such as publisher, date, ISBN, and language.
- Deduplicate by source fingerprint and physical page range.
- Detect encrypted PDFs and roll back incomplete items when attachment creation fails.

### Installation And Automatic Updates

1. Download the versioned `chapterize-version.xpi` from the [Latest Release](https://github.com/xionglingsong/zotero-chapterize/releases/latest).
2. In Zotero, open Tools → Add-ons → gear menu → Install Add-on From File.
3. Select the XPI. Installing a newer version replaces the old version without requiring an uninstall.

After the GitHub Release build is installed once, Zotero checks the public `update.json` for later versions.

### Pages And Metadata

- **Splitting** always uses the PDF's physical page positions, displayed from 1 in the editor.
- **Pages metadata** uses printed labels from the PDF's `/PageLabels`, such as `iii-xiv` or `57-76`, and falls back to physical numbering when labels are unavailable.
- The parent book's DOI, URL, and Extra are not copied because they should not be presented as chapter identifiers.
- Parent creators are not copied as chapter authors. Authors may come from Crossref/DOI, contents-page candidates, or manual entry; contents candidates and manual edits require explicit confirmation, and unconfirmed values are never written.

### Development

```bash
npm install
npm run lint:check
npm test
npm run build
```

The local versioned XPI is written to `dist/chapterize-version.xpi`.

Before releasing, add `### 中文` and `### English` entries for the target version to `CHANGELOG.md`, then run:

```bash
npm run release -- patch
```

The release process rejects versions without bilingual notes and publishes a versioned XPI with bilingual GitHub Release Notes.

## License / 许可证

[AGPL-3.0-or-later](LICENSE)
