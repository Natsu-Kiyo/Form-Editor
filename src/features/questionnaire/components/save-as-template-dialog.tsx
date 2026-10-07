'use client';

import { useActionState, useEffect } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Modal, ModalContent } from '@/components/ui/modal';
import { Textarea } from '@/components/ui/textarea';
import { EMPTY_FORM_STATE } from '@/types/form-state';

import { saveAsTemplateAction } from '../actions/save-as-template';

export function SaveAsTemplateDialog({
  open,
  onOpenChange,
  questionnaireId,
  defaultTitle,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  questionnaireId: string;
  defaultTitle: string;
}) {
  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <ModalContent
        title="另存为模板"
        description="模板保存的是题目结构，不含答卷数据。"
        width="sm"
      >
        {/* 只在打开时挂载：关闭后表单状态随之重置，不会残留上一次的报错 */}
        {open ? (
          <SaveAsTemplateForm
            questionnaireId={questionnaireId}
            defaultTitle={defaultTitle}
            onDone={() => onOpenChange(false)}
          />
        ) : null}
      </ModalContent>
    </Modal>
  );
}

function SaveAsTemplateForm({
  questionnaireId,
  defaultTitle,
  onDone,
}: {
  questionnaireId: string;
  defaultTitle: string;
  onDone: () => void;
}) {
  const [state, formAction, pending] = useActionState(saveAsTemplateAction, EMPTY_FORM_STATE);

  useEffect(() => {
    if (state.success) onDone();
  }, [state.success, onDone]);

  return (
    <form action={formAction} className="space-y-4" noValidate>
      <input type="hidden" name="questionnaireId" value={questionnaireId} />

      <div>
        <Label htmlFor="template-title" required>
          模板名称
        </Label>
        <Input
          id="template-title"
          name="title"
          defaultValue={state.values?.title ?? defaultTitle}
          invalid={Boolean(state.fieldErrors?.title)}
          required
        />
        {state.fieldErrors?.title ? (
          <p className="text-caption mt-1.5 text-rose-500">{state.fieldErrors.title.join('，')}</p>
        ) : null}
      </div>

      <div>
        <Label htmlFor="template-description">模板说明</Label>
        <Textarea
          id="template-description"
          name="description"
          rows={2}
          defaultValue={state.values?.description}
          placeholder="一句话说明这个模板适用什么场景"
        />
      </div>

      {state.message ? <p className="text-caption text-rose-500">{state.message}</p> : null}

      <div className="flex justify-end gap-2 pt-1">
        <Button type="button" variant="ghost" onClick={onDone}>
          取消
        </Button>
        <Button loading={pending} type="submit" disabled={pending}>
          {pending ? '保存中…' : '保存模板'}
        </Button>
      </div>
    </form>
  );
}
