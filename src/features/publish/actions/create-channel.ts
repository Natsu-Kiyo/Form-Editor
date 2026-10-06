'use server';

import { revalidatePath } from 'next/cache';

import { OPERATION_TYPE } from '@/config/constants';
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
  const { user, questionnaire } = await requireQuestionnaireAccess(questionnaireId, 'EDITOR');

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
    type: OPERATION_TYPE.SETTINGS,
    targetType: 'QUESTIONNAIRE',
    targetId: questionnaireId,
    targetName: questionnaire.title,
    detail: { channel: parsed.data.name, src: srcToken },
  });

  revalidatePath(`/app/q/${questionnaireId}/share`);

  return { ok: true, message: `渠道「${parsed.data.name}」已创建` };
}
