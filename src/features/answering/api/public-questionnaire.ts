import 'server-only';

import type { CloseReason, IdentityMode, QuestionType } from '@/config/constants';
import { prisma } from '@/lib/db';
import { daysUntil, formatDateTimeLocal } from '@/utils/format';

import type { SubmittableQuestion } from '../lib/answers';

/**
 * 公开作答链接（`/s/{slug}`）看到的东西。
 *
 * 这里承担四件事：
 * 1. 短链解析 + **状态判定**：草稿 / 未开始 / 已暂停 / 已截止 / 已达上限 / 已提交过 / 可作答 ——
 *    「链接打不开」与「这份问卷已截止」是两件事，不能都给一个 404（设计稿 W13 的五种态就在这里）。
 * 2. `?src=` 渠道校验：**只认属于这份问卷的 token**，认不出就当没带，绝不记到别处。
 * 3. 到期的**懒截止**：没有定时任务，所以读取时发现过了结束时间就把状态落库为已截止 ——
 *    这样列表、分享页、公开页说的是同一个事实。
 * 4. 不可用态的文案与信息卡**在服务端算好**：五态共用一套版式（设计稿原话「仅更换图标、文案与主按钮」），
 *    把「哪一行显示什么」收在一处，页面上就只剩排版。
 */
export type PublicQuestion = SubmittableQuestion & {
  description: string | null;
  pageIndex: number;
};

export type InfoRow = { label: string; value: string };

export type UnavailableKind =
  'DRAFT' | 'NOT_STARTED' | 'PAUSED' | 'CLOSED' | 'LIMIT_REACHED' | 'ALREADY_SUBMITTED';

export type PublicView =
  | { state: 'NOT_FOUND' }
  | {
      state: 'UNAVAILABLE';
      kind: UnavailableKind;
      title: string;
      heading: string;
      description: string;
      infoRows: InfoRow[];
      primaryAction: { label: string; href: string };
      note: string | null;
    }
  | {
      state: 'COLLECTING';
      title: string;
      intro: string | null;
      identityMode: IdentityMode;
      /** 口令访问：没解锁就先给口令卡 */
      locked: boolean;
      /** 需登录作答但当前没登录：给登录入口（有出路，不是「不可用」） */
      needsLogin: boolean;
      channelName: string | null;
      questions: PublicQuestion[];
      endsAtLabel: string | null;
      daysLeft: number | null;
    };

export type PublicViewContext = {
  srcToken: string | null;
  /** 匿名作答的浏览器指纹（已哈希） */
  fingerprint: string | null;
  /** 登录作答时的用户 id */
  respondentId: string | null;
};

function stamp(date: Date | null) {
  return date ? formatDateTimeLocal(date).replace('T', ' ') : null;
}

