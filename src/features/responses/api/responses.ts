import 'server-only';

import { ratingBounds, type QuestionType } from '@/config/constants';
import { prisma } from '@/lib/db';
import { formatDurationMs, formatShortDateTime } from '@/utils/format';

/**
 * 答卷明细（W07）。
 *
 * 数字与文案**一律在服务端算好**再交给客户端组件：表格里那些「10-04 13:42」「2:08」
 * 都按展示时区格式化（服务器是 UTC，放客户端格式化会在水合时对不上）。
 */
const PAGE_SIZE = 10;

export type ResponsesQuery = {
  channelId: string | null;
  /** 搜索答卷内容；null = 不搜 */
  search: string | null;
  /** 是否把已标记无效的答卷也列出来 */
  includeInvalid: boolean;
  /** 从 1 开始 */
  page: number;
};

export type ResponseListRow = {
  id: string;
  /** 答卷编号（「#128」），口径见 `lib/response-serial.ts` */
  serial: number;
  submittedAtLabel: string;
  durationLabel: string | null;
  channelName: string | null;
  valid: boolean;
};

export type ResponsesPageData = {
  title: string;
  rows: ResponseListRow[];
  /** 全部答卷数（含无效） */
  total: number;
  validCount: number;
  /** 当前筛选条件下的条数（分页按它算） */
  filteredCount: number;
  page: number;
  pageCount: number;
  /** 每页条数。随数据一起给客户端 —— 常量在 `server-only` 模块里，客户端拿不到 */
  pageSize: number;
  channels: { id: string; name: string; count: number }[];
};

