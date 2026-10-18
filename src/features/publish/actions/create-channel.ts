'use server';

import { revalidatePath } from 'next/cache';

import { OPERATION_TYPE, hasAtLeastRole } from '@/config/constants';
import { requireQuestionnaireAccess } from '@/lib/auth/questionnaire-access';
import { prisma } from '@/lib/db';
import { writeOperationLog } from '@/lib/operation-log';
import { toFieldErrors } from '@/utils/zod-errors';

import { createChannelSchema } from '../schemas';

export type CreateChannelResult =
  | { ok: true; message: string }
  | { ok: false; message: string; fieldErrors?: Record<string, string[]> };

/**
 * 由渠道名推一个链接参数。
 *
 * 中文名推不出有意义的拉丁串，所以落成 `ch-xxxxxx` —— **不假装能音译**：
 * 编出一个看不出所以然的拼音，比诚实地给个短码更难排查。
 */
function toSrcToken(name: string) {
  const ascii = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 20);

  if (ascii.length >= 2) return ascii;

  return `ch-${Math.random().toString(36).slice(2, 8)}`;
}

export async function createChannelAction(
  questionnaireId: string,
  input: unknown,
): Promise<CreateChannelResult> {
  // 用 VIEWER 取数据、再自己判 EDITOR：角色不够时**返回一句话**而不是抛异常（审查 #7）
  const access = await requireQuestionnaireAccess(questionnaireId, 'VIEWER');
  if (!hasAtLeastRole(access.role, 'EDITOR')) {
    return { ok: false, message: '你没有新建渠道的权限' };
  }

  const { user, questionnaire } = access;

  // 归档是终点：数据只读保留，不能再长出新的分发渠道（审查 #12）
  if (questionnaire.status === 'ARCHIVED') {
    return { ok: false, message: '已归档的问卷不能新建渠道，请先恢复它' };
  }

  const parsed = createChannelSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0].message,
      fieldErrors: toFieldErrors(parsed.error),
    };
  }

  const srcToken = parsed.data.srcToken || toSrcToken(parsed.data.name);

  try {
    await prisma.channel.create({
      data: { questionnaireId, name: parsed.data.name, srcToken },
    });
  } catch (error) {
    // 链接参数是全站唯一的（`?src=` 要能定位到唯一渠道），撞了就直说
    if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002') {
      return {
        ok: false,
        message: '这个链接参数已被占用，换一个',
        fieldErrors: { srcToken: ['链接参数已被占用'] },
      };
    }

    throw error;
  }

  await writeOperationLog({
    workspaceId: questionnaire.workspaceId,
    actorId: user.id,
    type: OPERATION_TYPE.CHANNEL_CREATE,
    targetType: 'QUESTIONNAIRE',
    targetId: questionnaireId,
    targetName: questionnaire.title,
    detail: { channel: parsed.data.name, src: srcToken },
  });

  revalidatePath(`/app/q/${questionnaireId}/share`);

  return { ok: true, message: `渠道「${parsed.data.name}」已创建` };
}
