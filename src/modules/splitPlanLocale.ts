export type SplitPlanLanguage = "zh-CN" | "en-US";

const zhCN: Record<string, string> = {
  "dialog-title": "Chapterize 拆分预览",
  "dialog-heading": "拆分预览",
  "dialog-source-bookmarks": "已从书签读取，共 {pages} 个物理页",
  "dialog-source-manual": "未发现书签，共 {pages} 个物理页",
  "dialog-summary":
    "已选 {sections} 个 · 新建 {pending} 个 · 已存在 {existing} 个 · 覆盖 {covered} 页 · 遗漏 {omitted} 页",
  "dialog-add": "添加章节",
  "dialog-reset": "恢复书签",
  "dialog-select-recommended": "推荐章节",
  "dialog-select-all": "全选",
  "dialog-select-none": "全不选",
  "dialog-select-invert": "反选",
  "dialog-clean-chapter-numbers": "清理章节编号",
  "dialog-restore-original-titles": "恢复原始标题",
  "dialog-metadata-match-all": "重新匹配元数据",
  "dialog-new-section": "章节 {number}",
  "dialog-col-include": "启用",
  "dialog-col-number": "序号",
  "dialog-col-title": "标题",
  "dialog-col-doi": "DOI",
  "dialog-col-metadata": "元数据",
  "dialog-col-start": "PDF 起始页",
  "dialog-col-end": "PDF 结束页",
  "dialog-col-printed": "印刷页码",
  "dialog-col-pages": "页数",
  "dialog-col-status": "拆分结果",
  "dialog-col-actions": "操作",
  "dialog-status-new": "将新建",
  "dialog-status-existing": "将更新",
  "dialog-status-new-help": "拆分后将创建新的 Zotero 章节条目和 PDF。",
  "dialog-status-existing-help":
    "已找到相同来源和页码的 Chapterize 条目；不会重复创建 PDF，只会写入你确认的元数据。",
  "dialog-delete": "移除",
  "dialog-delete-title": "从本次拆分计划中移除此行；不会删除原 PDF",
  "dialog-metadata-find": "查找",
  "dialog-metadata-find-title": "按章节标题和书名从 Crossref 查找元数据",
  "dialog-metadata-searching": "查找中…",
  "dialog-metadata-searching-help": "正在从 Crossref 查找章节元数据。",
  "dialog-metadata-none": "需要 DOI",
  "dialog-metadata-needs-doi": "需要 DOI",
  "dialog-metadata-none-help":
    "Crossref 未找到足够可靠的标题匹配。请在 DOI 栏粘贴 DOI，再点击“获取”。",
  "dialog-metadata-confidence": "匹配 {confidence}%",
  "dialog-metadata-review-help": "点击查看并选择要写入的 Crossref 字段。",
  "dialog-metadata-review":
    "Crossref 字段预览 · 置信度 {confidence}% · 勾选要写入的字段",
  "dialog-metadata-field-title": "标题",
  "dialog-metadata-field-creators": "作者",
  "dialog-metadata-field-doi": "DOI",
  "dialog-metadata-field-url": "URL",
  "dialog-metadata-field-libraryCatalog": "数据来源",
  "dialog-metadata-field-bookTitle": "书名",
  "dialog-metadata-field-pages": "页码",
  "dialog-metadata-field-date": "日期",
  "dialog-metadata-field-publisher": "出版社",
  "dialog-metadata-field-isbn": "ISBN",
  "dialog-metadata-field-language": "语言",
  "dialog-doi-placeholder": "粘贴 DOI 或 doi.org 链接",
  "dialog-doi-lookup": "获取",
  "dialog-doi-lookup-title": "使用此 DOI 从 Crossref 获取完整章节元数据",
  "dialog-doi-required": "请先输入 DOI。",
  "dialog-doi-invalid": "Crossref 未找到此 DOI，请检查后重试。",
  "dialog-doi-success": "已通过 DOI 获取完整元数据。",
  "dialog-guidance":
    "元数据：点击匹配率可审阅字段；显示“需要 DOI”时，粘贴 DOI 后获取。拆分结果：将新建章节，或更新已有章节且不重复 PDF。",
  "dialog-table-label": "章节拆分计划",
  "dialog-language": "界面语言",
  "dialog-language-zh": "中文",
  "dialog-language-en": "English",
  "dialog-title-width": "标题栏宽度",
  "dialog-cancel": "取消",
  "dialog-split": "开始拆分",
  "dialog-error-empty": "请至少启用一个章节。",
  "dialog-error-empty-title": "第 {row} 行缺少标题。",
  "dialog-error-invalid-range": "第 {row} 行的页码范围无效。",
  "dialog-error-out-of-bounds": "第 {row} 行超出 PDF 的 {pages} 页范围。",
  "dialog-error-overlap": "第 {row} 行与第 {other} 行页码重叠。",
};

