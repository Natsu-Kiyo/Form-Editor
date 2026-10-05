'use client';

import { useActionState, useEffect } from 'react';

import { UploadIcon } from '@/components/icons/ui-icons';
import { Button } from '@/components/ui/button';
import { Modal, ModalContent } from '@/components/ui/modal';
import { EMPTY_FORM_STATE } from '@/types/form-state';

import { importQuestionnaireJsonAction } from '../actions/import-json';

export function ImportJsonDialog({
  open,
  onOpenChange,
  questionnaireId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  questionnaireId: string;
}) {
  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <ModalContent title="导入 JSON" width="sm">
        {open ? (
          <ImportJsonForm questionnaireId={questionnaireId} onDone={() => onOpenChange(false)} />
        ) : null}
      </ModalContent>
    </Modal>
  );
}

function ImportJsonForm({
  questionnaireId,
  onDone,
}: {
  questionnaireId: string;
  onDone: () => void;
}) {
  const [state, formAction, pending] = useActionState(
    importQuestionnaireJsonAction,
    EMPTY_FORM_STATE,
  );

  useEffect(() => {
    if (state.success) onDone();
  }, [state.success, onDone]);

  return (
    <form action={formAction} className="space-y-4" noValidate>
      <input type="hidden" name="questionnaireId" value={questionnaireId} />

      <label className="border-ink-300 hover:border-brand-300 flex cursor-pointer flex-col items-center gap-2 rounded-[10px] border border-dashed px-4 py-6 text-center transition-colors duration-150">
        <UploadIcon className="text-ink-400 size-5" />
        <span className="text-ink-700 text-[12.5px] font-medium">选择结构 JSON 文件</span>
        <span className="text-ink-400 text-[11px]">即「导出 JSON」下发的那个文件</span>
        <input type="file" name="file" accept="application/json,.json" className="sr-only" />
      </label>

      <div className="bg-ink-50 border-ink-100 rounded-[10px] border p-3">
        <p className="text-ink-500 text-[11.5px] leading-5">
          导入会用文件里的结构<b className="text-ink-700">替换</b>当前的题目结构，原有题目会被清空。
          只有草稿可以导入 —— 已发布的问卷题目结构是冻结的。
        </p>
      </div>

      {state.message ? <p className="text-caption text-rose-500">{state.message}</p> : null}
      {state.success ? <p className="text-caption text-emerald-600">{state.success}</p> : null}

      <div className="flex justify-end gap-2 pt-1">
        <Button type="button" variant="ghost" onClick={onDone}>
          取消
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? '导入中…' : '确认导入'}
        </Button>
      </div>
    </form>
  );
}
