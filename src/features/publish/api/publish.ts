import 'server-only';

import type { CloseReason, IdentityMode, QuestionnaireStatus } from '@/config/constants';
import { prisma } from '@/lib/db';
import { formatDateTimeLocal } from '@/utils/format';

export type PublishQuestionRow = {
  title: string;
  required: boolean;
};

export type PublishPageData = {
  id: string;
  title: string;
  status: QuestionnaireStatus;
  slug: string;
  /** `datetime-local` 的输入值；未设置时是空串 */
  startsAt: string;
  endsAt: string;
  /** 输入框的值；不限制时是空串 */
  responseLimit: string;
  identityMode: IdentityMode;
  /**
   * 口令**原文**（没有口令时为 null）。
   *
   * 给原始值而不是 `hasPassword: boolean`：发起人要能把口令念给同事、贴进群里，
   * 所以设置页必须看得见它（取舍写在 `schema.prisma` 那一列上）。
   */
  accessPassword: string | null;
  publishedAtLabel: string | null;
  closedAtLabel: string | null;
  closeReason: CloseReason | null;
  responseCount: number;
  questions: PublishQuestionRow[];
};

/** `2026-10-04 10:00`。设计稿里的时间一律是这个写法（等宽字体），不要另造格式 */
function stamp(date: Date | null) {
  return date ? formatDateTimeLocal(date).replace('T', ' ') : null;
}

export async function getPublishPageData(questionnaireId: string): Promise<PublishPageData | null> {
  const row = await prisma.questionnaire.findUnique({
    where: { id: questionnaireId },
    select: {
      id: true,
      title: true,
      status: true,
      slug: true,
      startsAt: true,
      endsAt: true,
      responseLimit: true,
      identityMode: true,
      accessPassword: true,
      publishedAt: true,
      closedAt: true,
      closeReason: true,
      questions: { orderBy: { order: 'asc' }, select: { title: true, required: true } },
      // 一次查询就拿到「已回收份数」：设计稿要让上限与已回收量并排显示，
      // 而「上限小于已回收量」正是发布前检查里要拦的一种情况
      _count: { select: { responses: { where: { status: 'VALID' } } } },
    },
  });

  if (!row) return null;

  return {
    id: row.id,
    title: row.title,
    status: row.status as QuestionnaireStatus,
    slug: row.slug,
    startsAt: row.startsAt ? formatDateTimeLocal(row.startsAt) : '',
    endsAt: row.endsAt ? formatDateTimeLocal(row.endsAt) : '',
    responseLimit: row.responseLimit === null ? '' : String(row.responseLimit),
    identityMode: row.identityMode as IdentityMode,
    accessPassword: row.accessPassword,
    publishedAtLabel: stamp(row.publishedAt),
    closedAtLabel: stamp(row.closedAt),
    closeReason: row.closeReason as CloseReason | null,
    responseCount: row._count.responses,
    questions: row.questions,
  };
}
