'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { OPERATION_TYPE } from '@/config/constants';
import { requireActiveWorkspace } from '@/lib/auth/active-workspace';
import { prisma } from '@/lib/db';
import { writeOperationLog } from '@/lib/operation-log';
import { createRateLimiter } from '@/lib/rate-limit';
import type { FormState } from '@/types/form-state';
import { toFieldErrors } from '@/utils/zod-errors';

import {
  countWorkspacePublicTemplates,
  findEditableTemplate,
  getTemplateDetail,
  setTemplatePrivate,
  setTemplatePublic,
} from '../api/templates';
import { canPublishTemplate } from '../lib/template-publish';
import { publishTemplateSchema, renameTemplateSchema } from '../schemas';

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
  const { user, workspace } = await requireActiveWorkspace('EDITOR');

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

  try {
    await prisma.template.update({
      where: { id: template.id },
      data: { title: parsed.data.title },
    });
  } catch (error) {
    // 同一工作区不允许同名（库上有唯一索引），撞上时给一句人话而不是 P2002
    if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002') {
      return {
        fieldErrors: { title: ['已存在同名模板，换个名字'] },
        values: { title: parsed.data.title },
      };
    }

    throw error;
  }

  await writeOperationLog({
    workspaceId: workspace.id,
    actorId: user.id,
    type: OPERATION_TYPE.TEMPLATE_RENAME,
    targetType: 'TEMPLATE',
    targetId: template.id,
    // 记**改之前**的名字：日志说的是「把模板 X 改了名」，X 是那个能被人认出来的旧名
    targetName: template.title,
    detail: { to: parsed.data.title },
  });

  revalidatePath('/app/templates');
  revalidatePath('/app/logs');

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

export type DeleteTemplateResult = { ok: true } | { ok: false; message: string };

/**
 * 删除「我的模板」。
 *
 * 「模板已不可编辑」是用户可达的预期失败（另一个管理员刚删了它、页面开着没刷新），
 * 所以**返回**而不是抛 —— 抛出去调用侧只会把确认弹层复位，用户看不到任何原因。
 */
export async function deleteTemplateAction(templateId: string): Promise<DeleteTemplateResult> {
  const { user, workspace } = await requireActiveWorkspace('EDITOR');

  const template = await findEditableTemplate(templateId, workspace.id);
  if (!template)
    return { ok: false, message: '这个模板已不可编辑（可能已被删除或不属于本工作区）' };

  await prisma.template.delete({ where: { id: template.id } });

  await writeOperationLog({
    workspaceId: workspace.id,
    actorId: user.id,
    type: OPERATION_TYPE.TEMPLATE_DELETE,
    targetType: 'TEMPLATE',
    targetId: template.id,
    targetName: template.title,
    // 记**题数**（顺带修掉一个旧 bug：这里原先数的是模板行数，恒为 1）
    detail: { questions: template.questionCount },
  });

  revalidatePath('/app/templates');
  revalidatePath('/app/logs');

  return { ok: true };
}

/**
 * 公开 / 取消公开的频次限流（防污染四件套里的「限流」）。
 *
 * 配额（`TEMPLATE_PUBLIC_LIMIT = 10`）管的是「池子里最多有几张」，
 * 限流管的是**反复公开 / 取消公开**：不拦的话，一次恶意脚本就能把操作日志刷爆
 * （每次状态变化都会留痕），而且每次都在跨区域往返上白烧钱。
 *
 * 按**工作区**计数（而不是按人）：公开的配额也是按工作区的，两处口径一致。
 *
 * 参数调过一版（用户实测反馈）：最早是「10 分钟 10 次」，还是太重 —— 测试时连点
 * 几次就被拦、要等 9 分钟。现在改成 **5 秒 1 次**：防高频刷仍然成立
 * （每次操作都要跨区域写库 + 写日志）。
 *
 * key 按**动作**分开（`workspace:publish` / `workspace:unpublish`）：同一种操作
 * 5 秒内不能重复，但「公开 → 改主意 → 取消公开」这种**来回**操作互不拖累 ——
 * 那正是最常见的正常用法（合并计数时，E2E 的「公开 → 取消」链路当场被拦，
 * 证明这个区分是必要的）。
 */
