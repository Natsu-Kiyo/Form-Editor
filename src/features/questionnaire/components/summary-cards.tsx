import type { QuestionnaireSummary } from '../api/questionnaires';

/**
 * 列表页顶部的四张汇总卡。
 *
 * 四个数字全部来自真实查询（`getQuestionnaireSummary`），没有任何占位值 ——
 * 「累计答卷」在演示环境里就是 0，如实显示 0。
 */
export function SummaryCards({ summary }: { summary: QuestionnaireSummary }) {
  const cards = [
    { label: '全部问卷', value: summary.total },
    { label: '回收中', value: summary.published },
    { label: '累计答卷', value: summary.validResponses },
    { label: '本周新增', value: summary.createdThisWeek, accent: true },
  ];

  return (
    <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
      {cards.map((card) => (
        <div key={card.label} className="border-ink-200 rounded-xl border bg-white p-4">
          <div className="text-ink-500 mb-1.5 text-[12px]">{card.label}</div>
          <div
            className={
              card.accent
                ? 'text-brand-500 font-mono text-[26px] leading-8 font-semibold'
                : 'text-ink-900 font-mono text-[26px] leading-8 font-semibold'
            }
          >
            {card.value.toLocaleString('zh-CN')}
          </div>
        </div>
      ))}
    </div>
  );
}
