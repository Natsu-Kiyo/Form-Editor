import type { LogsPageData } from '../api/logs';

/**
 * 导出条数上限。
 *
 * 页面上只显示最近 200 条；导出放宽到 2000 —— 但**不是无限**：
 * 一次把几年审计记录读进内存，会把「导出一份 CSV」变成一次全表扫描。
 */
export const LOG_EXPORT_LIMIT = 2000;

const HEADER = ['时间', '成员', '操作', '类型', '对象', '补充'];

/**
 * 把日志页数据摊成 CSV 行。
 *
 * 被截断时**第一行就是一句说明**（审查 #18）：原先超过 2000 条会静默截断，
 * 文件里没有任何痕迹，用户会以为自己拿到了全部审计记录 ——
 * 而审计记录的「完整性」正是它唯一的用处。
 *
 * 单独抽成纯函数是为了能单测（导出接口本身要连库）。
 */
export function buildLogsCsvRows(data: LogsPageData, limit = LOG_EXPORT_LIMIT): string[][] {
  const rows = data.days.flatMap((day) =>
    day.rows.map((row) => [
      `${day.key} ${row.timeLabel}`,
      row.actorName,
      `${row.sentence.prefix}${row.sentence.target}${row.sentence.suffix}`,
      row.groupLabel,
      row.typeLabel,
      row.extra ?? '',
    ]),
  );

  const notice = data.truncated
    ? [
        [
          `注意：本文件只包含最近 ${limit} 条，筛选范围内还有更早的记录；` +
            '请缩小日期或成员范围后再导出',
        ],
      ]
    : [];

  return [...notice, HEADER, ...rows];
}
