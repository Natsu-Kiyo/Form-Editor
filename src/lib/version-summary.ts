import { formatVersion } from '@/config/constants';

/**
 * 版本历史里每行的**主文案**。
 *
 * 为什么不再拿 `label` 当主文案（用户复测）：`label` 只有「保存草稿」四个字，
 * 十条记录长得一模一样，用户没法判断「我想退回的是哪一版」。
 * 现在主文案由「基于哪一版改的 + 共几道题」拼出来：
 *
 * - 有来源版本 → `修改自 v6 · 共 4 道题`
 * - 第一条 → `初始版本 · 共 4 道题`
 * - 历史数据（`sourceVersion` 为空，那时还没有这个字段）→ 回退显示 `label`
 *
 * 纯函数：文案规则只写一处，界面与将来可能出现的导出都调它（有单测）。
 */
export function versionSummary(row: {
  version: number;
  sourceVersion: number | null;
  questionCount: number;
  label: string;
}): string {
  const count = `共 ${row.questionCount} 道题`;

  if (row.sourceVersion !== null) return `修改自 ${formatVersion(row.sourceVersion)} · ${count}`;

  /*
   * `sourceVersion` 为空有两种可能，靠编号区分：
   * - v1：本来就是第一版，写「初始版本」比「修改自 v0」清楚；
   * - v2 及以后：字段上线前写的老记录（包括当时那些「回滚自 vN」），
   *   它们的来源无法可靠还原（回滚那条的来源是更早的某一版，不是上一条），
   *   于是回退显示当时的 `label` —— 宁可信息少一点，也不要显示一句编造的来源。
   */
  if (row.version === 1) return `初始版本 · ${count}`;

  return `${row.label} · ${count}`;
}
