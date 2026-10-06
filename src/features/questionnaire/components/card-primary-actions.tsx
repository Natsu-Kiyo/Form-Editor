'use client';

import Link from 'next/link';
import { useTransition } from 'react';

import { useIsDesktop } from '@/hooks/use-is-desktop';
import { cn } from '@/utils/cn';

import { copyQuestionnaireAction } from '../actions/copy-questionnaire';
import type { QuestionnaireCard } from '../api/questionnaires';
import { RestoreButton } from './restore-button';

/**
 * 卡片底部的主操作（设计稿 W02 桌面 / P02 窄屏）。
 *
 * **三个位置随状态换内容，不是随便定的** —— 每个状态都得有一个「下一步」：
 *
 * | 状态 | 桌面 | 窄屏 |
 * |---|---|---|
 * | 草稿 / 回收中 / 已暂停 | 编辑 · 数据 · 分享 | 数据 · 分享 |
 * | 已截止 | **复制** · 数据 · 分享 | 数据 · 分享 |
 * | 已归档 | 恢复 · **数据** | 恢复 · 数据 |
 *
 * 几处判断：
 * - 已截止的没有「编辑」可点（发布即冻结，编辑器进去也是只读），设计稿把它换成了**复制** ——
 *   那正是冻结问卷唯一的出路。
 * - 已归档的没有「分享」（不能再回收了），只剩「恢复」与「数据」。
 * - 窄屏没有「编辑」（移动端编辑是弹层化的 P08，属 M10）与「复制」（设计稿标为移动端不做）。
 *   两处都是**完全不渲染**，不是灰显 —— 与侧栏、⋯ 菜单同一条规矩。
 * - 「数据」在窄屏可用：统计页本身能在窄屏打开，只是它的移动版式（单题图表横滑等）
 *   留在 M10 双端收口。它是个真页面，不是假入口。
 */
const BAR_ITEM =
  'flex h-8 flex-1 items-center justify-center rounded-lg text-[12.5px] font-medium transition-colors duration-150';
const PILL_ITEM =
  'flex h-7 items-center rounded-lg px-2.5 text-[11.5px] font-medium transition-colors duration-150';

/** 桌面是「文字按钮」，窄屏是「实底胶囊」—— 两套配色都取自设计稿 */
const TONE = {
  bar: {
    plain: 'text-ink-600 hover:bg-ink-100',
    brand: 'text-brand-500 hover:bg-brand-50',
  },
  pill: {
    plain: 'bg-ink-100 text-ink-600',
    brand: 'bg-brand-50 text-brand-600',
  },
} as const;

export function CardPrimaryActions({ questionnaire }: { questionnaire: QuestionnaireCard }) {
  const isDesktop = useIsDesktop();
  const [pending, startTransition] = useTransition();

  const archived = questionnaire.status === 'ARCHIVED';
  const closed = questionnaire.status === 'CLOSED';

  const shape = isDesktop ? 'bar' : 'pill';
  const item = cn(isDesktop ? BAR_ITEM : PILL_ITEM, TONE[shape].plain);

  return (
    <div
      className={cn(
        'border-ink-100 flex items-center gap-1 border-t pt-3.5',
        // 窄屏只有两枚胶囊，靠右收；桌面三个按钮平分整行
        !isDesktop && 'justify-end gap-2',
      )}
    >
      {archived ? (
        <RestoreButton
          questionnaireId={questionnaire.id}
          title={questionnaire.title}
          className={cn(isDesktop ? BAR_ITEM : PILL_ITEM, TONE[shape].brand)}
        />
      ) : isDesktop ? (
        closed ? (
          <button
            type="button"
            aria-label={`复制「${questionnaire.title}」`}
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                await copyQuestionnaireAction(questionnaire.id);
              })
            }
            className={cn(item, 'disabled:opacity-45')}
          >
            {pending ? '复制中…' : '复制'}
          </button>
        ) : (
          <Link
            href={`/app/q/${questionnaire.id}/edit`}
            aria-label={`编辑「${questionnaire.title}」`}
            className={item}
          >
            编辑
          </Link>
        )
      ) : null}

      {/* 「数据」每个状态都有：归档了也还能看历史数据（设计稿的归档卡同样保留它） */}
      <Link
        href={`/app/q/${questionnaire.id}/stats`}
        aria-label={`数据「${questionnaire.title}」`}
        className={item}
      >
        数据
      </Link>

      {/* 「分享」只给还能继续收的问卷；已归档的不该再往外发链接 */}
      {archived ? null : (
        <Link
          href={`/app/q/${questionnaire.id}/share`}
          aria-label={`分享「${questionnaire.title}」`}
          className={cn(isDesktop ? BAR_ITEM : PILL_ITEM, TONE[shape].brand)}
        >
          分享
        </Link>
      )}
    </div>
  );
}
