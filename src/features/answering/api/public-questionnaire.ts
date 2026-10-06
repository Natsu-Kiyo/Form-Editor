import 'server-only';

import type { CloseReason, IdentityMode, QuestionType } from '@/config/constants';
import { prisma } from '@/lib/db';
import { formatDateTimeLocal } from '@/utils/format';

/**
 * 公开作答链接（`/s/{slug}`）看到的问卷。
 *
 * 这里承担三件事：
 * 1. 把短链解析成问卷，并**按状态给出不同的画面**（草稿 / 未开始 / 已暂停 / 已截止 / 回收中）——
 *    「链接打不开」与「这份问卷已截止」是两件事，不能都给一个 404。
 * 2. `?src=` 渠道参数的校验：**只认属于这份问卷的 `srcToken`**，
 *    认不出就当没有渠道，绝不把别人的 token 记到这份问卷上。
 * 3. 到期的懒截止：没有定时任务，所以「访问时发现已过结束时间」就把状态落成已截止，
 *    否则列表里会一直显示「回收中」，而链接其实已经不该能填了。
 */
export type PublicQuestion = {
  id: string;
  type: QuestionType;
  title: string;
  description: string | null;
  required: boolean;
  options: string[];
};

export type PublicView =
  | { state: 'NOT_FOUND' }
  | {
      state: 'DRAFT' | 'NOT_STARTED' | 'PAUSED' | 'CLOSED';
      title: string;
      startsAtLabel: string | null;
      endsAtLabel: string | null;
      closeReason: CloseReason | null;
    }
  | {
      state: 'COLLECTING';
      title: string;
      intro: string | null;
      identityMode: IdentityMode;
      /** 口令访问：需要先验口令，作答端在 M5 交付 */
      needsPassword: boolean;
      channelName: string | null;
      questions: PublicQuestion[];
    };

function stamp(date: Date | null) {
  return date ? formatDateTimeLocal(date).replace('T', ' ') : null;
}

export async function getPublicQuestionnaire(
  slug: string,
  srcToken: string | null,
): Promise<PublicView> {
  const row = await prisma.questionnaire.findUnique({
    where: { slug },
    select: {
      id: true,
      title: true,
      intro: true,
      status: true,
      startsAt: true,
      endsAt: true,
      closeReason: true,
      identityMode: true,
      accessPasswordHash: true,
      questions: {
        orderBy: { order: 'asc' },
        select: {
          id: true,
          type: true,
          title: true,
          description: true,
          required: true,
          options: { orderBy: { order: 'asc' }, select: { label: true } },
        },
      },
    },
  });

  if (!row) return { state: 'NOT_FOUND' };

  const now = new Date();
  const base = {
    title: row.title,
    startsAtLabel: stamp(row.startsAt),
    endsAtLabel: stamp(row.endsAt),
    closeReason: row.closeReason as CloseReason | null,
  };

  if (row.status === 'DRAFT') return { state: 'DRAFT', ...base };
  if (row.status === 'ARCHIVED') return { state: 'CLOSED', ...base };
  if (row.status === 'CLOSED') return { state: 'CLOSED', ...base };
  if (row.status === 'PAUSED') return { state: 'PAUSED', ...base };

  // 已发布：还要看时间
  if (row.startsAt && row.startsAt.getTime() > now.getTime()) {
    return { state: 'NOT_STARTED', ...base };
  }

  if (row.endsAt && row.endsAt.getTime() <= now.getTime()) {
    // 懒截止：落库之后列表与分享页都会显示「已截止」，与用户看到的画面一致
    await prisma.questionnaire.update({
      where: { id: row.id },
      data: { status: 'CLOSED', closeReason: 'SCHEDULED', closedAt: row.endsAt },
    });

    return { state: 'CLOSED', ...base, closeReason: 'SCHEDULED' };
  }

  // 渠道参数只认属于这份问卷的 token；认不出就当没带（不报错、也不记到别处）
  const channel = srcToken
    ? await prisma.channel.findFirst({
        where: { questionnaireId: row.id, srcToken },
        select: { name: true },
      })
    : null;

  return {
    state: 'COLLECTING',
    title: row.title,
    intro: row.intro,
    identityMode: row.identityMode as IdentityMode,
    needsPassword: row.accessPasswordHash !== null,
    channelName: channel?.name ?? null,
    questions: row.questions.map((question) => ({
      id: question.id,
      type: question.type as QuestionType,
      title: question.title,
      description: question.description,
      required: question.required,
      options: question.options.map((option) => option.label),
    })),
  };
}