const visibilityLimiter = createRateLimiter({ limit: 1, windowMs: 5_000 });

/** 限流的提示。5 秒级的窗口不报精确秒数：说「稍后再试」比「请 1 分钟后再试」自然 */
const RATE_LIMIT_MESSAGE = '操作过于频繁，请稍后再试';

/**
 * 设为公开（X2）。
 *
 * 四道闸门在这一个 action 里合拢（**界面上的 disabled 只是提示，不是安全边界**）：
 * 1. 权限 **ADMIN**（对外动作，与「发布」同档，见 `permissions-matrix.ts`）；
 * 2. 配额 + 内容门槛 —— `canPublishTemplate` 纯函数，**与菜单里的灰显判断同一份**；
 * 3. 频次限流（见上）；
 * 4. 归属校验 —— 官方模板与别人的模板根本读不到（`findEditableTemplate`）。
 *
 * 描述与分类在弹层里就地补齐（模板创建后没有编辑它们的入口），
 * 所以这个 action 是表单式的（带 `FormState` 回传，错在哪用户看得见）。
 */
export async function publishTemplateAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { user, workspace } = await requireActiveWorkspace('ADMIN');

  const parsed = publishTemplateSchema.safeParse({
    templateId: formData.get('templateId'),
    description: formData.get('description'),
    category: formData.get('category'),
  });

  const values = {
    description: String(formData.get('description') ?? ''),
    category: String(formData.get('category') ?? ''),
  };

  if (!parsed.success) {
    return { fieldErrors: toFieldErrors(parsed.error), values };
  }

  const template = await findEditableTemplate(parsed.data.templateId, workspace.id);
  if (!template) return { message: '这个模板不在当前工作区里，或它是官方模板', values };

  const publicCount = await countWorkspacePublicTemplates(workspace.id);
  const check = canPublishTemplate({
    description: parsed.data.description,
    questionCount: template.questionCount,
    category: parsed.data.category,
    publicCount,
  });

  if (!check.ok) return { message: check.reasons[0], values };

  const gate = visibilityLimiter.consume(`${workspace.id}:publish`);
  if (!gate.ok) return { message: RATE_LIMIT_MESSAGE, values };

  await setTemplatePublic({
    templateId: template.id,
    description: parsed.data.description,
    category: parsed.data.category,
  });

  await writeOperationLog({
    workspaceId: workspace.id,
    actorId: user.id,
    type: OPERATION_TYPE.TEMPLATE_PUBLISH,
    targetType: 'TEMPLATE',
    targetId: template.id,
    targetName: template.title,
    detail: { category: parsed.data.category },
  });

  revalidatePath('/app/templates');
  revalidatePath('/app/logs');

  return { success: '已公开到公开池' };
}

/**
 * 取消公开。
 *
 * **可撤销是刻意的**：垃圾撤得回、误操作有退路，用户才敢用这个功能。
 * 取消即从公开池消失（别人已用它建出来的问卷不受影响 —— 那是独立的一份）。
 * 不需要二次确认：它不是破坏性动作，重新公开即可恢复。
 */
export async function unpublishTemplateAction(
  templateId: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { user, workspace } = await requireActiveWorkspace('ADMIN');

  const template = await findEditableTemplate(templateId, workspace.id);
  if (!template) return { ok: false, message: '这个模板不在当前工作区里，或它是官方模板' };

  const gate = visibilityLimiter.consume(`${workspace.id}:unpublish`);
  if (!gate.ok) return { ok: false, message: RATE_LIMIT_MESSAGE };

  await setTemplatePrivate(template.id);

  await writeOperationLog({
    workspaceId: workspace.id,
    actorId: user.id,
    type: OPERATION_TYPE.TEMPLATE_UNPUBLISH,
    targetType: 'TEMPLATE',
    targetId: template.id,
    targetName: template.title,
  });

  revalidatePath('/app/templates');
  revalidatePath('/app/logs');

  return { ok: true };
}
