'use server';

import { revalidatePath } from 'next/cache';

import { requireActiveWorkspace } from '@/lib/auth/active-workspace';

import { findReadableTemplate, setTemplateFavorite } from '../api/templates';

/**
 * 收藏 / 取消收藏模板（X2）。
 *
 * 三条刻意的处理：
 * - 权限是 **VIEWER**：收藏是浏览行为的一部分（给「常用」打个标记），
 *   不改模板、不影响别人 —— 查看者同样能用，不该按「写内容」那一档要求 EDITOR。
 * - 写之前先校验「模板对该工作区可见」：官方 / 别人已公开的 / 本工作区自己的。
 *   不可见的 id（别人的私有模板、不存在的 id）一律拒绝，否则收藏表会被任意 id 塞满。
 * - 收藏按**工作区**记（`TemplateFavorite` 的唯一键是 templateId + workspaceId）：
 *   模板本身就是工作区的资产，成员之间共享同一份收藏。
 */
export async function toggleTemplateFavoriteAction(
  templateId: string,
  favorited: boolean,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { workspace } = await requireActiveWorkspace('VIEWER');

  const template = await findReadableTemplate(templateId, workspace.id);
  if (!template) return { ok: false, message: '这个模板已不可用，刷新后再试' };

  await setTemplateFavorite(workspace.id, template.id, favorited);

  revalidatePath('/app/templates');

  return { ok: true };
}
