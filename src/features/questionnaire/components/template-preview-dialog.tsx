'use client';

import { useEffect, useState } from 'react';

import { QuestionPreviewList } from '@/components/questionnaire/question-preview';
import { Modal, ModalContent } from '@/components/ui/modal';

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

            <QuestionPreviewList questions={detail.payload.questions} />
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
