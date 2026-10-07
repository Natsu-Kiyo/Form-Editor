'use client';

import { useTransition } from 'react';

import { CheckCircleIcon, CloseIcon, InfoIcon } from '@/components/icons/ui-icons';
import { Button } from '@/components/ui/button';
import { cn } from '@/utils/cn';

import { setResponseValidityAction } from '../actions/invalidate-response';
import type { ResponseDetail } from '../api/responses';

/**
 * 答卷详情（W07 右侧那一栏）。
 *
 * 它是**一栏而不是弹层**：看明细时人一直在上下比对本份答卷与列表，
 * 弹层会把列表挡住。关闭 = 去掉 URL 上的 `selected`（列表本身还在）。
 *
 * 三种作答形态的呈现与统计页同一套读法：选项看清选了哪几个、评分看分数本身、
 * 填空保留换行。
 */
export function ResponseDetailPanel({
  detail,
  closeHref,
  canEdit,
}: {
  detail: ResponseDetail;
  closeHref: string;
  canEdit: boolean;
}) {
  const [pending, startTransition] = useTransition();

  const toggle = (invalid: boolean) =>
    startTransition(async () => {
      await setResponseValidityAction({ responseId: detail.id, invalid });
    });

  return (
    // aria-label 不只是给读屏用的：页面外壳的侧栏也是 `<aside>`，
    // 有了这个名字，「哪一块是答卷详情」才有一个可指认的说法
    <aside
      aria-label="答卷详情"
      className="border-ink-200 w-[360px] shrink-0 self-start overflow-hidden rounded-xl border bg-white"
    >
      <div className="border-ink-100 flex items-start justify-between gap-2 border-b px-5 py-4">
        <div>
          <div className="text-ink-900 flex items-center gap-2 text-[13.5px] font-semibold">
            答卷 #{detail.serial}
            {!detail.valid ? (
              <span className="bg-ink-100 text-ink-500 inline-flex h-5 items-center rounded-full px-2 text-[10.5px] font-medium">
                已标记无效
              </span>
            ) : null}
          </div>
          <div className="text-ink-400 mt-0.5 font-mono text-[11.5px]">
            {detail.submittedAtLabel}
            {detail.durationLabel ? ` · 用时 ${detail.durationLabel}` : ''}
          </div>
        </div>

        <a
          href={closeHref}
          aria-label="关闭详情"
          className="text-ink-400 hover:bg-ink-100 flex size-7 shrink-0 items-center justify-center rounded-md transition-colors duration-150"
        >
          <CloseIcon className="size-4" />
        </a>
      </div>

      <div className="space-y-4 p-5">
        <Meta label="渠道" value={detail.channelName ?? '无渠道标记'} />
        <Meta label="身份" value={detail.identityLabel} />
        {detail.effectiveAddress ? <Meta label="提交方式" value={detail.effectiveAddress} /> : null}
        {detail.invalidatedLabel ? <Meta label="标记无效" value={detail.invalidatedLabel} /> : null}

        <div className="border-ink-100 space-y-4 border-t pt-4">
          {detail.items.map((item, index) => (
            <div key={item.questionId}>
              <div className="text-ink-400 mb-1.5 text-[11.5px]">
                Q{index + 1} · {item.title}
              </div>
              <AnswerView display={item.display} />
            </div>
          ))}

          {detail.items.length === 0 ? (
            <p className="text-ink-400 text-[12.5px]">这份问卷还没有题目。</p>
          ) : null}
        </div>

        {canEdit ? (
          <div className="border-ink-100 border-t pt-4">
            {detail.valid ? (
              <>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => toggle(true)}
                  className="h-9 w-full rounded-[10px] border border-rose-200 bg-rose-50 text-[12.5px] font-medium text-rose-600 transition-colors duration-150 hover:bg-rose-100 disabled:opacity-45"
                >
                  {pending ? '处理中…' : '标记为无效答卷'}
                </button>
                <p className="text-ink-400 mt-2 text-[11px] leading-5">
                  标记后该答卷将从统计图表中排除，但原始记录保留。
                </p>
              </>
            ) : (
              <>
                <Button
                  loading={pending}
                  variant="outline"
                  className="w-full"
                  disabled={pending}
                  onClick={() => toggle(false)}
                >
                  <CheckCircleIcon className="size-3.5" />
                  {pending ? '处理中…' : '恢复为有效答卷'}
                </Button>
                <p className="text-ink-400 mt-2 text-[11px] leading-5">
                  恢复后它重新计入统计图表与回收份数。
                </p>
              </>
            )}
          </div>
        ) : (
          <p className="text-ink-400 border-ink-100 border-t pt-4 text-[11.5px] leading-5">
            你是查看者，不能标记答卷的有效性。
          </p>
        )}
      </div>
    </aside>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline gap-2 text-[12px]">
      <span className="text-ink-400 w-14 shrink-0">{label}</span>
      <span className="text-ink-700">{value}</span>
    </div>
  );
}

/** 作答值的三种读法（与统计页一致：选项 / 评分 / 文本） */
function AnswerView({ display }: { display: ResponseDetail['items'][number]['display'] }) {
  if (display.kind === 'EMPTY') {
    return (
      <span className="text-ink-400 bg-ink-50 inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-[12.5px]">
        <InfoIcon className="size-3.5" />
        未作答
      </span>
    );
  }

  if (display.kind === 'RATING') {
    return (
      <div className="flex items-center gap-2">
        <span className="text-brand-500 font-mono text-[20px] leading-6 font-semibold">
          {display.score}
        </span>
        <span className="text-ink-400 text-[11.5px]">/ {display.max} 分</span>
        <span className="text-[12px] tracking-tight text-amber-400">
          {'★'.repeat(Math.max(0, Math.min(display.score, 10)))}
        </span>
      </div>
    );
  }

  if (display.kind === 'CHOICE') {
    // 多选按设计稿给彩色标签（要看清选了哪几个），单选给一行文本块
    if (display.multi) {
      return (
        <div className="flex flex-wrap gap-1.5">
          {display.options.map((option) => (
            <span
              key={option}
              className="text-brand-600 bg-brand-50 rounded-lg px-3 py-1.5 text-[12.5px]"
            >
              {option}
            </span>
          ))}
        </div>
      );
    }

    return <TextBlock text={display.options.join('、')} />;
  }

  return <TextBlock text={display.text} />;
}

function TextBlock({ text }: { text: string }) {
  return (
    <div
      className={cn(
        'text-ink-800 bg-ink-50 rounded-lg px-3 py-2 text-[13px] leading-5',
        // 填空里的换行是人写出来的，不该被 CSS 吃掉
        'break-words whitespace-pre-wrap',
      )}
    >
      {text}
    </div>
  );
}
