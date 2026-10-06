'use server';

import { revalidatePath } from 'next/cache';

import { OPERATION_TYPE, formatVersion, type IdentityMode } from '@/config/constants';
import { hashPassword } from '@/lib/auth/password';
import { requireQuestionnaireAccess } from '@/lib/auth/questionnaire-access';
import { prisma } from '@/lib/db';
import { writeOperationLog } from '@/lib/operation-log';
import { writeQuestionnaireVersion } from '@/lib/questionnaire-version';
import { parseDateTimeLocal } from '@/utils/format';
import { toFieldErrors } from '@/utils/zod-errors';

import { runPreflight } from '../lib/preflight';
import { publishSettingsSchema } from '../schemas';

export type PublishActionResult =
  | { ok: true; message: string }
  | { ok: false; message: string; fieldErrors?: Record<string, string[]> };

type NormalizedSettings = {
  startsAt: Date | null;
  endsAt: Date | null;
  responseLimit: number | null;
  identityMode: IdentityMode;
  accessPasswordHash: string | null;
};

/**
 * 校验并把输入框的值落成库里的字段。
 *
 * 口令的两种「留空」要分开：**从没设过** → 保持为空（发布前检查会拦住口令访问）；
 * **设过但现在留空** → 沿用旧口令。后者是常见操作（改个结束时间不该被逼着重设口令）。
 */
async function normalizeSettings(
  input: unknown,
  existingPasswordHash: string | null,
): Promise<
  | { ok: true; settings: NormalizedSettings }
  | { ok: false; message: string; fieldErrors?: Record<string, string[]> }
> {
  const parsed = publishSettingsSchema.safeParse(input);

  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0].message,
      fieldErrors: toFieldErrors(parsed.error),
    };
  }

  const value = parsed.data;
  const accessPasswordHash =
    value.identityMode !== 'PASSWORD'
      ? null
      : value.password
        ? await hashPassword(value.password)
        : existingPasswordHash;

  return {
    ok: true,
    settings: {
      startsAt: parseDateTimeLocal(value.startsAt),
      endsAt: parseDateTimeLocal(value.endsAt),
      responseLimit: value.responseLimit === '' ? null : Number(value.responseLimit),
      identityMode: value.identityMode,
      accessPasswordHash,
    },
  };
}

async function getPublishContext(questionnaireId: string) {
  return prisma.questionnaire.findUnique({
    where: { id: questionnaireId },
    select: {
      title: true,
      status: true,
      accessPasswordHash: true,
      questions: { orderBy: { order: 'asc' }, select: { title: true, required: true } },
      _count: { select: { responses: { where: { status: 'VALID' } } } },
    },
  });
}

/**
 * 只保存发布设置，不改状态。
 *
 * 已发布的问卷要靠它改结束时间之类的设置；已归档的不能改（归档是终点，要改先恢复）。
 */
export async function savePublishSettingsAction(
  questionnaireId: string,
  input: unknown,
): Promise<PublishActionResult> {
  const { user, questionnaire } = await requireQuestionnaireAccess(questionnaireId, 'EDITOR');

  if (questionnaire.status === 'ARCHIVED') {
    return { ok: false, message: '已归档的问卷不能改发布设置，请先恢复它' };
  }

  const context = await getPublishContext(questionnaireId);
  const normalized = await normalizeSettings(input, context?.accessPasswordHash ?? null);
  if (!normalized.ok) return normalized;

  const { settings } = normalized;

  if (
    settings.responseLimit !== null &&
    settings.responseLimit <= (context?._count.responses ?? 0)
  ) {
    return {
      ok: false,
      message: `回收上限不能小于已回收的 ${context?._count.responses ?? 0} 份`,
      fieldErrors: { responseLimit: ['上限不能小于已回收份数'] },
    };
  }

  await prisma.questionnaire.update({
    where: { id: questionnaireId },
    data: {
      startsAt: settings.startsAt,
      endsAt: settings.endsAt,
      responseLimit: settings.responseLimit,
      identityMode: settings.identityMode,
      accessPasswordHash: settings.accessPasswordHash,
    },
  });

  await writeOperationLog({
    workspaceId: questionnaire.workspaceId,
    actorId: user.id,
    type: OPERATION_TYPE.SETTINGS,
    targetType: 'QUESTIONNAIRE',
    targetId: questionnaireId,
    targetName: context?.title ?? questionnaire.title,
  });

  revalidatePath(`/app/q/${questionnaireId}`, 'layout');
  return { ok: true, message: '发布设置已保存' };
}

/**
 * 发布。
 *
 * 三道关：① 只有草稿能发布（发布即冻结，已截止不可重开）
 * ② 字段级校验（时间格式、时间先后）
 * ③ **发布前检查** —— 与界面上那份清单是同一份规则（`lib/preflight.ts`），
 * 界面只是提前把问题显示出来，最终拦截在服务端。
 */
export async function publishQuestionnaireAction(
  questionnaireId: string,
  input: unknown,
): Promise<PublishActionResult> {
  const { user, questionnaire } = await requireQuestionnaireAccess(questionnaireId, 'EDITOR');

  if (questionnaire.status !== 'DRAFT') {
    return {
      ok: false,
      message: '只有草稿可以发布。已截止的问卷不能重新开启回收，请复制为新问卷',
    };
  }

  const context = await getPublishContext(questionnaireId);
  if (!context) return { ok: false, message: '问卷不存在' };

  const normalized = await normalizeSettings(input, context.accessPasswordHash);
  if (!normalized.ok) return normalized;

  const { settings } = normalized;
  const now = new Date();

  const preflight = runPreflight({
    questions: context.questions,
    startsAt: settings.startsAt,
    endsAt: settings.endsAt,
    responseLimit: settings.responseLimit,
    responseCount: context._count.responses,
    identityMode: settings.identityMode,
    hasPassword: settings.accessPasswordHash !== null,
    now,
  });

  if (!preflight.canPublish) {
    const blocker = preflight.checks.find((check) => check.tone === 'error');
    return { ok: false, message: blocker?.text ?? '还有问题需要先处理' };
  }

  const version = await writeQuestionnaireVersion({
    questionnaireId,
    label: '发布',
    createdById: user.id,
  });

  await prisma.questionnaire.update({
    where: { id: questionnaireId },
    data: {
      status: 'PUBLISHED',
      publishedAt: now,
      closeReason: null,
      closedAt: null,
      startsAt: settings.startsAt,
      endsAt: settings.endsAt,
      responseLimit: settings.responseLimit,
      identityMode: settings.identityMode,
      accessPasswordHash: settings.accessPasswordHash,
    },
  });

  await writeOperationLog({
    workspaceId: questionnaire.workspaceId,
    actorId: user.id,
    type: OPERATION_TYPE.PUBLISH,
    targetType: 'QUESTIONNAIRE',
    targetId: questionnaireId,
    targetName: context.title,
    detail: version ? { version: formatVersion(version) } : undefined,
  });

  revalidatePath('/app');
  revalidatePath(`/app/q/${questionnaireId}`, 'layout');
  return { ok: true, message: '已发布' };
}
