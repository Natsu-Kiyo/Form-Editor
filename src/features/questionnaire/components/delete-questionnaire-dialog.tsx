'use client';

import { useTransition } from 'react';

import { AlertCircleIcon } from '@/components/icons/ui-icons';
import { Button } from '@/components/ui/button';
import { Modal, ModalContent } from '@/components/ui/modal';

import { deleteQuestionnaireAction } from '../actions/delete-questionnaire';

/**
 * 删除问卷的二次确认（设计稿 W11 的危险操作对话框）。
 *
 * 文案里必须带**具体份数**：只说「及其答卷」用户无法判断损失有多大，
 * 说了「24 份」他才知道要不要先导出。
 */
export function DeleteQuestionnaireDialog({
  open,
  onOpenChange,
  questionnaireId,
  title,
  responseCount,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  questionnaireId: string;
  title: string;
  responseCount: number;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      {/* 危险操作对话框的标题画在正文里（设计稿如此），所以头部标题视觉隐藏，仅保留给读屏 */}
      <ModalContent title="确定删除这份问卷？" hideTitle width="sm">
        <div className="mb-4 flex size-11 items-center justify-center rounded-xl bg-rose-50">
          <AlertCircleIcon className="size-5 text-rose-500" />
        </div>

        <h3 className="text-ink-900 mb-2 text-[16px] font-semibold">确定删除这份问卷？</h3>
        <p className="text-ink-500 mb-5 text-[12.5px] leading-5">
          「{title}」{responseCount > 0 ? `及其 ${responseCount} 份答卷` : '及其题目结构'}
          将被删除，此操作不可撤销。
        </p>

        <div className="bg-ink-50 border-ink-100 mb-5 rounded-[10px] border p-3">
          <div className="text-ink-500 text-[11.5px] leading-5">
            如需保留数据，建议先导出答卷，或改为「归档」将其从列表中折叠。
          </div>
        </div>

        <div className="flex gap-2.5">
          <Button
            type="button"
            variant="outline"
            className="flex-1"
            onClick={() => onOpenChange(false)}
          >
            取消
          </Button>
          <Button
            type="button"
            variant="danger"
            className="flex-1"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                await deleteQuestionnaireAction(questionnaireId);
                onOpenChange(false);
              })
            }
          >
            {pending ? '删除中…' : '确认删除'}
          </Button>
        </div>
      </ModalContent>
    </Modal>
  );
}
