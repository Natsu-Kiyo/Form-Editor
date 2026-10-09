import 'server-only';

import { matrixColumns, type QuestionType, type TrendGranularity } from '@/config/constants';
import { prisma } from '@/lib/db';
import { formatDateTimeLocal } from '@/utils/format';

import { filterBounds, filterEndInclusive, type AnalyticsFilter } from '../lib/filter';
import {
  buildTrend,
  summarize,
  summarizeQuestion,
  type QuestionStats,
  type ResponseRow,
  type Summary,
  type TrendPoint,
} from '../lib/stats';

export type AnalyticsQuestion = {
  id: string;
  title: string;
  type: QuestionType;
  required: boolean;
  /** 导出用：这道题在 CSV 里的表头 */
  stats: QuestionStats;
};

export type AnalyticsData = {
  id: string;
  title: string;
  slug: string;
  status: string;
  summary: Summary;
  /** 趋势图与它的汇总粒度（粒度按筛选区间的跨度自动定，见 `lib/stats.ts`） */
  trend: { granularity: TrendGranularity; points: TrendPoint[] };
  questions: AnalyticsQuestion[];
  channels: { id: string; name: string; count: number }[];
  updatedAtLabel: string;
  /** 当前筛选范围里的有效答卷条数，题目卡片的「有效作答 N 人」用它 */
  filteredValidCount: number;
};

/**
 * 统计页的全部数据。
 *
 * **一次读、一处算**：把答卷连同作答值一次取回来，然后在服务端用 `lib/stats.ts`
 * 那几个纯函数算完 —— 卡片、图表、导出走的是同一份结果，所以不会出现
 * 「卡片说 128、图表加起来 121」。
 *
 * 代价是「把范围内的答卷读进内存」。演示规模（几百到几千份）完全够用；
 * 真到十万份级别要改成数据库聚合（`groupBy` / 物化视图），这条记在计划书遗留里。
 */
export async function getAnalyticsData(
  questionnaireId: string,
  filter: AnalyticsFilter,
): Promise<AnalyticsData | null> {
  const questionnaire = await prisma.questionnaire.findUnique({
    where: { id: questionnaireId },
    select: {
      id: true,
      title: true,
      slug: true,
      status: true,
      viewCount: true,
      publishedAt: true,
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
      channels: {
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          name: true,
          _count: { select: { responses: true } },
        },
      },
    },
  });

  if (!questionnaire) return null;

  const now = new Date();
  const bounds = filterBounds(filter);

  const responses = await prisma.response.findMany({
    where: {
      questionnaireId,
      ...(filter.channelId ? { channelId: filter.channelId } : {}),
      // 未设的那一侧是 `undefined`，Prisma 会当作「不限制」—— 不必再拼一次 where
      submittedAt: { gte: bounds.gte, lt: bounds.lt },
    },
    select: {
      id: true,
      status: true,
      submittedAt: true,
      durationMs: true,
      channelId: true,
      answers: { select: { questionId: true, value: true } },
    },
  });

  const rows: ResponseRow[] = responses.map((response) => ({
    id: response.id,
    status: response.status as 'VALID' | 'INVALID',
    submittedAt: response.submittedAt,
    durationMs: response.durationMs,
    channelId: response.channelId,
  }));

  const summary = summarize(rows, questionnaire.viewCount);

  // 只有有效答卷进图表（与卡片上的「统计图仅含有效答卷」一致）
  const answersByQuestion = new Map<string, unknown[]>();
  let filteredValidCount = 0;

  for (const response of responses) {
    if (response.status !== 'VALID') continue;
    filteredValidCount += 1;

    for (const answer of response.answers) {
      const list = answersByQuestion.get(answer.questionId) ?? [];
      list.push(answer.value);
      answersByQuestion.set(answer.questionId, list);
    }
  }

  const latest = responses.reduce<Date | null>(
    (acc, response) => (acc === null || response.submittedAt > acc ? response.submittedAt : acc),
    null,
  );

  /**
   * 趋势图的横轴区间。
   *
   * 起点：筛选给了就用筛选的；否则取「有答卷的第一天」与「发布时间」里更早的那个 ——
   * 这张图回答的是「发布之后收回得怎么样」，所以**空白期也该留在图上**。
   * 终点：筛选给了就用筛选的（含当天），否则到现在。两者都向 `now` 收口：
   * 未来日期没有意义，而手改 URL 还可能给出「起点晚于终点」的区间。
   */
  const earliest = rows.reduce<Date | null>(
    (acc, row) => (acc === null || row.submittedAt < acc ? row.submittedAt : acc),
    null,
  );
  const publishedAt = questionnaire.publishedAt;
  const fallbackStart =
    earliest && publishedAt
      ? new Date(Math.min(earliest.getTime(), publishedAt.getTime()))
      : (earliest ?? publishedAt);
  const start = filter.from ?? fallbackStart ?? now;

  const end = new Date(
    Math.max(
      start.getTime(),
      Math.min(filterEndInclusive(filter)?.getTime() ?? now.getTime(), now.getTime()),
    ),
  );

  const trend = buildTrend(rows, { from: start, to: end });

  return {
    id: questionnaire.id,
    title: questionnaire.title,
    slug: questionnaire.slug,
    status: questionnaire.status,
    summary,
    trend,
    questions: questionnaire.questions.map((question) => {
      const config = (question.config ?? {}) as Record<string, unknown>;

      return {
        id: question.id,
        title: question.title,
        type: question.type as QuestionType,
        required: question.required,
        stats: summarizeQuestion(
          {
            type: question.type as QuestionType,
            options: question.options.map((option) => option.label),
            // 矩阵的列（行在 options 里）；与作答端/编辑器共用同一份收敛函数
            columns: matrixColumns(config),
            min: typeof config.min === 'number' ? config.min : null,
            max: typeof config.max === 'number' ? config.max : null,
            required: question.required,
          },
          answersByQuestion.get(question.id) ?? [],
          filteredValidCount,
        ),
      };
    }),
    channels: questionnaire.channels.map((channel) => ({
      id: channel.id,
      name: channel.name,
      count: channel._count.responses,
    })),
    updatedAtLabel: latest ? `${formatDateTimeLocal(latest).replace('T', ' ')}` : '还没有答卷',
    filteredValidCount,
  };
}

/** 导出用的原始行（CSV 的每一行 = 一份答卷） */
export async function getResponsesForExport(questionnaireId: string, filter: AnalyticsFilter) {
  const bounds = filterBounds(filter);

  const [questionnaire, responses] = await Promise.all([
    prisma.questionnaire.findUnique({
      where: { id: questionnaireId },
      select: {
        title: true,
        questions: {
          orderBy: { order: 'asc' },
          select: {
            id: true,
            title: true,
            type: true,
            options: { orderBy: { order: 'asc' }, select: { label: true } },
          },
        },
      },
    }),
    prisma.response.findMany({
      where: {
        questionnaireId,
        ...(filter.channelId ? { channelId: filter.channelId } : {}),
        // 与统计页走同一套区间边界：页面上筛的是 9 月，导出的就该是 9 月
        submittedAt: { gte: bounds.gte, lt: bounds.lt },
      },
      orderBy: { submittedAt: 'asc' },
      select: {
        submittedAt: true,
        status: true,
        durationMs: true,
        channel: { select: { name: true } },
        answers: { select: { questionId: true, value: true } },
      },
    }),
  ]);

  return { questionnaire, responses };
}