export async function getPublicQuestionnaire(
  slug: string,
  context: PublicViewContext,
  unlocked: boolean,
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
      responseLimit: true,
      closeReason: true,
      identityMode: true,
      accessPasswordHash: true,
      owner: { select: { name: true } },
      workspace: { select: { name: true } },
      questions: {
        orderBy: { order: 'asc' },
        select: {
          id: true,
          type: true,
          title: true,
          description: true,
          required: true,
          shuffleOptions: true,
          pageIndex: true,
          config: true,
          options: { orderBy: { order: 'asc' }, select: { label: true } },
        },
      },
      _count: { select: { responses: { where: { status: 'VALID' } } } },
    },
  });

  if (!row) return { state: 'NOT_FOUND' };

  const now = new Date();
  const responseCount = row._count.responses;
  const ownerName = `${row.owner.name} · ${row.workspace.name}`;

  /** W13 的信息卡：四种态只是换了一行，所以文案也在这里给出 */
  const infoRows = (extra: InfoRow): InfoRow[] => [
    { label: '问卷名称', value: row.title },
    { label: '发布者', value: ownerName },
    { label: '已回收', value: `${responseCount} 份` },
    extra,
  ];

  const unavailable = (
    kind: UnavailableKind,
    heading: string,
    description: string,
    extra: InfoRow,
    note: string | null = null,
  ): PublicView => ({
    state: 'UNAVAILABLE',
    kind,
    title: row.title,
    heading,
    description,
    infoRows: infoRows(extra),
    primaryAction: { label: '返回首页', href: '/' },
    note,
  });

  const endsAtLabel = stamp(row.endsAt);

  if (row.status === 'DRAFT') {
    return unavailable('DRAFT', '问卷还没发布', '创建者还没有发布这份问卷，链接暂时不能填写。', {
      label: '结束原因',
      value: '尚未发布',
    });
  }

  if (row.status === 'ARCHIVED') {
    return unavailable('CLOSED', '问卷已结束收集', '这份问卷已经归档，作答链接已失效。', {
      label: '结束原因',
      value: '已归档',
    });
  }

  if (row.status === 'CLOSED') {
    return unavailable(
      'CLOSED',
      row.closeReason === 'LIMIT_REACHED' ? '问卷已达到回收上限' : '问卷已结束收集',
      row.closeReason === 'LIMIT_REACHED'
        ? `这份问卷已收满 ${row.responseLimit ?? responseCount} 份，作答链接已失效。`
        : `${endsAtLabel ? `这份问卷在 ${endsAtLabel} 到达截止时间，` : ''}作答链接已失效。如需继续收集，请联系发布者重新开放。`,
      { label: '结束原因', value: closeReasonText(row.closeReason, endsAtLabel) },
    );
  }

  if (row.status === 'PAUSED') {
    return unavailable('PAUSED', '回收已暂停', '发布者暂时关闭了回收，请稍后再来。', {
      label: '结束原因',
      value: '发布者暂停',
    });
  }

  // 已发布：还要看时间与上限
  if (row.startsAt && row.startsAt.getTime() > now.getTime()) {
    const startsAtLabel = stamp(row.startsAt);

    return unavailable(
      'NOT_STARTED',
      '回收还没开始',
      `这份问卷将于 ${startsAtLabel} 开放，届时用同一个链接即可填写。`,
      { label: '结束原因', value: '未到开始时间' },
    );
  }

  if (row.endsAt && row.endsAt.getTime() <= now.getTime()) {
    // 懒截止：落库之后列表与分享页都会显示「已截止」，与访客看到的一致
    await prisma.questionnaire.update({
      where: { id: row.id },
      data: { status: 'CLOSED', closeReason: 'SCHEDULED', closedAt: row.endsAt },
    });

    return unavailable(
      'CLOSED',
      '问卷已结束收集',
      `这份问卷在 ${endsAtLabel} 到达截止时间，作答链接已失效。如需继续收集，请联系发布者重新开放。`,
      { label: '结束原因', value: '到达截止时间' },
    );
  }

  if (row.responseLimit !== null && responseCount >= row.responseLimit) {
    await prisma.questionnaire.update({
      where: { id: row.id },
      data: { status: 'CLOSED', closeReason: 'LIMIT_REACHED', closedAt: now },
    });

    return unavailable(
      'LIMIT_REACHED',
      '问卷已达到回收上限',
      `这份问卷已收满 ${row.responseLimit} 份，作答链接已失效。`,
      { label: '结束原因', value: '达到回收上限' },
    );
  }

  // 重复提交：登录作答按账号判、匿名作答按指纹判（与表上的唯一约束一一对应）
  const existing = await findExistingResponse(row.id, context);
  if (existing) {
    return unavailable(
      'ALREADY_SUBMITTED',
      '你已提交过这份问卷',
      `每份问卷每人限填一次。你的提交时间是 ${stamp(existing.submittedAt) ?? ''}。感谢你的参与。`,
      { label: '提交时间', value: stamp(existing.submittedAt) ?? '—' },
      '如果这不是你本人提交的，或需要修改答案，请联系问卷发布者处理。同一账号重复提交会被拦截，以保证回收数据的有效性。',
    );
  }

  // 渠道参数只认属于这份问卷的 token
  const channel = context.srcToken
    ? await prisma.channel.findFirst({
        where: { questionnaireId: row.id, srcToken: context.srcToken },
        select: { name: true },
      })
    : null;

  return {
    state: 'COLLECTING',
    title: row.title,
    intro: row.intro,
    identityMode: row.identityMode as IdentityMode,
    locked: row.identityMode === 'PASSWORD' && !unlocked,
    needsLogin: row.identityMode === 'LOGIN_REQUIRED' && !context.respondentId,
    channelName: channel?.name ?? null,
    endsAtLabel,
    daysLeft: row.endsAt ? daysUntil(row.endsAt, now) : null,
    questions: row.questions.map((question) => {
      const config = (question.config ?? {}) as Record<string, unknown>;

      return {
        id: question.id,
        type: question.type as QuestionType,
        title: question.title,
        description: question.description,
        required: question.required,
        shuffleOptions: question.shuffleOptions,
        pageIndex: question.pageIndex,
        min: typeof config.min === 'number' ? config.min : null,
        max: typeof config.max === 'number' ? config.max : null,
        maxLength: typeof config.maxLength === 'number' ? config.maxLength : null,
        // 选项顺序随机是问卷设计者的选择（设计稿 W12 里就有这一条）
        options: question.shuffleOptions
          ? shuffle(question.options.map((option) => option.label))
          : question.options.map((option) => option.label),
      };
    }),
  };
}

