import {
  ratingBounds,
  TREND_GRANULARITY,
  type QuestionType,
  type TrendGranularity,
} from '@/config/constants';
import {
  DISPLAY_TIME_ZONE,
  displayDayStart,
  displayMonthStart,
  displayWeekStart,
} from '@/utils/format';

/**
 * 数据统计的口径。
 *
 * **纯函数、单独一个文件**：这是 M6 的核心，所有数字都从这几个函数出来 ——
 * 图表、卡片、导出走同一份计算，才不会出现「卡片说 128、图表加起来 121」。
 * 验收里那条「有效答卷 = 回收份数 − 无效」也由这里保证。
 *
 * 三条贯穿全文的口径：
 * - **回收份数含已标记无效的**（设计稿 W06 卡片下的注释就是这么写的）；
 *   统计图表只吃有效答卷。
 * - 所有时间按**展示时区**切桶，不按服务器本地时区（服务器在 UTC，用它切天会让
 *   北京时间上午 8 点前提交的答卷落到前一天）。
 * - 算不出来的时候返回 `null`，**不编一个 0 或 100% 出来**（例如没有任何耗时记录时的「平均用时」）。
 */
export type ResponseRow = {
  id: string;
  status: 'VALID' | 'INVALID';
  submittedAt: Date;
  durationMs: number | null;
  channelId: string | null;
};

export type Summary = {
  /** 收到的全部答卷（含无效） */
  received: number;
  invalid: number;
  valid: number;
  /** 打开次数（完成率的分母） */
  views: number;
  /** 完成率 = 提交数 ÷ 打开数；没有打开记录时为 null */
  completionRate: number | null;
  averageDurationMs: number | null;
  medianDurationMs: number | null;
};

export function summarize(responses: ResponseRow[], viewCount: number): Summary {
  const received = responses.length;
  const invalid = responses.filter((response) => response.status === 'INVALID').length;
  const durations = responses
    .map((response) => response.durationMs)
    .filter((value): value is number => typeof value === 'number' && value > 0)
    .sort((a, b) => a - b);

  return {
    received,
    invalid,
    valid: received - invalid,
    views: viewCount,
    completionRate: viewCount > 0 ? received / viewCount : null,
    averageDurationMs:
      durations.length > 0
        ? Math.round(durations.reduce((sum, value) => sum + value, 0) / durations.length)
        : null,
    // 中位数比平均数更抗极端值：有人开着页面去吃饭，平均数就被拉走了
    medianDurationMs:
      durations.length > 0
        ? (durations[Math.floor((durations.length - 1) / 2)]! +
            durations[Math.ceil((durations.length - 1) / 2)]!) /
          2
        : null,
  };
}

export type TrendPoint = { key: string; label: string; count: number };

/** 趋势图的横轴区间（两端都**含**） */
export type TrendRange = { from: Date; to: Date };

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * 一个图里画多少个点以上就没人读得出来了。
 * 手改 URL 给出「1900-01-01 到 2100-01-01」时，即使按月也有一千多个点。
 */
const MAX_BUCKETS = 120;

/**
 * 粒度按**跨度**自动选。
 *
 * 界面上不再有「日 / 周 / 月」切换（所有者反馈：它与日期筛选挤在一起，而且说的是同一件事），
 * 于是这个判断从用户手里收到这里 —— 收回来之后规则才可能被单测盯住：
 * 两个月内按天看、一年多内按周看、更长按月看。
 */
export function pickGranularity(from: Date, to: Date): TrendGranularity {
  const days = Math.max(1, Math.ceil((to.getTime() - from.getTime() + DAY_MS) / DAY_MS));

  if (days <= 62) return TREND_GRANULARITY.DAY;
  if (days <= 400) return TREND_GRANULARITY.WEEK;

  return TREND_GRANULARITY.MONTH;
}

/**
 * 回收趋势。**只统计有效答卷**（与图表口径一致）。
 *
 * 两条刻意的口径：
 * - **横轴就是筛选区间**，不再固定成「最近 14 天」：选了 9 月却画最近两周，
 *   等于让筛选条件对图表失效（图与卡片说的会是两件事）。
 * - 空桶也要画出来：只画有数据的那几天，会让「那天其实是 0」看起来像「那天不存在」。
 */
export function buildTrend(
  responses: ResponseRow[],
  range: TrendRange,
): { granularity: TrendGranularity; points: TrendPoint[] } {
  const granularity = pickGranularity(range.from, range.to);
  const valid = responses.filter((response) => response.status === 'VALID');
  const buckets = buildBuckets(granularity, range.from, range.to);
  const counts = new Map(buckets.map((bucket) => [bucket.key, 0]));

  for (const response of valid) {
    const key = bucketKey(granularity, response.submittedAt);
    if (counts.has(key)) counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return {
    granularity,
    points: buckets.map((bucket) => ({
      key: bucket.key,
      label: bucket.label,
      count: counts.get(bucket.key) ?? 0,
    })),
  };
}

type Bucket = { key: string; label: string };

/**
 * 覆盖 `[from, to]` 的桶。
 *
 * **从 `to` 往回走**而不是从 `from` 往前走：区间长到触发 `MAX_BUCKETS` 时，
 * 该保留的是最近那一段（人要看的是「最近怎么样」），不是最早那一段。
 */
function buildBuckets(granularity: TrendGranularity, from: Date, to: Date): Bucket[] {
  const buckets: Bucket[] = [];
  const floor = bucketStart(granularity, from);
  let cursor = bucketStart(granularity, to);

  while (cursor.getTime() >= floor.getTime() && buckets.length < MAX_BUCKETS) {
    buckets.push({
      key: bucketKey(granularity, cursor),
      label: formatBucketLabel(granularity, cursor),
    });
    cursor = previousBucketStart(granularity, cursor);
  }

  return buckets.reverse();
}

function bucketStart(granularity: TrendGranularity, date: Date) {
  if (granularity === TREND_GRANULARITY.DAY) return displayDayStart(date);
  if (granularity === TREND_GRANULARITY.WEEK) return displayWeekStart(date);

  return displayMonthStart(date);
}

function previousBucketStart(granularity: TrendGranularity, start: Date) {
  if (granularity === TREND_GRANULARITY.MONTH) {
    // 月份长度不固定：「上一个月」是「1 号往前一天再取月初」，
    // 而不是减 30 天 —— 那会从 3 月 31 日跳回 3 月 1 日，原地打转
    return displayMonthStart(new Date(start.getTime() - DAY_MS));
  }

  return new Date(start.getTime() - (granularity === TREND_GRANULARITY.DAY ? DAY_MS : 7 * DAY_MS));
}

/** 时区常量从 `utils/format` 取，不在各处再写一遍「Asia/Shanghai」 */
function zoneFormat(date: Date, options: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: DISPLAY_TIME_ZONE, ...options }).format(date);
}

