'use server';

import { revalidatePath } from 'next/cache';

import type { FormState } from '@/types/form-state';
import { toFieldErrors } from '@/utils/zod-errors';

import { getQuestionnairePayload } from '@/lib/questionnaire-snapshot';
import { createTemplate, findWorkspaceTemplateByTitle } from '../api/templates';
import { requireQuestionnaireAccess } from '@/lib/auth/questionnaire-access';
import { saveAsTemplateSchema } from '../schemas';

/** 自建模板的分类。官方模板用具体分类，自建的统一归到这一类（M9 的模板中心再细分） */
const CUSTOM_CATEGORY = '我的模板';

export async function saveAsTemplateAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const questionnaireId = String(formData.get('questionnaireId') ?? '');
  const { user, questionnaire } = await requireQuestionnaireAccess(questionnaireId, 'EDITOR');

  const parsed = saveAsTemplateSchema.safeParse({
    title: formData.get('title') ?? questionnaire.title,
    description: formData.get('description') ?? '',
  });

  if (!parsed.success) {
    return {
      fieldErrors: toFieldErrors(parsed.error),
      values: {
        title: String(formData.get('title') ?? ''),
        description: String(formData.get('description') ?? ''),
      },
    };
  }

  const data = await getQuestionnairePayload(questionnaireId);
  if (!data) return { message: '读取问卷结构失败，请刷新后重试' };

  // 同名模板会给用户「点了没反应」的错觉，所以直接说清楚
  const duplicated = await findWorkspaceTemplateByTitle(
    questionnaire.workspaceId,
    parsed.data.title,
  );
  if (duplicated) {
    return {
      fieldErrors: { title: ['已存在同名模板，换个名字或先删除旧的'] },
      values: { title: parsed.data.title, description: parsed.data.description ?? '' },
    };
  }

  await createTemplate({
    workspaceId: questionnaire.workspaceId,
    ownerId: user.id,
    title: parsed.data.title,
    description: parsed.data.description?.trim() || '自建模板',
    category: CUSTOM_CATEGORY,
    payload: data.payload,
  });

  revalidatePath('/app');
  return { success: `已存为模板「${parsed.data.title}」` };
}