function closeReasonText(reason: CloseReason | null, endsAtLabel: string | null) {
  switch (reason) {
    case 'LIMIT_REACHED':
      return '达到回收上限';
    case 'SCHEDULED':
      return '到达截止时间';
    case 'MANUAL':
      return '发布者手动截止';
    case 'ADMIN':
      return '管理员关闭';
    default:
      return endsAtLabel ? '到达截止时间' : '已关闭';
  }
}

/** 题目顺序随机。用 Fisher–Yates，不用 `sort(() => Math.random() - 0.5)`（那个分布不均） */
function shuffle<T>(items: T[]): T[] {
  const result = [...items];

  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j]!, result[i]!];
  }

  return result;
}

async function findExistingResponse(questionnaireId: string, context: RespondentIdentity) {
  if (context.respondentId) {
    return prisma.response.findFirst({
      where: { questionnaireId, respondentId: context.respondentId },
      select: { submittedAt: true },
    });
  }

  if (context.fingerprint) {
    return prisma.response.findFirst({
      where: { questionnaireId, fingerprint: context.fingerprint },
      select: { submittedAt: true },
    });
  }

  return null;
}

/**
 * 提交结果页要显示的那一份答卷。
 *
 * 「答卷编号」按**提交时间排序算出名次**（`submittedAt <= 这一份` 的条数），
 * 而不是直接用当前总数：总数会随着别人继续提交而变化，同一份答卷的编号就该是**固定的**。
 */
export async function getSubmittedResponse(slug: string, responseId: string) {
  const response = await prisma.response.findFirst({
    where: { id: responseId, questionnaire: { slug } },
    select: {
      submittedAt: true,
      questionnaire: { select: { title: true, identityMode: true } },
    },
  });

  if (!response) return null;

  const serial = await prisma.response.count({
    where: {
      questionnaire: { slug },
      status: 'VALID',
      submittedAt: { lte: response.submittedAt },
    },
  });

  return {
    serial,
    title: response.questionnaire.title,
    identityMode: response.questionnaire.identityMode as IdentityMode,
    submittedAtLabel: stamp(response.submittedAt) ?? '—',
  };
}

/** 口令是否已被这道题的访客解开过（哈希存在 Cookie 里，见 `lib/unlock.ts`） */
export async function getAccessPasswordHash(slug: string) {
  return prisma.questionnaire.findUnique({
    where: { slug },
    select: { id: true, accessPasswordHash: true },
  });
}

export type SubmissionContext = Awaited<ReturnType<typeof loadSubmissionContext>>;

/**
 * 提交时需要的全部前置数据与闸门依据。
 *
 * 两个 `findUnique` 合成一个函数：提交链路上「读问卷 → 判闸门 → 写答卷」必须是**同一份快照**，
 * 分成两次读就可能读到两次不同的问卷状态。
 */
export async function loadSubmissionContext(slug: string) {
  return prisma.questionnaire.findUnique({
    where: { slug },
    select: {
      id: true,
      title: true,
      status: true,
      startsAt: true,
      endsAt: true,
      responseLimit: true,
      identityMode: true,
      accessPasswordHash: true,
      _count: { select: { responses: { where: { status: 'VALID' } } } },
      questions: {
        orderBy: { order: 'asc' },
        select: {
          id: true,
          type: true,
          title: true,
          required: true,
          config: true,
          options: { orderBy: { order: 'asc' }, select: { label: true } },
        },
      },
    },
  });
}

/** 重复判定的两个依据。单独一个类型是因为提交时不需要 `srcToken` 那一项 */
export type RespondentIdentity = {
  respondentId: string | null;
  fingerprint: string | null;
};

export async function findChannelId(questionnaireId: string, srcToken: string | null) {
  if (!srcToken) return null;

  const channel = await prisma.channel.findFirst({
    where: { questionnaireId, srcToken },
    select: { id: true },
  });

  return channel?.id ?? null;
}

export async function countExistingResponse(questionnaireId: string, context: RespondentIdentity) {
  return findExistingResponse(questionnaireId, context);
}
