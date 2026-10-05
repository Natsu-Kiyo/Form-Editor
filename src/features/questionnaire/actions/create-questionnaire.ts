'use server';

import { revalidatePath } from 'next/cache';

import { requireActiveWorkspace } from '@/lib/auth/active-workspace';
import type { FormState } from '@/types/form-state';

import { createQuestionnaireWithPayload } from '../api/questionnaires';
import { getTemplatePayload } from '../api/templates';
import { CREATE_MODE, createQuestionnaireSchema } from '../schemas';

/** 空白创建的默认标题。真正的标题在编辑器顶栏里改（设计稿 W03 顶栏标题即输入框） */
const UNTITLED = '未命名问卷';

export async function createQuestionnaireAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const { user, workspace } = await requireActiveWorkspace('EDITOR');

  const parsed = createQuestionnaireSchema.safeParse({
    mode: formData.get('mode') ?? CREATE_MODE.BLANK,
    templateId: formData.get('templateId') ?? undefined,
  });

  if (!parsed.success) {
    return { message: '新建参数不正确，请重新选择' };
  }

  if (parsed.data.mode === CREATE_MODE.TEMPLATE) {
    if (!parsed.data.templateId) {
      return { message: '请先选择一个模板' };
    }

    const payload = await getTemplatePayload(parsed.data.templateId);
    if (!payload) {
      return { message: '这个模板的结构已损坏，换一个试试' };
    }

    await createQuestionnaireWithPayload({
      workspaceId: workspace.id,
      ownerId: user.id,
      payload,
      templateId: parsed.data.templateId,
    });
  } else {
    await createQuestionnaireWithPayload({
      workspaceId: workspace.id,
      ownerId: user.id,
      payload: { formatVersion: 1, title: UNTITLED, intro: null, questions: [] },
    });
  }

  revalidatePath('/app');
  return { success: '问卷已创建' };
}
