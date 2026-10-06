import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { getAnalyticsData } from '@/features/analytics/api/analytics';
import { StatsPanel } from '@/features/analytics/components/stats-panel';
import { parseAnalyticsFilter } from '@/features/analytics/lib/filter';
import { hasAtLeastRole } from '@/lib/auth/permissions';
import { requireQuestionnaireAccess } from '@/lib/auth/questionnaire-access';
import { formatDisplayDate } from '@/utils/format';

export const metadata: Metadata = { title: '数据统计' };

/**
 * 数据统计（W06 / P05）。
 *
 * 筛选从 URL 读（与问卷列表同一条规矩），解析与白名单校验**统一在 `lib/filter.ts`**：
 * 导出接口也要这套参数，两处各写一份迟早会分叉成「页面筛了、导出没筛」。
 */
export default async function StatsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ channel?: string; from?: string; to?: string }>;
}) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const filter = parseAnalyticsFilter(query);

  const [{ role }, data] = await Promise.all([
    requireQuestionnaireAccess(id, 'VIEWER'),
    getAnalyticsData(id, filter),
  ]);

  if (!data) notFound();

  return (
    <StatsPanel
      data={data}
      channelId={filter.channelId}
      // 回填的是**服务端真正应用了的**那对日期，不是 URL 原文：
      // 手改出来的非法值会被解析成 null，控件就不该把它显示成筛选条件
      from={filter.from ? formatDisplayDate(filter.from) : null}
      to={filter.to ? formatDisplayDate(filter.to) : null}
      canExport={hasAtLeastRole(role, 'EDITOR')}
    />
  );
}