const enUS: Record<string, string> = {
  "dialog-title": "Chapterize Split Preview",
  "dialog-heading": "Split preview",
  "dialog-source-bookmarks": "Read from bookmarks · {pages} physical pages",
  "dialog-source-manual": "No bookmarks found · {pages} physical pages",
  "dialog-summary":
    "{sections} selected · {pending} new · {existing} existing · {covered} pages covered · {omitted} omitted",
  "dialog-add": "Add section",
  "dialog-reset": "Reset to bookmarks",
  "dialog-select-recommended": "Recommended",
  "dialog-select-all": "Select all",
  "dialog-select-none": "Select none",
  "dialog-select-invert": "Invert",
  "dialog-clean-chapter-numbers": "Clean chapter numbers",
  "dialog-restore-original-titles": "Restore original titles",
  "dialog-metadata-match-all": "Rematch metadata",
  "dialog-new-section": "Section {number}",
  "dialog-col-include": "Include",
  "dialog-col-number": "No.",
  "dialog-col-title": "Title",
  "dialog-col-doi": "DOI",
  "dialog-col-metadata": "Metadata",
  "dialog-col-start": "PDF start",
  "dialog-col-end": "PDF end",
  "dialog-col-printed": "Printed pages",
  "dialog-col-pages": "Count",
  "dialog-col-status": "Split result",
  "dialog-col-actions": "Actions",
  "dialog-status-new": "Will create",
  "dialog-status-existing": "Will update",
  "dialog-status-new-help":
    "Splitting will create a new Zotero book section and PDF.",
  "dialog-status-existing-help":
    "A Chapterize item with the same source and page range exists. Its PDF will not be duplicated; only accepted metadata will be updated.",
  "dialog-delete": "Remove",
  "dialog-delete-title":
    "Remove this row from the split plan; the source PDF is not deleted",
  "dialog-metadata-find": "Find",
  "dialog-metadata-find-title":
    "Find metadata in Crossref by chapter title and book title",
  "dialog-metadata-searching": "Searching…",
  "dialog-metadata-searching-help": "Searching Crossref for chapter metadata.",
  "dialog-metadata-none": "DOI needed",
  "dialog-metadata-needs-doi": "DOI needed",
  "dialog-metadata-none-help":
    "Crossref did not find a title match reliable enough to use. Paste a DOI and click Fetch.",
  "dialog-metadata-confidence": "{confidence}% match",
  "dialog-metadata-review-help":
    "Open the match and choose which Crossref fields to apply.",
  "dialog-metadata-review":
    "Crossref field preview · {confidence}% confidence · select fields to apply",
  "dialog-metadata-field-title": "Title",
  "dialog-metadata-field-creators": "Authors",
  "dialog-metadata-field-doi": "DOI",
  "dialog-metadata-field-url": "URL",
  "dialog-metadata-field-libraryCatalog": "Library catalog",
  "dialog-metadata-field-bookTitle": "Book title",
  "dialog-metadata-field-pages": "Pages",
  "dialog-metadata-field-date": "Date",
  "dialog-metadata-field-publisher": "Publisher",
  "dialog-metadata-field-isbn": "ISBN",
  "dialog-metadata-field-language": "Language",
  "dialog-doi-placeholder": "Paste DOI or doi.org link",
  "dialog-doi-lookup": "Fetch",
  "dialog-doi-lookup-title":
    "Fetch complete chapter metadata from Crossref using this DOI",
  "dialog-doi-required": "Enter a DOI first.",
  "dialog-doi-invalid": "Crossref could not find this DOI. Check it and retry.",
  "dialog-doi-success": "Complete metadata fetched by DOI.",
  "dialog-guidance":
    "Metadata: open a match score to review fields. When DOI is needed, paste one and fetch. Split result: a section will be created or updated without duplicating its PDF.",
  "dialog-table-label": "Chapter split plan",
  "dialog-language": "Interface language",
  "dialog-language-zh": "中文",
  "dialog-language-en": "English",
  "dialog-title-width": "Title width",
  "dialog-cancel": "Cancel",
  "dialog-split": "Split PDF",
  "dialog-error-empty": "Include at least one section.",
  "dialog-error-empty-title": "Row {row} needs a title.",
  "dialog-error-invalid-range": "Row {row} has an invalid page range.",
  "dialog-error-out-of-bounds": "Row {row} exceeds the PDF's {pages} pages.",
  "dialog-error-overlap": "Row {row} overlaps row {other}.",
};

export function splitPlanText(
  language: SplitPlanLanguage,
  key: string,
  args: Record<string, unknown> = {},
): string {
  const template = (language === "en-US" ? enUS : zhCN)[key] ?? key;
  return template.replace(/\{(\w+)\}/g, (_match, name: string) =>
    String(args[name] ?? `{${name}}`),
  );
}

export function normalizeSplitPlanLanguage(value: unknown): SplitPlanLanguage {
  return value === "en-US" ? "en-US" : "zh-CN";
}

export function normalizeTitleColumnWidth(value: unknown): number {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? Math.min(800, Math.max(320, number)) : 520;
}
