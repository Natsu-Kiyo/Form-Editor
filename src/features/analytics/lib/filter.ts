import { parseDisplayDate } from '@/utils/format';
import { firstParam } from '@/utils/search-params';

/**
 * 统计页的筛选条件。
 *
 * **解析只在这里做一次**：页面与导出接口拿到的是同一套 URL 参数，
 * 若各写一份白名单，迟早出现「页面上筛的是 9 月，导出的却是全部」这种
 * 谁也没写错、但两边对不上的结果。
 */
export type AnalyticsFilter = {
  /** null = 全部渠道 */
  channelId: string | null;
  /** 起始日（含当天 00:00）。null = 不限 */
  from: Date | null;
  /** 结束日（**含**这一整天）。null = 不限 */
  to: Date | null;
};

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * 值可能是数组（`?from=a&from=b`，审查 #6）：解析入口统一过 `firstParam`，
 * 于是「重复参数」在最外层就被收敛成一个值，不会传进 SQL。
 */
export type AnalyticsFilterQuery = {
  channel?: string | string[];
  from?: string | string[];
  to?: string | string[];
};

export function parseAnalyticsFilter(query: AnalyticsFilterQuery): AnalyticsFilter {
  const channel = firstParam(query.channel);
  const from = firstParam(query.from);
  const to = firstParam(query.to);

  return {
    // 渠道 id 是 cuid，40 这个上限只是为了让手改的参数进不了查询
    channelId: channel && channel.length <= 40 ? channel : null,
    // 解析不出来（`2026-02-31`、`乱写`）就当没传：静默回落到「不限」，
    // 而不是把非法值传进 SQL 或让整页报错
    from: from ? parseDisplayDate(from) : null,
    to: to ? parseDisplayDate(to) : null,
  };
}

/**
 * 区间在查询里怎么表达（左闭右开）。
 *
 * `to` 是**含当天**的，所以真正的上界是「那天结束之后」——
 * 直接写 `submittedAt: { lte: to }` 会把结束日这一天整个漏掉，
 * 是这类筛选最常见的一个错（选了 9/1–9/30，9/30 的答卷不出现）。
 */
export function filterBounds(filter: AnalyticsFilter) {
  return {
    gte: filter.from ?? undefined,
    lt: filter.to ? new Date(filter.to.getTime() + DAY_MS) : undefined,
  };
}

/** 筛选区间的终点（含当天最后一毫秒）。null = 到现在 */
export function filterEndInclusive(filter: AnalyticsFilter): Date | null {
  return filter.to ? new Date(filter.to.getTime() + DAY_MS - 1) : null;
}
