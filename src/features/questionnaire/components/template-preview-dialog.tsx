'use client';

import { useEffect, useState } from 'react';

import { Modal, ModalContent } from '@/components/ui/modal';
import { QUESTION_TYPE_LABEL, ratingBounds } from '@/config/constants';
import { cn } from '@/utils/cn';

import { loadTemplateForPreviewAction } from '../actions/manage-template';

type TemplateDetail = NonNullable<Awaited<ReturnType<typeof loadTemplateForPreviewAction>>>;

/**
 * 模板预览（W08 的「预览」）。
 *
 * **以作答页的样子呈现**（设计稿的要求）：用户点预览想知道的是「填起来是什么样」，
 * 不是「模板的元数据」。所以这里画的是作答界面本身 —— 但**只读**：
 * 控件不可交互、也不做必答校验，它只是一张「长什么样」的示意图。
 *
 * 结构**按需加载**：列表里不带结构快照，打开弹层时才取一次。
 */
export function TemplatePreviewDialog({
  templateId,
  title,
  open,
  onOpenChange,
}: {
  templateId: string;
  title: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  /**
   * 只有一个状态，且**只在 await 之后**更新。
   *
   * 不另设 `loading` 布尔：那需要在 effect 开头同步 `setLoading(true)`，
   * 而 React 的 lint 规则（正确地）不许 effect 里同步 setState ——
   * 「还没读到」本来就能从 `status` 推出来，不必再维护一个变量。
   */
  const [state, setState] = useState<{
    status: 'LOADING' | 'READY' | 'MISSING';
    detail: TemplateDetail | null;
  }>({ status: 'LOADING', detail: null });

  useEffect(() => {
    if (!open) return;

    let alive = true;

    void loadTemplateForPreviewAction(templateId).then((result) => {
      // 弹层可能在请求回来之前就被关掉了，别往已卸载的组件里塞状态
      if (!alive) return;
      setState(result ? { status: 'READY', detail: result } : { status: 'MISSING', detail: null });
    });

    return () => {
      alive = false;
    };
  }, [open, templateId]);

  const { status, detail } = state;

  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <ModalContent title={title} description="以下是这份模板的作答界面示意（不可填写）" width="lg">
        {status === 'LOADING' ? (
          <p className="text-ink-400 py-8 text-center text-[12.5px]">正在读取模板…</p>
        ) : detail ? (
          <div className="space-y-5">
            <div className="border-ink-100 border-b pb-4">
              <div className="text-ink-900 text-[15px] font-semibold">{detail.title}</div>
              {detail.description ? (
                <p className="text-ink-500 mt-1 text-[12.5px] leading-5">{detail.description}</p>
              ) : null}
              <p className="text-ink-400 mt-2 text-[11.5px]">
                {detail.category} · {detail.payload.questions.length} 题
              </p>
            </div>

            {detail.payload.questions.map((question, index) => (
              <div key={index}>
                <div className="text-ink-800 mb-2 text-[13px] font-medium">
                  {index + 1}. {question.title}
                  {question.required ? <span className="ml-1 text-rose-500">*</span> : null}
                </div>
                {question.description ? (
                  <p className="text-ink-400 mb-2 text-[11.5px]">{question.description}</p>
                ) : null}

                <QuestionPreview
                  type={question.type}
                  options={question.options ?? []}
                  config={question.config}
                />
              </div>
            ))}
          </div>
        ) : (
          <p className="py-8 text-center text-[12.5px] text-rose-600">
            这个模板的结构读不出来（可能已损坏），换一个试试
          </p>
        )}
      </ModalContent>
    </Modal>
  );
}

/** 各题型的「长什么样」。一律只读：预览不是填写。 */
function QuestionPreview({
  type,
  options,
  config,
}: {
  type: keyof typeof QUESTION_TYPE_LABEL;
  options: string[];
  config: unknown;
}) {
  const bounds = ratingBounds((config ?? {}) as { min?: number; max?: number });
  const readOnlyBox =
    'border-ink-200 text-ink-400 bg-ink-50/60 rounded-[10px] border px-3 h-10 text-[12.5px] flex items-center';

  if (type === 'SINGLE' || type === 'MULTI' || type === 'DROPDOWN') {
    return (
      <div className="space-y-1.5">
        {options.map((option) => (
          <div key={option} className="text-ink-600 flex items-center gap-2.5 text-[12.5px]">
            <span
              className={cn(
                'border-ink-300 size-4 shrink-0 border',
                type === 'MULTI' ? 'rounded-[4px]' : 'rounded-full',
              )}
            />
            {option}
          </div>
        ))}
      </div>
    );
  }

  if (type === 'RATING') {
    return (
      <div className="text-ink-400 flex items-center gap-1.5 text-[13px]">
        {Array.from({ length: bounds.max - bounds.min + 1 }, (_, index) => (
          <span
            key={index}
            className="border-ink-300 text-ink-500 flex size-7 items-center justify-center rounded-md border text-[11.5px]"
          >
            {bounds.min + index}
          </span>
        ))}
      </div>
    );
  }

  if (type === 'DATE') {
    return <div className={readOnlyBox}>yyyy-mm-dd</div>;
  }

  return (
    <div className={cn(readOnlyBox, type === 'LONG_TEXT' && 'h-16 items-start py-2.5')}>
      在此填写…
    </div>
  );
}