function bucketKey(granularity: TrendGranularity, date: Date) {
  if (granularity === TREND_GRANULARITY.MONTH) {
    return zoneFormat(date, { year: 'numeric', month: '2-digit' });
  }

  // 周与天都按「那一天」归桶，周再往前推到期初由 label 体现
  const day = zoneFormat(date, { year: 'numeric', month: '2-digit', day: '2-digit' });
  if (granularity === TREND_GRANULARITY.DAY) return day;

  const weekStart = displayWeekStart(date);

  return `W${zoneFormat(weekStart, { year: 'numeric', month: '2-digit', day: '2-digit' })}`;
}

function formatBucketLabel(granularity: TrendGranularity, date: Date) {
  if (granularity === TREND_GRANULARITY.MONTH) {
    return zoneFormat(date, { year: 'numeric', month: '2-digit' });
  }

  if (granularity === TREND_GRANULARITY.WEEK) {
    const start = displayWeekStart(date);

    return zoneFormat(start, { month: '2-digit', day: '2-digit' });
  }

  return zoneFormat(date, { month: '2-digit', day: '2-digit' });
}

/** 一道题的统计结果。三种形态对应三类完全不同的读法 */
export type QuestionStats =
  | {
      kind: 'CHOICE';
      multi: boolean;
      answered: number;
      rows: { label: string; count: number; percent: number }[];
    }
  | {
      kind: 'RATING';
      answered: number;
      average: number | null;
      max: number;
      rows: { score: number; count: number; percent: number }[];
    }
  | {
      kind: 'TEXT';
      answered: number;
      /** 作答率 = 作答人数 ÷ 有效答卷数（选填题才有意义） */
      answerRate: number | null;
      /** 卡片上先露三条，避免一屏全是文字 */
      samples: string[];
      /** 全部回答，供「查看全部 N 条回答」的弹层用 */
      all: string[];
    };

export type QuestionForStats = {
  type: QuestionType;
  options: string[];
  min: number | null;
  max: number | null;
  required: boolean;
};

/**
 * 单题统计。
 *
 * `answers` 只包含**有效答卷**的作答值 —— 调用方负责过滤，这里不再判断一遍：
 * 口径集中在调用链的入口（`api/analytics.ts`）比散在每个函数里更难搞错。
 */
export function summarizeQuestion(
  question: QuestionForStats,
  answers: unknown[],
  validResponseCount: number,
): QuestionStats {
  const answered = answers.length;

  if (question.type === 'SINGLE' || question.type === 'MULTI' || question.type === 'DROPDOWN') {
    const multi = question.type === 'MULTI';
    const counts = new Map(question.options.map((option) => [option, 0]));

    for (const value of answers) {
      const picked = Array.isArray(value) ? value : typeof value === 'string' ? [value] : [];
      for (const item of picked) {
        if (typeof item === 'string' && counts.has(item)) {
          counts.set(item, (counts.get(item) ?? 0) + 1);
        }
      }
    }

    return {
      kind: 'CHOICE',
      multi,
      answered,
      // 分母是**作答人数**而不是总人数：没答这道题的人不该把占比摊薄
      rows: [...counts.entries()].map(([label, count]) => ({
        label,
        count,
        percent: answered > 0 ? count / answered : 0,
      })),
    };
  }

  if (question.type === 'RATING') {
    const { min, max } = ratingBounds({
      min: question.min ?? undefined,
      max: question.max ?? undefined,
    });
    const counts = new Map<number, number>();
    for (let score = min; score <= max; score += 1) counts.set(score, 0);

    let sum = 0;
    let scored = 0;

    for (const value of answers) {
      const score = typeof value === 'number' ? value : Number(value);
      if (!Number.isInteger(score) || !counts.has(score)) continue;

      counts.set(score, (counts.get(score) ?? 0) + 1);
      sum += score;
      scored += 1;
    }

    return {
      kind: 'RATING',
      answered: scored,
      // 保留一位小数（设计稿 W06 的注释）
      average: scored > 0 ? Math.round((sum / scored) * 10) / 10 : null,
      max,
      rows: [...counts.entries()].map(([score, count]) => ({
        score,
        count,
        percent: scored > 0 ? count / scored : 0,
      })),
    };
  }

  // 日期题在明细里当文本看即可，所以与填空合并处理
  const texts = answers.filter(
    (value): value is string => typeof value === 'string' && value.trim() !== '',
  );

  return {
    kind: 'TEXT',
    answered: texts.length,
    answerRate: validResponseCount > 0 ? texts.length / validResponseCount : null,
    samples: texts.slice(0, 3),
    all: texts,
  };
}
