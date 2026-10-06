import 'server-only';

import { prisma } from '@/lib/db';

/**
 * 写一条（或多条）站内通知。
 *
 * 为什么放 shared 层：这是**第一个会往通知表里写东西的地方** —— 在此之前
 * 通知只有 seed 预置，面板上那句「成员加入、回收达标这类事件会出现在这里」
 * 其实是个空头承诺。而写通知的调用方分散在成员、作答两个 feature 里，
 * 让它们各自去碰 `prisma.notification` 必然漂移（这个 feature 记了 linkUrl、
 * 那个没记，用户点了通知不知道去哪）。与 `lib/operation-log.ts` 同一条理由。
 *
 * 与写日志一样**不向上抛错**：通知是副产物，不该让「提交答卷」这种主操作失败。
 * 失败只落服务端日志。
 */
export type NotifyInput = {
  /** 收件人。传空数组直接返回（调用方常常要先查一批人，空是正常情况） */
  userIds: string[];
  /** 事件类型，与 seed 里那几条保持同一套字符串（`MEMBER_JOINED` / `RESPONSE_MILESTONE` …） */
  type: string;
  title: string;
  body?: string;
  /** 点了通知去哪。**能落到具体页面才给** —— 给一个跳不动的链接等于假入口 */
  linkUrl?: string;
  /** 排除自己：自己干的事不必通知自己 */
  exceptUserId?: string | null;
};

export async function notifyUsers(input: NotifyInput) {
  const recipients = [...new Set(input.userIds)].filter((id) => id && id !== input.exceptUserId);
  if (recipients.length === 0) return;

  try {
    await prisma.notification.createMany({
      data: recipients.map((userId) => ({
        userId,
        type: input.type,
        title: input.title,
        body: input.body ?? null,
        linkUrl: input.linkUrl ?? null,
      })),
    });
  } catch (error) {
    console.error('[notify] 写入失败', error);
  }
}

/** 工作区里管事的那些人（所有者 + 管理员）。「某某加入了」「收满了」该告诉他们 */
export async function getWorkspaceAdminIds(workspaceId: string) {
  const rows = await prisma.membership.findMany({
    where: { workspaceId, role: { in: ['OWNER', 'ADMIN'] } },
    select: { userId: true },
  });

  return rows.map((row) => row.userId);
}
