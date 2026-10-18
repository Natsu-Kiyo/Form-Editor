import type { IdentityMode, QuestionType } from '@/config/constants';

/** 选择题：没有选项就没人能填 */
const CHOICE_TYPES: readonly QuestionType[] = ['SINGLE', 'MULTI', 'DROPDOWN'];
const TEXT_TYPES: readonly QuestionType[] = ['SHORT_TEXT', 'LONG_TEXT'];

/**
 * 发布前检查。
 *
 * 刻意写成**纯函数**：它是这一块唯一真正复杂的判断（时间合法性、上限与已回收量的矛盾、
 * 题目完整性），而纯函数能被单测穷举 —— 发布是不可逆操作，靠手点验不完。
 *
 * 检查分两档，界面上必须能分辨：
 * - `error`：**拦住发布**。发布出去一份没人能填、或结构与统计口径对不上的问卷，
 *   代价远大于让用户回去改两行。
 * - `warn`：**只提示**。例如「有选填题」—— 那是问卷设计者的合理选择，不该拦。
 */
export type PreflightTone = 'ok' | 'warn' | 'error';

export type PreflightCheck = {
  id: string;
  tone: PreflightTone;
  text: string;
};

/**
 * 发布前检查看到的一道题（**结构字段是必须的**）。
 *
 * 以前这里只收 `title` / `required`，于是「选择题零选项」「文本框长度上限为 0」
 * 这类**发布出去就没人能填**的结构问题根本不在检查范围内（审查 #4）。
 * 字段刻意必填：少传一个就会被类型检查拦下，而不是静默跳过一条检查。
 */
export type PreflightQuestion = {
  title: string;
  required: boolean;
  type: QuestionType;
  /** 选项数；矩阵题是行数，其余题型为 0 */
  optionCount: number;
  /** 文本题的 `config.maxLength`；没写过为 null */
  maxLength: number | null;
};

/** 从数据库的 Json 列里读长度上限（形状不对就当没写，与读取侧同一条容错口径） */
export function readMaxLength(config: unknown): number | null {
  if (typeof config !== 'object' || config === null) return null;

  const value = (config as Record<string, unknown>).maxLength;

  return typeof value === 'number' ? value : null;
}

export type PreflightInput = {
  questions: PreflightQuestion[];
  startsAt: Date | null;
  endsAt: Date | null;
  responseLimit: number | null;
  responseCount: number;
  identityMode: IdentityMode;
  hasPassword: boolean;
  /** 注入「现在」，让单测能固定时间 */
  now: Date;
};

export type PreflightResult = {
  checks: PreflightCheck[];
  /** 有多少项「拦住发布」的问题 */
  blockerCount: number;
  /** 通过项 / 总项，用于进度条。设计稿的「完整度 92%」没有定义算法，这里用真实比例 */
  passedRatio: number;
  canPublish: boolean;
};

export function runPreflight(input: PreflightInput): PreflightResult {
  const checks: PreflightCheck[] = [];
  const { questions, startsAt, endsAt, responseLimit, responseCount, now } = input;

  // ---- 题目结构 ----
  if (questions.length === 0) {
    checks.push({ id: 'no-question', tone: 'error', text: '还没有题目，至少要有 1 道才能发布' });
  } else {
    const untitled = questions.filter((question) => question.title.trim().length === 0).length;

    if (untitled > 0) {
      checks.push({
        id: 'untitled',
        tone: 'error',
        text: `有 ${untitled} 道题还没写题目`,
      });
    } else {
      checks.push({
        id: 'titled',
        tone: 'ok',
        text: `共 ${questions.length} 道题目，标题均已填写`,
      });
    }
  }

  /*
   * ---- 结构上「没人能填」（审查 #4）----
   * 与「标题空着」同属发布前的硬拦：这类问卷发出去，作答者打开就是死路。
   * 写入侧（`payloadQuestionSchema`）已经拦住了新保存，这里兜的是**改动之前就在库里**的草稿，
   * 否则「发布前检查说没问题」会是一句空话。
   */
  const emptyChoice = questions.filter(
    (question) => CHOICE_TYPES.includes(question.type) && question.optionCount === 0,
  ).length;

  if (emptyChoice > 0) {
    checks.push({
      id: 'empty-options',
      tone: 'error',
      text: `有 ${emptyChoice} 道选择题没有选项，作答者无法填写`,
    });
  }

  const zeroLength = questions.filter(
    (question) =>
      TEXT_TYPES.includes(question.type) && question.maxLength !== null && question.maxLength < 1,
  ).length;

  if (zeroLength > 0) {
    checks.push({
      id: 'zero-max-length',
      tone: 'error',
      text: `有 ${zeroLength} 道填空题的长度上限小于 1，作答内容会被截成空`,
    });
  }

  // ---- 回收时间 ----
  if (!startsAt && !endsAt) {
    checks.push({ id: 'open-ended', tone: 'warn', text: '未设置回收时间，将长期开放直到手动截止' });
  } else if (startsAt && endsAt && endsAt.getTime() <= startsAt.getTime()) {
    checks.push({ id: 'time-order', tone: 'error', text: '结束时间必须晚于开始时间' });
  } else if (endsAt && endsAt.getTime() <= now.getTime()) {
    checks.push({ id: 'time-past', tone: 'error', text: '结束时间已经过去，请改成一个将来的时间' });
  } else {
    checks.push({ id: 'time-set', tone: 'ok', text: '回收时间已设置' });
  }

  // ---- 回收份数上限 ----
  if (responseLimit !== null) {
    if (responseLimit < 1) {
      checks.push({ id: 'limit-zero', tone: 'error', text: '回收上限至少为 1 份' });
    } else if (responseLimit <= responseCount) {
      // 上限小于已回收量会让问卷一发布就立刻截止，那不是用户想要的
      checks.push({
        id: 'limit-below-collected',
        tone: 'error',
        text: `回收上限（${responseLimit}）不能小于已回收的 ${responseCount} 份`,
      });
    } else {
      checks.push({
        id: 'limit-ok',
        tone: 'ok',
        text: `回收上限 ${responseLimit} 份，达到后自动截止`,
      });
    }
  }

  // ---- 作答身份 ----
  if (input.identityMode === 'PASSWORD' && !input.hasPassword) {
    checks.push({ id: 'password-missing', tone: 'error', text: '口令访问需要设置一个口令' });
  } else {
    checks.push({ id: 'identity-set', tone: 'ok', text: '作答身份已选择' });
  }

  // ---- 只提示、不拦 ----
  const optionalQuestions = questions.filter((question) => !question.required);
  if (optionalQuestions.length > 0 && questions.length > 0) {
    checks.push({
      id: 'optional',
      tone: 'warn',
      text: `有 ${optionalQuestions.length} 道选填题，确认是否需要改为必填`,
    });
  }

  const blockerCount = checks.filter((check) => check.tone === 'error').length;
  const passed = checks.filter((check) => check.tone === 'ok').length;

  return {
    checks,
    blockerCount,
    passedRatio: checks.length === 0 ? 1 : passed / checks.length,
    canPublish: blockerCount === 0,
  };
}
