/**
 * CSV 导出。
 *
 * 两件事必须一起做，少一件这套导出就是坏的：
 * - **UTF-8 BOM**：不加 BOM 的中文 CSV 在 Windows 上双击打开是乱码。
 * - **中和公式注入**：Excel / WPS 会把以 `= + - @`（以及前导制表符/回车）开头的单元格
 *   当公式求值，而我们导出的内容里有大量用户可控文本（答题人的填空、成员姓名、问卷标题）。
 *   摘要里的 `=HYPERLINK(...)` 或 `=cmd|'/c calc'!A0` 会在发起人双击打开时执行。
 *   前置一个单引号，Excel 就会按文本处理。
 *
 * 刻意**不带 `import 'server-only'`**：这是纯函数，要能被 vitest 直接跑
 * （与 `src/lib/rate-limit.ts` 同一个理由）。
 */

/** 会被 Excel / WPS 当公式起始的字符 */
const FORMULA_START = /^[=+\-@\t\r]/;

export function escapeCsvCell(value: string) {
  const safe = FORMULA_START.test(value) ? `'${value}` : value;

  // 每个单元格都加引号并把内部引号翻倍：题目文案与填空答案里出现逗号、换行是常态，
  // 不加引号会把一行拆成好几列（引号本身不阻止 Excel 求值，拦截在上面那一步）
  return `"${safe.replace(/"/g, '""')}"`;
}

export function toCsv(rows: string[][]) {
  return `\uFEFF${rows.map((row) => row.map(escapeCsvCell).join(',')).join('\r\n')}\r\n`;
}
