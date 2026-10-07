import { StatsSkeleton } from '@/features/analytics/components/stats-skeleton';

/**
 * 数据页的等待态。形状见 `stats-skeleton.tsx`（L04）。
 *
 * 注意它渲染的是**页面**那一段：问卷内的切换条在 `q/[id]/layout.tsx` 里，
 * 属于 layout，导航时不重挂 —— 所以骨架里没有它。
 */
export default function StatsLoading() {
  return <StatsSkeleton />;
}
