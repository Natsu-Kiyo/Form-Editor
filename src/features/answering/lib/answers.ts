import type { QuestionType } from '@/config/constants';
import { ratingBounds } from '@/config/constants';

/**
 * 作答值的校验与归一。
 *
 * **纯函数、单独一个文件**：这是提交链路上唯一真正复杂的地方（八种题型各有一套规则，
 * 还要判必答），而且它同时被客户端（提前提示）与服务端（最终拦截）使用 ——
 * 两边各写一份必然出现「前端说必答、后端放过去」。
 *
 * 值的形态（写进 `Answer.value` 这个 Json 列，与导出 JSON 的口径一致）：
 * - 选择类：**选项文案**（单选是字符串，多选是字符串数组）。存 id 会让导出的数据不可读，
 *   而选项一旦被删，id 就指向不存在的行了。
 * - 评分：数字；填空与日期：字符串。
 * - 矩阵（R62）：`{ 行文案: 列文案 }` 的对象，行列都必须是这道题真实存在的（防手改请求）。
 */
export type AnswerValue = string | number | string[] | Record<string, string>;

export type SubmittableQuestion = {
  id: string;
  type: QuestionType;
  title: string;
  required: boolean;
  min: number | null;
  max: number | null;
  maxLength: number | null;
  options: string[];
  /** 矩阵题的列（**行**在 `options` 里，与选项同构）；其余题型为空数组 */
  columns: string[];
};

export type ParsedAnswers =
  | { ok: true; answers: { questionId: string; value: AnswerValue }[] }
  | { ok: false; fieldErrors: Record<string, string> };

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** 一道题「算不算答了」。空字符串、空数组、空对象、undefined 都算没答 */
export function isAnswered(value: AnswerValue | undefined) {
  if (value === undefined || value === null) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'object') return Object.keys(value).length > 0;

  return Number.isFinite(value);
}

/**
 * 一道题「按必答口径算不算答完」。
 *
 * 与 `isAnswered` 的唯一差别在矩阵：**必答时每一行都要选**（R62 所有者拍板 ——
 * 矩阵的语义是逐行评价，缺行就是没做完）。判定要看题面（有哪些行），光看值不够。
 * 其余题型两者等价 —— 客户端与服务端的必答校验都调这一个函数，规则只写一遍。
 */
export function isQuestionAnswered(question: SubmittableQuestion, value: AnswerValue | undefined) {
  if (question.type !== 'MATRIX') return isAnswered(value);
  if (value === undefined || value === null || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  const picked = value as Record<string, string>;

  return question.options.every((row) => Boolean(picked[row]));
}

/**
 * 校验并归一。
 *
 * 不认识的问题 id **直接忽略**（而不是报错）：问卷结构可能在作答期间被改过
 * （发布即冻结，但草稿改完再发布是常见路径），此时多出来的答案不该让整份提交失败。
 * 反过来，**题目缺答必须拦住** —— 那才是真的丢数据。
 */
export function parseAnswers(
  questions: SubmittableQuestion[],
  raw: Record<string, unknown>,
): ParsedAnswers {
  const answers: { questionId: string; value: AnswerValue }[] = [];
  const fieldErrors: Record<string, string> = {};

  for (const question of questions) {
    const value = normalize(question, raw[question.id]);
    const done = value !== null && (!question.required || isQuestionAnswered(question, value));

    if (!done) {
      if (question.required) {
        fieldErrors[question.id] = question.type === 'MATRIX' ? '每一行都要选' : '这是必答题';
      }
      // 可选题「答了一部分」（目前只有矩阵会出现）仍然收下：不能把它当成没答丢掉
      if (value !== null) answers.push({ questionId: question.id, value });
      continue;
    }

    answers.push({ questionId: question.id, value });
  }

  if (Object.keys(fieldErrors).length > 0) return { ok: false, fieldErrors };

  return { ok: true, answers };
}

/** 归一单题；返回 null 表示「没答」或「格式不对」（格式不对也当作没答，交给必答规则处理） */
function normalize(question: SubmittableQuestion, raw: unknown): AnswerValue | null {
  switch (question.type) {
    case 'SINGLE':
    case 'DROPDOWN': {
      const text = typeof raw === 'string' ? raw : '';
      // 只认这道题真实存在的选项：手改请求塞进来的值不能进库
      return question.options.includes(text) ? text : null;
    }

    case 'MULTI': {
      if (!Array.isArray(raw)) return null;
      const picked = [...new Set(raw.filter((item): item is string => typeof item === 'string'))]
        // 保序：按选项顺序存，这样导出的多选答案与界面上看到的顺序一致
        .filter((item) => question.options.includes(item));

      return picked.length > 0 ? picked : null;
    }

    case 'RATING': {
      const score = typeof raw === 'number' ? raw : Number(raw);
      const { min, max } = ratingBounds({
        min: question.min ?? undefined,
        max: question.max ?? undefined,
      });

      return Number.isInteger(score) && score >= min && score <= max ? score : null;
    }

    case 'SHORT_TEXT':
    case 'LONG_TEXT': {
      const text = typeof raw === 'string' ? raw.trim() : '';
      if (text.length === 0) return null;

      // 超长直接截断而不是报错：用户的输入不该因为一个上限被丢掉
      return text.slice(0, question.maxLength ?? 500);
    }

    case 'DATE': {
      const text = typeof raw === 'string' ? raw.trim() : '';

      return DATE_PATTERN.test(text) ? text : null;
    }

    case 'MATRIX': {
      if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null;

      const source = raw as Record<string, unknown>;
      const picked: Record<string, string> = {};

      for (const row of question.options) {
        const column = source[row];
        // 与单选同一条规矩：只认这道题真实存在的列，手改请求塞进来的值不能进库
        if (typeof column === 'string' && question.columns.includes(column)) picked[row] = column;
      }

      return Object.keys(picked).length > 0 ? picked : null;
    }

    default:
      return null;
  }
}

/**
 * 题型的展示说明（设计稿 W12 每道题标题下那一行）：
 * 「多选 · 可选 · 选项顺序随机」这种，把「怎么答、是不是必答、有什么怪癖」一次说清。
 */
export function describeAnswerHint(question: SubmittableQuestion) {
  const parts: string[] = [];

  switch (question.type) {
    case 'SINGLE':
      parts.push('单选');
      break;
    case 'MULTI':
      parts.push('多选');
      break;
    case 'DROPDOWN':
      parts.push('下拉选择');
      break;
    case 'RATING': {
      const { min, max } = ratingBounds({
        min: question.min ?? undefined,
        max: question.max ?? undefined,
      });
      parts.push(`评分 · ${min}–${max} 分`);
      break;
    }
    case 'SHORT_TEXT':
      parts.push('单行填空');
      break;
    case 'LONG_TEXT':
      parts.push('多行填空');
      break;
    case 'DATE':
      parts.push('日期');
      break;
    case 'MATRIX':
      parts.push(`矩阵 · ${question.options.length} 行 × ${question.columns.length} 列`);
      break;
  }

  parts.push(question.required ? '必答' : '可选');

  if (question.type === 'MULTI' && question.options.length > 1) {
    parts.push('可多选');
  }

  if (question.maxLength && (question.type === 'SHORT_TEXT' || question.type === 'LONG_TEXT')) {
    parts.push(`最多 ${question.maxLength} 字`);
  }

  return parts.join(' · ');
}
