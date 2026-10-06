'use client';

import { useTransition } from 'react';

import { cn } from '@/utils/cn';

import { restoreQuestionnaireAction } from '../actions/archive-questionnaire';

/**
 * 归档卡片的「恢复」。
 *
 * 恢复后的状态由服务端决定（曾发布过 → 已截止；从未发布 → 草稿），
 * 界面不猜、也不传状态 —— 状态机只应该有一个执行者。
 *
 * 外观由调用方给（`className`）：它要和同一行里的「数据」长得一样，
 * 而那一行的形状在桌面与窄屏是两套（见 `card-primary-actions.tsx`）。
 */
export function RestoreButton({
  questionnaireId,
  title,
  className,
}: {
  questionnaireId: string;
  /** 用于给按钮一个能区分到具体问卷的无障碍名称 */
  title: string;
  className?: string;
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
      className={cn('disabled:opacity-45', className)}
    >
      {pending ? '恢复中…' : '恢复'}
    </button>
  );
}
