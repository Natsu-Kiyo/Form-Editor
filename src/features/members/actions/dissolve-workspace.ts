'use server';

import { revalidatePath } from 'next/cache';

import { DISSOLVE_CONFIRM_TEXT } from '@/config/constants';
import { requireActiveWorkspace } from '@/lib/auth/active-workspace';
import { landAfterWorkspaceGone } from '@/lib/auth/workspace-lifecycle';
import { prisma } from '@/lib/db';

export type DissolveWorkspaceResult = { ok: true } | { ok: false; message: string };

/**
 * 解散工作区（仅所有者）。
 *
 * 这是全站唯一「一条语句删掉一大片数据」的动作 —— 问卷、答卷、模板、成员与
 * 操作日志都随 `workspace.delete` 级联消失（见 schema 各表的 `onDelete: Cascade`）。
 * 三条刻意的处理：
 * - **权限在服务端再判一次**（OWNER）：界面只在所有者那一行画入口，那不是安全边界；
 * - **确认文字服务端再比一次**：界面上「输入对了才可点」只是即时反馈；
 * - **不写操作日志**：`OperationLog` 随工作区级联删除，写了等于没写 ——
 *   这个动作的"记录"方式就是数据都没了本身，「不可撤销」的分量由输入确认承担。
 *
 * 成功后把自己安顿到别的工作区（一个都不剩就补一个新的，见 `landAfterWorkspaceGone`）——
 * 不这么做用户会落在 `NO_WORKSPACE` 的异常页上。**导航交给调用方**（成功返回 `{ ok: true }`，
 * 弹窗自己 `router.push('/app')`）：与删除问卷同一条分工，行动作只管数据、
 * 跳转由界面决定，服务端不替客户端决定"下一步去哪"。
 */
export async function dissolveWorkspaceAction(
  confirmText: string,
): Promise<DissolveWorkspaceResult> {
  const { user, workspace } = await requireActiveWorkspace('OWNER');

  if (confirmText.trim() !== DISSOLVE_CONFIRM_TEXT) {
    return { ok: false, message: `请输入「${DISSOLVE_CONFIRM_TEXT}」以确认` };
  }

  await prisma.workspace.delete({ where: { id: workspace.id } });

  await landAfterWorkspaceGone(user);

  revalidatePath('/app', 'layout');

  return { ok: true };
}
