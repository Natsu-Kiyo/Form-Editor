'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { requireActiveWorkspace } from '@/lib/auth/active-workspace';
import type { FormState } from '@/types/form-state';

import { createQuestionnaireWithPayload } from '../api/questionnaires';
import { getTemplatePayload } from '../api/templates';

/** 空白创建的默认标题。真正的标题在编辑器顶栏里改（设计稿 W03 顶栏标题即输入框） */
const UNTITLED = '未命名问卷';

/**
 * 「新建问卷」弹层的提交（**只做空白创建**）。
 *
 * R64 起弹层里的「从模板创建」改成跳转模板中心 —— 模板中心有搜索、分类、预览与公开池，
 * 这份「从模板创建」的入口收在那边（`createFromTemplateAction`），
 * 所以这里不再解析 mode / templateId，也不再有「选了模板却没选具体哪一个」那种半成品状态。
 */
export async function createQuestionnaireAction(): Promise<FormState> {
  const { user, workspace } = await requireActiveWorkspace('EDITOR');

  const created = await createBlank({ workspaceId: workspace.id, ownerId: user.id });
  if (!created.ok) return { message: created.message };

  revalidatePath('/app');

  // 建完**直接进编辑器**：用户的下一步一定是加题，让他再从列表里找一遍自己刚建的问卷
  // 是纯粹的白跑一趟（弹层里没有标题输入，此时列表里这一行也叫「未命名问卷」，
  // 一排同名卡片里挑错是很自然的事）。
  // 注意：`redirect()` 靠抛错来跳转，所以它必须在任何 try/catch **之外**调用。
  redirect(`/app/q/${created.id}/edit`);
}

/**
 * 「使用此模板」——模板中心那张卡点下去的直接动作。
 *
 * **「从模板创建」现在只有这一个入口**（R64）：新建弹层那张卡是跳转到这里，
 * 挑中哪张卡再点它，落地即编辑器、**中间不加确认层** ——
 * 它在问一个用户刚刚已经回答过的问题（我点了「使用此模板」）。
 */
export async function createFromTemplateAction(templateId: string) {
  const { user, workspace } = await requireActiveWorkspace('EDITOR');

  const created = await createFromTemplate({
    templateId,
    workspaceId: workspace.id,
    ownerId: user.id,
  });

  if (!created.ok) throw new Error(created.message);

  revalidatePath('/app');
  redirect(`/app/q/${created.id}/edit`);
}

/**
 * 移动工作台那个悬浮「＋」。
 *
 * 与弹层里的「空白创建」是同一条路径（同一个 `createBlank`），只是**没有中间层**：
 * 设计稿写得明确 —— ＋ 直接开一份空白问卷进编辑器，把「空白还是从模板」这个选择
 * 留在编辑器里（想从模板开始时，底部导航的「模板」那一格就是入口）。
 */
export async function createBlankQuestionnaireAction() {
  const { user, workspace } = await requireActiveWorkspace('EDITOR');

  const created = await createBlank({ workspaceId: workspace.id, ownerId: user.id });
  if (!created.ok) throw new Error(created.message);

  revalidatePath('/app');
  redirect(`/app/q/${created.id}/edit`);
}

async function createFromTemplate(input: {
  templateId: string;
  workspaceId: string;
  ownerId: string;
}): Promise<{ ok: true; id: string } | { ok: false; message: string }> {
  /*
   * 归属校验收在 `getTemplatePayload` 里（官方 / 别人已公开的 / 本工作区自己的）：
   * 公开池出现之后，「能用的模板」不再等于「所有存在的模板」——
   * 别人刚取消公开的模板，点「使用此模板」时会落到这个分支上。
   */
  const payload = await getTemplatePayload(input.templateId, input.workspaceId);
  if (!payload)
    return { ok: false, message: '这个模板已不可用（可能已被取消公开或删除），换一个试试' };

  const questionnaire = await createQuestionnaireWithPayload({
    workspaceId: input.workspaceId,
    ownerId: input.ownerId,
    payload,
    templateId: input.templateId,
  });

  return { ok: true, id: questionnaire.id };
}

async function createBlank(input: {
  workspaceId: string;
  ownerId: string;
}): Promise<{ ok: true; id: string } | { ok: false; message: string }> {
  const questionnaire = await createQuestionnaireWithPayload({
    workspaceId: input.workspaceId,
    ownerId: input.ownerId,
    payload: { formatVersion: 1, title: UNTITLED, intro: null, questions: [] },
  });

  return { ok: true, id: questionnaire.id };
}
