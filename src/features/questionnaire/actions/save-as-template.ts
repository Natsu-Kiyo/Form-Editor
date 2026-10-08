'use server';

import { revalidatePath } from 'next/cache';

import {
  LEGACY_TEMPLATE_CATEGORY,
  TEMPLATE_CATEGORIES,
  TEMPLATE_CATEGORY_NEW,
} from '@/config/constants';
import type { FormState } from '@/types/form-state';
import { toFieldErrors } from '@/utils/zod-errors';

import { getQuestionnairePayload } from '@/lib/questionnaire-snapshot';
import {
  createTemplate,
  findWorkspaceTemplateByTitle,
  listWorkspaceTemplateCategories,
} from '../api/templates';
import { requireQuestionnaireAccess } from '@/lib/auth/questionnaire-access';
import { saveAsTemplateSchema } from '../schemas';

/**
 * 另存为模板。
 *
 * 分类由用户在弹层里选：**现有分类**（计划书定下的五个 + 本工作区自建模板用过的）
 * 或**新增分类**（下拉选中哨兵值，真实名字在 `newCategory` 里）。
 *
 * 三种失败各说各的话，因为它们要用户做的事不同：
 * - 没选分类 / 新分类名为空 → 字段级提示（schema 管）
 * - 新分类名与**现有分类**重名 → 提示「直接选它」（**只有服务端知道完整清单**：
 *   常量 + 这个工作区已有的，后者要查库）
 * - 模板同名 → 提示换名字（库上的唯一索引才是最终闸门，见 catch）
 */
export async function saveAsTemplateAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const questionnaireId = String(formData.get('questionnaireId') ?? '');
  const { user, questionnaire } = await requireQuestionnaireAccess(questionnaireId, 'EDITOR');

  /** 出错时原样回填，用户不必重打一遍 */
  const values = {
    title: String(formData.get('title') ?? ''),
    description: String(formData.get('description') ?? ''),
    category: String(formData.get('category') ?? ''),
    newCategory: String(formData.get('newCategory') ?? ''),
  };

  const parsed = saveAsTemplateSchema.safeParse({
    title: formData.get('title') ?? questionnaire.title,
    description: formData.get('description') ?? '',
    category: formData.get('category') ?? '',
    newCategory: formData.get('newCategory') ?? '',
  });

  if (!parsed.success) {
    return { fieldErrors: toFieldErrors(parsed.error), values };
  }

  const isNewCategory = parsed.data.category === TEMPLATE_CATEGORY_NEW;
  const category = isNewCategory ? parsed.data.newCategory!.trim() : parsed.data.category;

  if (isNewCategory) {
    const mine = await listWorkspaceTemplateCategories(questionnaire.workspaceId);
    // 老数据那个 `我的模板` 也算「已存在」：重名的话两个分类在界面上分不出来
    const taken = new Set<string>([...TEMPLATE_CATEGORIES, LEGACY_TEMPLATE_CATEGORY, ...mine]);

    if (taken.has(category)) {
      return {
        fieldErrors: { newCategory: ['这个分类已经存在，直接从下拉里选它'] },
        values,
      };
    }
  }

  const data = await getQuestionnairePayload(questionnaireId);
  if (!data) return { message: '读取问卷结构失败，请刷新后重试' };

  // 同名模板会给用户「点了没反应」的错觉，所以直接说清楚
  const duplicated = await findWorkspaceTemplateByTitle(
    questionnaire.workspaceId,
    parsed.data.title,
  );
  if (duplicated) {
    return { fieldErrors: { title: ['已存在同名模板，换个名字或先删除旧的'] }, values };
  }

  try {
    await createTemplate({
      workspaceId: questionnaire.workspaceId,
      ownerId: user.id,
      title: parsed.data.title,
      description: parsed.data.description?.trim() || '自建模板',
      category,
      payload: data.payload,
    });
  } catch (error) {
    /*
     * 上面那次「查同名」只是为了让用户早点看到提示，**它挡不住并发**：
     * 同一个提交在慢环境下被重试两次，两次检查都可能看不到对方尚未写入的行。
     * 真正兜底的是库上的唯一索引（`@@unique([workspaceId, title])`），
     * 这里把它的报错翻译回同一句话 —— 用户不该看到 P2002。
     */
    if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002') {
      return { fieldErrors: { title: ['已存在同名模板，换个名字或先删除旧的'] }, values };
    }

    throw error;
  }

  revalidatePath('/app');
  // 模板中心那页也缓存着：新模板、以及新分类（胶囊）都在那边，不一起失效会看到旧列表
  revalidatePath('/app/templates');

  return { success: `已存为模板「${parsed.data.title}」` };
}