export async function getResponsesPage(
  questionnaireId: string,
  query: ResponsesQuery,
): Promise<ResponsesPageData | null> {
  const where = {
    questionnaireId,
    ...(query.channelId ? { channelId: query.channelId } : {}),
    ...(query.includeInvalid ? {} : { status: 'VALID' as const }),
    /**
     * 「搜索答卷内容」。
     *
     * JSON 列里存的是字符串（单选 / 填空 / 日期）或字符串数组（多选），两种都要能命中，
     * 所以两个条件取并集。**评分题的分数不参与搜索** —— 搜「5」会把一大半答卷捞出来，
     * 那不是搜索，是噪音。
     */
    ...(query.search
      ? {
          answers: {
            some: {
              OR: [
                { value: { string_contains: query.search } },
                { value: { array_contains: query.search } },
              ],
            },
          },
        }
      : {}),
  };

  const [questionnaire, statusCounts, filteredCount, rows, channels, allSubmissions] =
    await Promise.all([
      prisma.questionnaire.findUnique({
        where: { id: questionnaireId },
        select: { title: true },
      }),
      // 一次 groupBy 拿到「共 N 份 / 有效 M 份」两个数，而不是两次 count
      prisma.response.groupBy({
        by: ['status'],
        where: { questionnaireId },
        _count: { _all: true },
      }),
      prisma.response.count({ where }),
      prisma.response.findMany({
        where,
        // `id` 参与排序是为了让分页稳定：`submittedAt` 相同时（导入的答卷常常同秒），
        // 只按时间排序会让某些行在两页里重复出现、另一些彻底看不到
        orderBy: [{ submittedAt: 'desc' }, { id: 'desc' }],
        skip: (query.page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
        select: {
          id: true,
          status: true,
          submittedAt: true,
          durationMs: true,
          channel: { select: { name: true } },
        },
      }),
      prisma.channel.findMany({
        where: { questionnaireId },
        orderBy: { createdAt: 'asc' },
        select: { id: true, name: true, _count: { select: { responses: true } } },
      }),
      /**
       * 编号需要**全局名次**，而不是「在当前筛选结果里排第几」：
       * 筛了渠道之后，第 1 行仍然该是它原本的编号（#128），否则同一个编号会随筛选变化，
       * 与人交流时（「你看一下 #126 那份」）就对不上了。
       *
       * 只取两列、在内存里排一次序：演示规模（几百到几千份）完全够用。
       * 真到十万级要改成数据库的窗口函数（`row_number()`）或物化一列 —— 与统计页同理。
       */
      prisma.response.findMany({
        where: { questionnaireId },
        select: { id: true, submittedAt: true },
        orderBy: [{ submittedAt: 'desc' }, { id: 'desc' }],
      }),
    ]);

  if (!questionnaire) return null;

  const total = statusCounts.reduce((sum, row) => sum + row._count._all, 0);
  const validCount = statusCounts.find((row) => row.status === 'VALID')?._count._all ?? 0;

  const serials = new Map<string, number>();
  allSubmissions.forEach((submission, index) => {
    // 倒序排第 index 位的答卷，编号是「总数 − index」：最早的编号为 1，最新的是总数
    serials.set(submission.id, allSubmissions.length - index);
  });

  return {
    title: questionnaire.title,
    total,
    validCount,
    filteredCount,
    // 页码越界（手改 URL、或删到只剩一页）时收敛到最后一页，而不是给一个空表
    page: Math.min(query.page, Math.max(1, Math.ceil(filteredCount / PAGE_SIZE))),
    pageCount: Math.max(1, Math.ceil(filteredCount / PAGE_SIZE)),
    pageSize: PAGE_SIZE,
    channels: channels.map((channel) => ({
      id: channel.id,
      name: channel.name,
      count: channel._count.responses,
    })),
    rows: rows.map((row) => ({
      id: row.id,
      serial: serials.get(row.id) ?? 0,
      submittedAtLabel: formatShortDateTime(row.submittedAt),
      durationLabel: row.durationMs ? formatDurationMs(row.durationMs) : null,
      channelName: row.channel?.name ?? null,
      valid: row.status === 'VALID',
    })),
  };
}

export type AnswerDisplay =
  | { kind: 'TEXT'; text: string }
  | { kind: 'CHOICE'; multi: boolean; options: string[] }
  | { kind: 'RATING'; score: number; max: number }
  /** 矩阵（R62）：只列出**选了**的行，按问卷里的行顺序 */
  | { kind: 'MATRIX'; rows: { label: string; column: string }[] }
  | { kind: 'EMPTY' };

export type ResponseDetail = {
  id: string;
  serial: number;
  valid: boolean;
  submittedAtLabel: string;
  durationLabel: string | null;
  channelName: string | null;
  identityLabel: string;
  effectiveAddress: string | null;
  invalidatedLabel: string | null;
  items: {
    questionId: string;
    title: string;
    type: QuestionType;
    display: AnswerDisplay;
  }[];
};

/** 单份答卷的详情（右侧栏）。`responseId` 不属于这份问卷时返回 null，不抛错 */
export async function getResponseDetail(
  questionnaireId: string,
  responseId: string,
): Promise<ResponseDetail | null> {
  if (!responseId) return null;

  const response = await prisma.response.findFirst({
    where: { id: responseId, questionnaireId },
    select: {
      id: true,
      status: true,
      submittedAt: true,
      durationMs: true,
      userAgent: true,
      invalidatedAt: true,
      channel: { select: { name: true } },
      respondent: { select: { name: true } },
      invalidatedBy: { select: { name: true } },
      answers: { select: { questionId: true, value: true } },
      questionnaire: {
        select: {
          questions: {
            orderBy: { order: 'asc' },
            select: {
              id: true,
              title: true,
              type: true,
              config: true,
              // 矩阵的「行」在 options 里（明细的展示要按行排）
              options: { orderBy: { order: 'asc' }, select: { label: true } },
            },
          },
        },
      },
    },
  });

  if (!response) return null;

  const serial = await prisma.response.count({
    where: { questionnaireId, submittedAt: { lte: response.submittedAt } },
  });

  const answers = new Map(response.answers.map((answer) => [answer.questionId, answer.value]));

  return {
    id: response.id,
    serial,
    valid: response.status === 'VALID',
    submittedAtLabel: formatShortDateTime(response.submittedAt),
    durationLabel: response.durationMs ? formatDurationMs(response.durationMs) : null,
    channelName: response.channel?.name ?? null,
    identityLabel: response.respondent?.name ?? '匿名作答',
    effectiveAddress: response.userAgent ? readableUserAgent(response.userAgent) : null,
    invalidatedLabel:
      response.status === 'INVALID' && response.invalidatedAt
        ? `${formatShortDateTime(response.invalidatedAt)}${
            response.invalidatedBy?.name ? ` · ${response.invalidatedBy.name}` : ''
          }`
        : null,
    items: response.questionnaire.questions.map((question) => ({
      questionId: question.id,
      title: question.title,
      type: question.type as QuestionType,
      display: describeAnswer(
        question.type as QuestionType,
        (question.config ?? {}) as Record<string, unknown>,
        question.options.map((option) => option.label),
        answers.get(question.id),
      ),
    })),
  };
}

/**
 * 作答值 → 展示形态。
 *
 * 三种形态对应三种读法（与统计页的约定一致）：选项要能一眼看清选了哪几个、
 * 评分要看到分数本身、填空要保留换行。
 * `options` 只有矩阵题用得上（它是**行**）——其余题型传进来不用。
 */
function describeAnswer(
  type: QuestionType,
  config: Record<string, unknown>,
  options: string[],
  value: unknown,
): AnswerDisplay {
  if (value === null || value === undefined || value === '') return { kind: 'EMPTY' };

  if (type === 'MATRIX') {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      return { kind: 'EMPTY' };
    }

    const source = value as Record<string, unknown>;
    // 按问卷里的行顺序排；没选的行不显示（与「未作答的题不显示」同一条口径）
    const rows = options.flatMap((row) => {
      const column = source[row];

      return typeof column === 'string' ? [{ label: row, column }] : [];
    });

    return rows.length > 0 ? { kind: 'MATRIX', rows } : { kind: 'EMPTY' };
  }

  if (type === 'RATING') {
    const { max } = ratingBounds({
      min: typeof config.min === 'number' ? config.min : undefined,
      max: typeof config.max === 'number' ? config.max : undefined,
    });

    return { kind: 'RATING', score: Number(value), max };
  }

  if (type === 'SINGLE' || type === 'MULTI' || type === 'DROPDOWN') {
    const picked = Array.isArray(value) ? value : [value];
    const options = picked.filter((item): item is string => typeof item === 'string');

    return options.length > 0
      ? { kind: 'CHOICE', multi: type === 'MULTI', options }
      : { kind: 'EMPTY' };
  }

  const text = String(value).trim();

  return text ? { kind: 'TEXT', text } : { kind: 'EMPTY' };
}

/** UA 里只留浏览器与系统，整串太长且对「这份答卷是谁填的」没有帮助 */
function readableUserAgent(userAgent: string) {
  const browser = /Edg\//.test(userAgent)
    ? 'Edge'
    : /Chrome\//.test(userAgent)
      ? 'Chrome'
      : /Firefox\//.test(userAgent)
        ? 'Firefox'
        : /Safari\//.test(userAgent)
          ? 'Safari'
          : '未知浏览器';
  const system = /Windows/.test(userAgent)
    ? 'Windows'
    : /Mac OS X/.test(userAgent)
      ? 'macOS'
      : /Android/.test(userAgent)
        ? 'Android'
        : /iPhone|iPad/.test(userAgent)
          ? 'iOS'
          : /Linux/.test(userAgent)
            ? 'Linux'
            : '未知系统';

  return `${browser} · ${system}`;
}
