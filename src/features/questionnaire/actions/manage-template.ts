'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { requireActiveWorkspace } from '@/lib/auth/active-workspace';
import { prisma } from '@/lib/db';
import type { FormState } from '@/types/form-state';

import { findEditableTemplate, getTemplateDetail } from '../api/templates';
import { renameTemplateSchema } from '../schemas';

/**
 * 重命名 / 删除「我的模板」。
 *
 * 三条刻意的处理：
 * - 权限 **EDITOR**：模板是可编辑内容（权限矩阵里「编辑问卷内容」那一档）。
 *   官方模板与**别人工作区的模板**一律拒绝 —— 后者靠 `findEditableTemplate`
 *   里那个 `workspaceId` 条件，而不是靠「id 猜不到」。
 * - **官方模板不可改名也不可删**：它是产品内容（由 seed 完全拥有），
 *   用户能改它就会出现「同一个模板在不同人眼里不一样」。
 * - 删除是硬删（模板不含答卷数据，没有「原始记录保留」的问题），但仍要在
 *   二次确认里写清「用过的问卷不受影响」—— 这是用户真正担心的那件事。
 */
export async function renameTemplateAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { workspace } = await requireActiveWorkspace('EDITOR');

  const parsed = renameTemplateSchema.safeParse({
    templateId: formData.get('templateId'),
    title: formData.get('title'),
  });

  const values = { title: String(formData.get('title') ?? '') };

  if (!parsed.success) {
    return { fieldErrors: z.flattenError(parsed.error).fieldErrors, values };
  }

  const template = await findEditableTemplate(parsed.data.templateId, workspace.id);
  if (!template) return { message: '这个模板不在当前工作区里，或它是官方模板' };

  await prisma.template.update({ where: { id: template.id }, data: { title: parsed.data.title } });

  revalidatePath('/app/templates');

  return { success: '已重命名' };
}

/**
 * 预览要用的模板详情。
 *
 * 做成 action 而不是让客户端组件直接调 api：`api/templates.ts` 里有 `import 'server-only'`，
 * 客户端拿不到它 —— 而预览是**打开时按需取**（列表里不带结构快照，弹层才需要）。
 */
export async function loadTemplateForPreviewAction(templateId: string) {
  const { workspace } = await requireActiveWorkspace('VIEWER');
  const detail = await getTemplateDetail(templateId, workspace.id);

  if (!detail) return null;

  return {
    id: detail.id,
    title: detail.title,
    description: detail.description,
    category: detail.category,
    isOfficial: detail.isOfficial,
    payload: detail.payload,
  };
}

export async function deleteTemplateAction(templateId: string) {
  const { workspace } = await requireActiveWorkspace('EDITOR');

  const template = await findEditableTemplate(templateId, workspace.id);
  if (!template) throw new Error('NOT_FOUND');

  await prisma.template.delete({ where: { id: template.id } });

  revalidatePath('/app/templates');
}
