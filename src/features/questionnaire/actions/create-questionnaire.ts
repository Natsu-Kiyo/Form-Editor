'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

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

  // 先把「用哪个模板」这件事定下来，再决定走哪条创建路径 ——
  // 否则「选了模板却没选具体哪一个」这种半成品状态要判两次
  const target =
    parsed.data.mode === CREATE_MODE.TEMPLATE
      ? parsed.data.templateId
        ? ({ kind: 'TEMPLATE', templateId: parsed.data.templateId } as const)
        : null
      : ({ kind: 'BLANK' } as const);

  if (!target) return { message: '请先选择一个模板' };

  const created =
    target.kind === 'TEMPLATE'
      ? await createFromTemplate({
          templateId: target.templateId,
          workspaceId: workspace.id,
          ownerId: user.id,
        })
      : await createBlank({ workspaceId: workspace.id, ownerId: user.id });

  if (!created.ok) return { message: created.message };

  revalidatePath('/app');

  // 建完**直接进编辑器**：用户的下一步一定是加题，让他再从列表里找一遍自己刚建的问卷
  // 是纯粹的白跑一趟（弹层里没有标题输入，此时列表里这一行也叫「未命名问卷」，
  // 一排同名卡片里挑错是很自然的事）。
  // 注意：`redirect()` 靠抛错来跳转，所以它必须在任何 try/catch **之外**调用。
  redirect(`/app/q/${created.id}/edit`);
}

/**
 * 「使用此模板」。
 *
 * 与新建弹层里的「从模板创建」是**同一条路径**（同一个 `createFromTemplate`），
 * 只是入口不同：模板中心那张卡点下去就该直接进编辑器，**中间不加确认层** ——
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
  const payload = await getTemplatePayload(input.templateId);
  if (!payload) return { ok: false, message: '这个模板的结构已损坏，换一个试试' };

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
