'use client';

import { useState } from 'react';

import { CalendarIcon } from '@/components/icons/ui-icons';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/utils/cn';

/**
 * 双日期选择器（统计页的「时间」筛选）。
 *
 * 它替代了原来的「全部时间 / 最近 7 天 / 最近 30 天」下拉：那几档是固定的窗口，
 * 而实际要回答的问题往往是「这次活动（9/1–9/30）收得怎么样」。
 *
 * 四处刻意的处理：
 * - **没选时显示「开始时间 - 结束时间」**，一眼看出是「没筛」（此时默认全部时间），
 *   而不是像原来那样显示一个「全部时间」把「筛选未生效」和「筛了全部」混在一起。
 * - 弹层里是**两个能直接填**的日期框，不必先勾选什么 —— 这是所有者提过的一条
 *   （发布设置里的开始/结束时间同款）。
 * - **只填一端也算数**：只填开始 = 「从这天起」，只填结束 = 「到这天为止」。
 * - 顺序不对时**不提交**（只提示），免得把「9/30 到 9/1」这种区间送进查询：
 *   它的结果会是空的，而界面看不出是筛选条件的问题。
 */
export function DateRangeFilter({
  from,
  to,
  onChange,
}: {
  /** `yyyy-mm-dd`，null = 不限 */
  from: string | null;
  to: string | null;
  onChange: (next: { from: string | null; to: string | null }) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState({ from: from ?? '', to: to ?? '' });
  const [applied, setApplied] = useState({ from, to });

  // 外部的筛选变了（浏览器后退、从别人分享的链接进来）就同步回草稿 ——
  // 否则弹层里留着上一轮的值，看起来像「改了但没生效」。
  // 用「渲染期间按 props 重置状态」这个官方写法，而不是 effect：
  // effect 里同步 setState 会多渲染一轮，React 的 lint 规则也会直接报错。
  if (applied.from !== from || applied.to !== to) {
    setApplied({ from, to });
    setDraft({ from: from ?? '', to: to ?? '' });
  }

  const { from: draftFrom, to: draftTo } = draft;

  const inverted = Boolean(draftFrom && draftTo && draftFrom > draftTo);

  const apply = (nextFrom: string, nextTo: string) => {
    if (nextFrom && nextTo && nextFrom > nextTo) return;

    onChange({ from: nextFrom || null, to: nextTo || null });
  };

  const edit = (patch: Partial<{ from: string; to: string }>) => {
    const next = { ...draft, ...patch };
    setDraft(next);
    apply(next.from, next.to);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {/* 不设 aria-label：按钮的可见文案就是它的名字（「开始时间 - 结束时间」／「2026-09-01 - 2026-10-05」），
            这样读屏与测试拿到的都是用户看到的那个 */}
        <button
          type="button"
          className={cn(
            'border-ink-200 flex h-8 shrink-0 items-center gap-1.5 rounded-lg border bg-white px-2.5 text-[12.5px] outline-none',
            'hover:border-ink-300 transition-colors duration-150',
          )}
        >
          <CalendarIcon className="text-ink-400 size-3.5 shrink-0" />
          <span className={from ? 'text-ink-700 font-mono' : 'text-ink-400'}>
            {from || '开始时间'}
          </span>
          <span className="text-ink-300">-</span>
          <span className={to ? 'text-ink-700 font-mono' : 'text-ink-400'}>{to || '结束时间'}</span>
        </button>
      </PopoverTrigger>

      <PopoverContent align="start" className="w-[292px] space-y-3">
        <div className="space-y-1.5">
          <label
            htmlFor="stats-range-from"
            className="text-ink-500 block text-[11.5px] font-medium"
          >
            开始时间
          </label>
          <input
            id="stats-range-from"
            type="date"
            value={draftFrom}
            max={draftTo || undefined}
            onChange={(event) => edit({ from: event.target.value })}
            className="border-ink-200 text-ink-700 focus:border-brand-500 h-9 w-full rounded-lg border bg-white px-2.5 text-[12.5px] outline-none"
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="stats-range-to" className="text-ink-500 block text-[11.5px] font-medium">
            结束时间
          </label>
          <input
            id="stats-range-to"
            type="date"
            value={draftTo}
            min={draftFrom || undefined}
            onChange={(event) => edit({ to: event.target.value })}
            className="border-ink-200 text-ink-700 focus:border-brand-500 h-9 w-full rounded-lg border bg-white px-2.5 text-[12.5px] outline-none"
          />
        </div>

        {inverted ? <p className="text-[11.5px] text-red-500">结束时间不能早于开始时间</p> : null}

        <div className="border-ink-100 flex items-center justify-between gap-2 border-t pt-3">
          <span className="text-ink-400 text-[11px]">只填一端也可以，不填就是全部时间</span>
          <Button
            variant="ghost"
            size="sm"
            disabled={!from && !to}
            onClick={() => {
              setDraft({ from: '', to: '' });
              onChange({ from: null, to: null });
            }}
          >
            清空
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
