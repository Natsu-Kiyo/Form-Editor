import 'server-only';

import {
  hasAtLeastRole,
  type CloseReason,
  type IdentityMode,
  type QuestionnaireStatus,
  type QuestionType,
  type Role,
} from '@/config/constants';
import { prisma } from '@/lib/db';
import { formatDateTimeLocal } from '@/utils/format';

import { readMaxLength } from '../lib/preflight';

/**
 * 发布前检查需要的题目字段（审查 #4）。
 *
 * 刻意包含 `type` / `optionCount` / `maxLength`：检查要能看出「这道选择题没有选项」
 * 「这道填空题的长度上限是 0」——那正是「发布出去没人能填」的两种形状。
 */
export type PublishQuestionRow = {
  title: string;
  required: boolean;
  type: QuestionType;
  /** 选项数；矩阵题是行数 */
  optionCount: number;
  maxLength: number | null;
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
   * 口令**原文**（没有口令、或查看者无权查看时为 null）。
   *
   * 给原始值而不是 `hasPassword: boolean`：发起人要能把口令念给同事、贴进群里，
   * 所以设置页必须看得见它（取舍写在 `schema.prisma` 那一列上）。
   *
   * **只有 ADMIN 拿得到**（审查 #11）：这串口令是外部作答者的唯一门槛，
   * 而发布页与编辑器页只要 VIEWER 就能打开 —— 以前它跟着 RSC payload 一起
   * 发给了每一个能打开页面的人。查看者只需要知道「有没有设口令」。
   */
  accessPassword: string | null;
  /** 是否设了口令 —— 查看者据此看到「已设置」而不是一个空输入框（审查 #11） */
  hasPassword: boolean;
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

export async function getPublishPageData(
  questionnaireId: string,
  viewerRole: Role,
): Promise<PublishPageData | null> {
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
      questions: {
        orderBy: { order: 'asc' },
        select: {
          title: true,
          required: true,
          type: true,
          config: true,
          // 只数个数：选项文案本身进不了发布页，没必要把整张表搬出来
          _count: { select: { options: true } },
        },
      },
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
    // 口令原文只给管理员（审查 #11）；查看者拿到的是「有没有设」这个事实
    accessPassword: hasAtLeastRole(viewerRole, 'ADMIN') ? row.accessPassword : null,
    hasPassword: row.accessPassword !== null,
    publishedAtLabel: stamp(row.publishedAt),
    closedAtLabel: stamp(row.closedAt),
    closeReason: row.closeReason as CloseReason | null,
    responseCount: row._count.responses,
    questions: row.questions.map((question) => ({
      title: question.title,
      required: question.required,
      type: question.type as QuestionType,
      optionCount: question._count.options,
      maxLength: readMaxLength(question.config),
    })),
  };
}
