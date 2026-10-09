'use server';

import { cookies, headers } from 'next/headers';
import { revalidatePath } from 'next/cache';

import { matrixColumns } from '@/config/constants';
import { getCurrentUser } from '@/lib/auth/dal';
import { prisma } from '@/lib/db';
import { notifyUsers } from '@/lib/notify';
import { toJsonColumn } from '@/lib/json';

import {
  findChannelId,
  countExistingResponse,
  loadSubmissionContext,
  type UnavailableKind,
} from '../api/public-questionnaire';
import { parseAnswers } from '../lib/answers';
import { buildFingerprint } from '../lib/fingerprint';
import { isUnlocked } from '../lib/unlock';

export type SubmitResponseResult =
  | { ok: true; responseId: string; serial: number }
  | { ok: false; kind: 'VALIDATION'; fieldErrors: Record<string, string> }
  | { ok: false; kind: 'UNAVAILABLE'; state: UnavailableKind | 'NOT_FOUND' }
  | { ok: false; kind: 'ERROR'; message: string };

/**
 * 提交答卷 —— 作答端唯一的写入口。
 *
 * 闸门顺序是刻意的：**先判「还能不能收」，再判「能不能是他」，最后才校验答案**。
 * 反过来会出现最糟的提示：「第 3 题必答」—— 而这份问卷其实早就截止了，
 * 用户改完第 3 题再提交，还是失败。
 *
 * 服务端把公开页那套状态判断**再走一遍**（不是信任页面）：页面与提交之间隔着用户的思考时间，
 * 期间问卷可能刚被截止、刚被收满、或者他已经在另一个标签页提交过一次。
 */
/** 匿名重复判定用的浏览器标识；由作答页在客户端种进 Cookie */
const CLIENT_ID_COOKIE = 'qw_client_id';

