import Link from 'next/link';

import { ChevronDownIcon } from '@/components/icons/ui-icons';
import type { QuestionnaireStatus } from '@/config/constants';
import { cn } from '@/utils/cn';

import type {
  QuestionnaireFilter,
  QuestionnaireSort,
  QuestionnaireSummary,
} from '../api/questionnaires';

/**
 * 状态筛选胶囊 + 排序。
 *
 * 做成**链接**而不是按钮：筛选与排序本来就是「换一个 URL 看同一份数据」，
 * 用链接就能分享、能前进后退、也不需要客户端状态。
 *
 * 「全部」的口径与列表一致：**不含已归档** —— 归档的语义就是「从列表折叠起来」，
 * 想找它们要点「已归档」那一颗。
 *
 * `onNavigate`（可选）：点某颗胶囊 / 某个排序时的通知，供外层摆「正在换这一份数据」
 * 的等待态（R80，`QuestionnaireBoard` 用它把列表区换成骨架）。它是**通知**不是接管 ——
 * 导航仍由链接自己走，所以右键、新标签页这些能力一个都不丢。
 */
export function ListToolbar({
  filter,
  sort,
  keyword,
  summary,
  basePath,
  onNavigate,
}: {
  filter: QuestionnaireFilter;
  sort: QuestionnaireSort;
  keyword: string;
  summary: QuestionnaireSummary;
  basePath: string;
  /** 点筛选 / 排序时的通知（新目标的 URL 还没到达，等待态由外层摆） */
  onNavigate?: (next: { status?: QuestionnaireFilter; sort?: QuestionnaireSort }) => void;
}) {
  const pills: { value: QuestionnaireFilter; label: string; count: number }[] = [
    { value: 'ALL', label: '全部', count: summary.total },
    { value: 'DRAFT', label: '草稿', count: summary.draft },
    { value: 'PUBLISHED', label: '回收中', count: summary.published },
    { value: 'PAUSED', label: '已暂停', count: summary.paused },
    { value: 'CLOSED', label: '已截止', count: summary.closed },
    { value: 'ARCHIVED', label: '已归档', count: summary.archived },
  ];

  const href = (next: { status?: QuestionnaireFilter; sort?: QuestionnaireSort }) => {
    const query = new URLSearchParams();
    const status = next.status ?? filter;
    const nextSort = next.sort ?? sort;

    if (status !== 'ALL') query.set('status', status satisfies QuestionnaireStatus);
    if (nextSort !== 'UPDATED') query.set('sort', nextSort);
    if (keyword) query.set('q', keyword);

    const queryString = query.toString();
    return queryString ? `${basePath}?${queryString}` : basePath;
  };

  const sorts: { value: QuestionnaireSort; label: string }[] = [
    { value: 'UPDATED', label: '最近更新' },
    { value: 'CREATED', label: '最新创建' },
    { value: 'STALE', label: '最久未更新' },
  ];

  return (
    <div className="mb-5 flex flex-wrap items-center gap-2">
      {pills.map((pill) => {
        const active = pill.value === filter;

        return (
          <Link
            key={pill.value}
            href={href({ status: pill.value })}
            aria-current={active ? 'true' : undefined}
            /*
             * 只**通知**，不阻止默认导航。⌘/Ctrl/Shift/Alt + 点击会在新标签页打开，
             * 当前页不会变 —— 那种点击不该让本页摆出等待态（摆了就永远等不到落地）。
             */
            onClick={(event) => {
              if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
              onNavigate?.({ status: pill.value });
            }}
            className={cn(
              'inline-flex h-8 items-center rounded-full px-3.5 text-[12.5px] transition-colors duration-150',
              active
                ? 'bg-brand-500 font-medium text-white'
                : 'border-ink-200 text-ink-600 hover:border-ink-300 border bg-white',
            )}
          >
            {pill.label} {pill.count}
          </Link>
        );
      })}

      <div className="flex-1" />

      {/* 排序用原生 select：这里只需要「换一个 URL」，不值得引入一个客户端弹层 */}
      <details className="group relative">
        <summary className="border-ink-200 text-ink-600 hover:border-ink-300 flex h-8 cursor-pointer list-none items-center gap-1.5 rounded-[10px] border bg-white px-3 text-[12.5px] transition-colors duration-150">
          {sorts.find((item) => item.value === sort)?.label}
          <ChevronDownIcon className="size-3.5" />
        </summary>

        <div className="border-ink-200 shadow-pop absolute right-0 z-20 mt-1.5 w-[160px] rounded-[10px] border bg-white p-1.5">
          {sorts.map((item) => (
            <Link
              key={item.value}
              href={href({ sort: item.value })}
              onClick={(event) => {
                if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
                onNavigate?.({ sort: item.value });
              }}
              className={cn(
                'block rounded-lg px-3 py-2 text-[12.5px] transition-colors duration-150',
                item.value === sort ? 'bg-brand-50 text-brand-600' : 'text-ink-700 hover:bg-ink-50',
              )}
            >
              {item.label}
            </Link>
          ))}
        </div>
      </details>
    </div>
  );
}
