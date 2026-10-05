'use client';

import { useTransition } from 'react';

import { restoreQuestionnaireAction } from '../actions/archive-questionnaire';

/**
 * 归档卡片的「恢复」。
 *
 * 恢复后的状态由服务端决定（曾发布过 → 已截止；从未发布 → 草稿），
 * 界面不猜、也不传状态 —— 状态机只应该有一个执行者。
 */
export function RestoreButton({
  questionnaireId,
  title,
}: {
  questionnaireId: string;
  /** 用于给按钮一个能区分到具体问卷的无障碍名称 */
  title: string;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      aria-label={`恢复「${title}」`}
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await restoreQuestionnaireAction(questionnaireId);
        })
      }
      className="text-brand-500 hover:bg-brand-50 h-8 flex-1 rounded-lg text-[12.5px] font-medium transition-colors duration-150 disabled:opacity-45"
    >
      {pending ? '恢复中…' : '恢复'}
    </button>
  );
}