export async function submitResponseAction(input: {
  slug: string;
  answers: unknown;
  srcToken: string | null;
  /** 从打开作答页到点提交的毫秒数。统计页的「平均用时」用它 */
  durationMs: number | null;
}): Promise<SubmitResponseResult> {
  const context = await loadSubmissionContext(input.slug);
  if (!context) return { ok: false, kind: 'UNAVAILABLE', state: 'NOT_FOUND' };

  const now = new Date();
  const user = await getCurrentUser();
  const requestHeaders = await headers();
  const userAgent = requestHeaders.get('user-agent');

  // ---- 身份闸门 ----
  if (context.identityMode === 'LOGIN_REQUIRED' && !user) {
    return { ok: false, kind: 'ERROR', message: '这份问卷需要登录后才能作答' };
  }

  if (
    context.identityMode === 'PASSWORD' &&
    !(await isUnlocked(context.id, context.accessPassword))
  ) {
    return { ok: false, kind: 'ERROR', message: '请先输入访问口令' };
  }

  // ---- 状态闸门（与公开页同一套判断）----
  if (context.status === 'DRAFT') return { ok: false, kind: 'UNAVAILABLE', state: 'DRAFT' };
  if (context.status === 'PAUSED') return { ok: false, kind: 'UNAVAILABLE', state: 'PAUSED' };
  if (context.status === 'ARCHIVED' || context.status === 'CLOSED') {
    return { ok: false, kind: 'UNAVAILABLE', state: 'CLOSED' };
  }
  if (context.startsAt && context.startsAt.getTime() > now.getTime()) {
    return { ok: false, kind: 'UNAVAILABLE', state: 'NOT_STARTED' };
  }
  if (context.endsAt && context.endsAt.getTime() <= now.getTime()) {
    await prisma.questionnaire.update({
      where: { id: context.id },
      data: { status: 'CLOSED', closeReason: 'SCHEDULED', closedAt: context.endsAt },
    });

    return { ok: false, kind: 'UNAVAILABLE', state: 'CLOSED' };
  }
  if (context.responseLimit !== null && context._count.responses >= context.responseLimit) {
    await prisma.questionnaire.update({
      where: { id: context.id },
      data: { status: 'CLOSED', closeReason: 'LIMIT_REACHED', closedAt: now },
    });

    return { ok: false, kind: 'UNAVAILABLE', state: 'LIMIT_REACHED' };
  }

  // ---- 重复闸门 ----
  // 登录作答按账号判就不必再记指纹：同一账号在两个浏览器也该只能填一次，
  // 而记上指纹反而会让他在第二台设备上被指纹挡住（误判成两个人）
  const cookieStore = await cookies();
  const clientId = cookieStore.get(CLIENT_ID_COOKIE)?.value ?? null;
  const fingerprint = user ? null : buildFingerprint(clientId, userAgent);

  const existing = await countExistingResponse(context.id, {
    respondentId: user?.id ?? null,
    fingerprint,
  });
  if (existing) return { ok: false, kind: 'UNAVAILABLE', state: 'ALREADY_SUBMITTED' };

  // ---- 答案校验 ----
  const raw = (input.answers ?? {}) as Record<string, unknown>;
  const parsed = parseAnswers(
    context.questions.map((question) => {
      const config = (question.config ?? {}) as Record<string, unknown>;

      return {
        id: question.id,
        type: question.type,
        title: question.title,
        required: question.required,
        min: typeof config.min === 'number' ? config.min : null,
        max: typeof config.max === 'number' ? config.max : null,
        maxLength: typeof config.maxLength === 'number' ? config.maxLength : null,
        options: question.options.map((option) => option.label),
        // 矩阵的列（行在 options 里）；与作答端同一份收敛函数，两边看到的列不会不同
        columns: matrixColumns(config),
      };
    }),
    raw,
  );

  if (!parsed.ok) return { ok: false, kind: 'VALIDATION', fieldErrors: parsed.fieldErrors };

  const channelId = await findChannelId(context.id, input.srcToken);

  try {
    const response = await prisma.$transaction(async (tx) => {
      const created = await tx.response.create({
        data: {
          questionnaireId: context.id,
          channelId,
          respondentId: user?.id ?? null,
          fingerprint,
          submittedAt: now,
          userAgent,
          // 上限一天：超过这个数的多半是「开着页面去吃饭了」，
          // 让它进统计只会把「平均用时」变成一个没意义的数字
          durationMs:
            typeof input.durationMs === 'number' &&
            input.durationMs > 0 &&
            input.durationMs < 86_400_000
              ? Math.round(input.durationMs)
              : null,
        },
        select: { id: true },
      });

      await tx.answer.createMany({
        data: parsed.answers.map((answer) => ({
          responseId: created.id,
          questionId: answer.questionId,
          value: toJsonColumn(answer.value),
        })),
      });

      return created;
    });

    // 编号 = 这是这份问卷的第几份有效答卷（设计稿 W14 的「你的答卷编号为 #128」）
    const serial = await prisma.response.count({
      where: { questionnaireId: context.id, status: 'VALID' },
    });

    // 收满就自动截止：让「已达上限」是一个真实存在的状态，而不是每次进来才算一遍
    if (context.responseLimit !== null && serial >= context.responseLimit) {
      await prisma.questionnaire.update({
        where: { id: context.id },
        data: { status: 'CLOSED', closeReason: 'LIMIT_REACHED', closedAt: new Date() },
      });

      /*
       * 通知问卷所有者。**「收满了」这个事实只会在这里被说出来一次** ——
       * 之后链接直接失效，界面上再没有任何地方会提它。多查一次库（只在收满那一刻）
       * 换一条能点进数据的通知，很划算。
       */
      const owned = await prisma.questionnaire.findUnique({
        where: { id: context.id },
        select: { title: true, ownerId: true },
      });

      if (owned) {
        await notifyUsers({
          userIds: [owned.ownerId],
          type: 'RESPONSE_MILESTONE',
          title: '问卷已收满',
          body: `「${owned.title}」已达到回收上限 ${context.responseLimit} 份，链接已失效。`,
          linkUrl: `/app/q/${context.id}/stats`,
        });
      }
    }

    revalidatePath(`/s/${input.slug}`);

    return { ok: true, responseId: response.id, serial };
  } catch (error) {
    // 两个标签页同时提交会撞上唯一约束（那正是它存在的意义）：这不是错误，是「已提交过」
    if (isUniqueViolation(error)) {
      return { ok: false, kind: 'UNAVAILABLE', state: 'ALREADY_SUBMITTED' };
    }

    console.error('[answering] 提交答卷失败', error);

    return { ok: false, kind: 'ERROR', message: '提交失败，请稍后重试' };
  }
}

function isUniqueViolation(error: unknown) {
  return Boolean(error && typeof error === 'object' && 'code' in error && error.code === 'P2002');
}
