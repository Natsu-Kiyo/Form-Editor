import { z } from 'zod';

import {
  MATRIX_LIMITS,
  PAYLOAD_LIMITS,
  SHOW_IF_SOURCE_TYPES,
  showIfFrom,
  type QuestionType,
} from '@/config/constants';

/**
 * 问卷结构快照。
 *
 * **同一套结构同时承担三件事**：官方模板的 `Template.payload`、
 * 「导出 JSON」下发的文件、以及「导入 JSON」解析的对象。
 * 三者共用一个 schema 才不会出现「导出得出来、导入不回去」的错配。
 */

/** 数据库枚举里已开放的题型（R62 起 8 个全开放） */
const PAYLOAD_QUESTION_TYPES = [
  'SINGLE',
  'MULTI',
  'SHORT_TEXT',
  'LONG_TEXT',
  'RATING',
  'DROPDOWN',
  'DATE',
  'MATRIX',
] as const satisfies readonly QuestionType[];

/**
 * 找出**重名**的文案：选项、矩阵的行与列都按它判。
 *
 * 三条约定：
 * - **比较前先 `trim`**：「满意」与「满意 」在界面上看不出差别，当成两个选项只会让人困惑；
 * - **空串不参与**：空文案另有自己的报错（`min(1)` / 「矩阵题要有 N 列」），
 *   而且编辑器里「清空重输」是个真实的中间态，不该在那半秒里冒出一句重名；
 * - 返回值是**重复出现的那些文案**（去重后），好让报错能直接点名。
 *
 * 为什么放在这一层（而不是各写各的）：**闸门与界面必须是同一个判据** ——
 * schema 用它拦保存，编辑器那圈红框也用它画；两边各写一遍，迟早出现
 * 「框没红、保存却被拒」这种最难解释的不一致。
 */
export function duplicateLabels(labels: readonly string[]): string[] {
  const seen = new Set<string>();
  const repeated = new Set<string>();

  for (const label of labels) {
    const key = label.trim();
    if (!key) continue;
    if (seen.has(key)) repeated.add(key);
    seen.add(key);
  }

  return [...repeated];
}

export const payloadQuestionSchema = z
  .object({
    type: z.enum(PAYLOAD_QUESTION_TYPES),
    title: z
      .string()
      .trim()
      .min(1, { error: '题目不能为空' })
      .max(PAYLOAD_LIMITS.QUESTION_TITLE, {
        error: `题目不超过 ${PAYLOAD_LIMITS.QUESTION_TITLE} 个字`,
      }),
    description: z
      .string()
      .max(PAYLOAD_LIMITS.QUESTION_DESCRIPTION, {
        error: `题目说明不超过 ${PAYLOAD_LIMITS.QUESTION_DESCRIPTION} 个字`,
      })
      .nullish(),
    required: z.boolean().default(false),
    shuffleOptions: z.boolean().default(false),
    pageIndex: z.number().int().min(0).default(0),
    /** 题型差异项：评分范围、文本长度上限、矩阵的列等 */
    config: z.record(z.string(), z.unknown()).nullish(),
    /**
     * 选择类题型的选项文案；**矩阵题的「行」也在这一份**（两者结构完全同构，见 §R62）
     *
     * 两条限制都**必须带中文原文**（R96）：这是用户最容易撞上的一处 ——
     * 选项写长了、或者按住回车敲出个空选项 —— 而 zod 默认文案是
     * `Too big: expected string to have <=100 characters`，落在界面上等于没说。
     */
    options: z
      .array(
        z
          .string()
          .trim()
          .min(1, { error: '选项文案不能为空' })
          .max(PAYLOAD_LIMITS.OPTION_LABEL, {
            error: `选项不超过 ${PAYLOAD_LIMITS.OPTION_LABEL} 个字`,
          }),
      )
      .default([]),
  })
  /**
   * 矩阵题的额外要求（R62）：行 2–10（在 `options` 里）、列 2–5（在 `config.columns` 里），
   * 加上 R92 起的**不得重名**。
   *
   * 校验放在这里 —— 这是编辑器保存 / 版本回滚 / 模板 / JSON 导入**通路的唯一闸门**；
   * 界面上「删到下限就不给删」「重名标红」只是即时反馈，不是安全边界。
   */
  .superRefine((question, ctx) => {
    /*
     * 重名检查（R92 · N7）。放在题型分支**之前**，因为选项不是矩阵题专有。
     *
     * 这不只是 React key 的问题：**作答结果里存的就是选项文案**——
     * 两个都叫「满意」的选项在数据里无法区分：统计会把它们合成一项，
     * 条件显示（`showIf.options`）也会指到错的那个上。
     * 而 schema 是唯一能兜住三条写入通路的地方（编辑器 / 模板 / 导入 JSON）。
     */
    const unit = question.type === 'MATRIX' ? '行' : '选项';
    const duplicatedOptions = duplicateLabels(question.options);

    if (duplicatedOptions.length > 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['options'],
        message: `${unit}不能重名：${duplicatedOptions
          .map((label) => `「${label}」`)
          .join('、')}出现了不止一次`,
      });
    }

    /*
     * 「没人能填」的结构在这里挡住（审查 #4）。发布前检查也会再拦一次 ——
     * 但那是界面层的提示，而这条是三条写入通路（编辑器 / 模板 / 导入 JSON）的闸门：
     * - 选择题一个选项都没有：作答者只能看到一个空列表；
     * - 文本题的长度上限被写成 0：任何输入都会被截成空串，必填题永远交不上
     *   （编辑器里「清空字数再失焦」确实会写出 0，见 `MaxLengthField`）。
     */
    if (isChoiceQuestion(question.type) && question.options.length === 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['options'],
        message: '选择题至少要有 1 个选项',
      });
    }

    if (question.type === 'SHORT_TEXT' || question.type === 'LONG_TEXT') {
      const maxLength = question.config?.maxLength;

      if (typeof maxLength === 'number' && (!Number.isInteger(maxLength) || maxLength < 1)) {
        ctx.addIssue({
          code: 'custom',
          path: ['config', 'maxLength'],
          message: '文本长度上限至少为 1 个字',
        });
      }
    }

    if (question.type !== 'MATRIX') return;

    if (
      question.options.length < MATRIX_LIMITS.MIN_ROWS ||
      question.options.length > MATRIX_LIMITS.MAX_ROWS
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['options'],
        message: `矩阵题要有 ${MATRIX_LIMITS.MIN_ROWS}–${MATRIX_LIMITS.MAX_ROWS} 行`,
      });
    }

    // 矩阵的行文案要让「行标签 + 列刻度」放得下一行；超过这个长度会把整张表挤变形
    if (question.options.some((label) => label.length > MATRIX_LIMITS.MAX_ROW_LENGTH)) {
      ctx.addIssue({
        code: 'custom',
        path: ['options'],
        message: `矩阵的行不超过 ${MATRIX_LIMITS.MAX_ROW_LENGTH} 个字`,
      });
    }

    const rawColumns = question.config?.columns;
    const columns =
      Array.isArray(rawColumns) && rawColumns.every((item) => typeof item === 'string')
        ? (rawColumns as string[])
        : null;

    /*
     * 形状不合就到此为止：下面那条重名检查要在「有一个能比的字符串数组」的前提下做，
     * 混在一起写会让「列只有 1 个」和「两列同名」共用一句含糊的报错。
     */
    if (
      columns === null ||
      columns.length < MATRIX_LIMITS.MIN_COLUMNS ||
      columns.length > MATRIX_LIMITS.MAX_COLUMNS ||
      !columns.every(
        (item) => item.trim().length > 0 && item.length <= MATRIX_LIMITS.MAX_COLUMN_LENGTH,
      )
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['config', 'columns'],
        message: `矩阵题要有 ${MATRIX_LIMITS.MIN_COLUMNS}–${MATRIX_LIMITS.MAX_COLUMNS} 列`,
      });

      return;
    }

    // 列同样不能重名 —— 判据与行完全一样（作答结果按文案记录），只是位置在 config 里
    const duplicatedColumns = duplicateLabels(columns);

    if (duplicatedColumns.length > 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['config', 'columns'],
        message: `列不能重名：${duplicatedColumns
          .map((label) => `「${label}」`)
          .join('、')}出现了不止一次`,
      });
    }
  });

export const questionnairePayloadSchema = z
  .object({
    /** 结构版本号。将来结构变了，靠它决定要不要迁移旧文件 */
    formatVersion: z.literal(1),
    title: z
      .string()
      .trim()
      .min(1)
      .max(PAYLOAD_LIMITS.QUESTIONNAIRE_TITLE, {
        error: `问卷标题不超过 ${PAYLOAD_LIMITS.QUESTIONNAIRE_TITLE} 个字`,
      })
      .default('未命名问卷'),
    intro: z
      .string()
      .max(PAYLOAD_LIMITS.INTRO, { error: `卷首语不超过 ${PAYLOAD_LIMITS.INTRO} 个字` })
      .nullish(),
    questions: z
      .array(payloadQuestionSchema)
      .max(200, { error: '一份问卷最多 200 道题' })
      .default([]),
  })
  /**
   * 条件显示的跨题校验（R65）。三件事都只能在这一层做 —— 单题 schema 看不到兄弟题：
   * - 依赖必须是**前面的**题（这一条同时消灭了环路与求值顺序问题）；
   * - 依赖的题必须是选择类（有选项才谈得上命中）；
   * - 引用的选项必须还在（选项被删 / 改名之后，条件会指向空气）。
   */
  .superRefine((payload, ctx) => {
    payload.questions.forEach((question, index) => {
      const raw = question.config?.showIf;
      if (raw === undefined || raw === null) return;

      const showIf = showIfFrom(question.config ?? {});
      if (!showIf) {
        // 读取侧容错、写入侧严格：写了 showIf 但形状不对，不能静默丢掉。
        // 「勾了 0 个选项」单独给一句 —— 那是编辑器里真实的中间态，用户需要知道怎么办
        const rawOptions =
          typeof raw === 'object' && raw !== null && !Array.isArray(raw)
            ? (raw as Record<string, unknown>).options
            : undefined;
        const emptyOptions = Array.isArray(rawOptions) && rawOptions.length === 0;

        ctx.addIssue({
          code: 'custom',
          path: ['questions', index, 'config', 'showIf'],
          message: emptyOptions
            ? '显示条件至少要勾选一个选项（否则这道题永远不会显示）'
            : '显示条件的格式不正确',
        });

        return;
      }

      const source = payload.questions[showIf.questionIndex];
      if (!source || showIf.questionIndex >= index) {
        ctx.addIssue({
          code: 'custom',
          path: ['questions', index, 'config', 'showIf'],
          message: '显示条件只能指向前面已有的题目',
        });

        return;
      }

      if (!SHOW_IF_SOURCE_TYPES.includes(source.type)) {
        ctx.addIssue({
          code: 'custom',
          path: ['questions', index, 'config', 'showIf'],
          message: '显示条件只能引用选择类题目（单选 / 多选 / 下拉）',
        });

        return;
      }

      if (showIf.options.some((option) => !source.options.includes(option))) {
        ctx.addIssue({
          code: 'custom',
          path: ['questions', index, 'config', 'showIf'],
          message: '显示条件引用了已不存在的选项',
        });
      }
    });
  });

export type PayloadQuestion = z.infer<typeof payloadQuestionSchema>;
export type QuestionnairePayload = z.infer<typeof questionnairePayloadSchema>;

/**
 * 把 zod 的 issue path 翻成人话（R96）。
 *
 * 结构校验的报错会带一串机器路径（`questions.2.options.1`），直接甩给用户等于没解释 ——
 * 他既不知道 `questions.2` 是第几题，也不会把 `options.1` 读成「第二个选项」。
 * 编辑器与「导入 JSON」共用它，两处说法才不会各是一套。
 *
 * 只翻结构里真实存在的几层，认不出来的**原样回落到点号连接**：
 * 宁可显示得粗糙，也不要吞掉信息（这条路径会出现在用户的报错里，藏一半比说全更难查）。
 */
export function describeIssuePath(path: readonly PropertyKey[]): string {
  if (path.length === 0) return '问卷结构';

  const [head, ...rest] = path;

  if (head === 'title') return '问卷标题';
  if (head === 'intro') return '卷首语';
  if (head !== 'questions') return path.map(String).join('.');

  const index = Number(rest[0]);
  if (!Number.isInteger(index)) return '题目';

  const where = `第 ${index + 1} 题`;
  const [field, ...deeper] = rest.slice(1);

  if (field === undefined) return where;
  if (field === 'title') return `${where}的题目`;
  if (field === 'description') return `${where}的说明`;
  if (field === 'type') return `${where}的题型`;
  if (field === 'options') {
    return typeof deeper[0] === 'number'
      ? `${where}的第 ${deeper[0] + 1} 个选项`
      : `${where}的选项`;
  }
  if (field === 'config') {
    const leaf = deeper.at(-1);
    if (leaf === 'columns') return `${where}的列`;
    if (leaf === 'showIf') return `${where}的显示条件`;
    return `${where}的设置`;
  }

  return `${where}的${String(field)}`;
}

/** 只有选择题带「选项」 */
function isChoiceQuestion(type: QuestionType) {
  return type === 'SINGLE' || type === 'MULTI' || type === 'DROPDOWN';
}

/**
 * 题目载荷里带**一组有序文本项**的题型：选择类的选项 + 矩阵题的行（R62）。
 *
 * 两者结构完全同构、共用同一张 `Option` 表与同一套列表组件，
 * 所以凡是「这份结构里有没有那串文本项、要不要保留 `options`」的判断都用它，
 * 而不是在各地各自拼一遍题型清单。
 */
export function hasOptionList(type: QuestionType) {
  return isChoiceQuestion(type) || type === 'MATRIX';
}

/** 导出文件名：把标题里对文件名不友好的字符（含空白）换成连字符 */
export function payloadFileName(title: string) {
  const safe =
    title
      .trim()
      .replace(/[\\/:*?"<>|\s]+/g, '-')
      // 首尾的连字符要去掉，否则「   」这种全空白标题会变成文件名「-.json」
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'questionnaire';

  return `${safe}.json`;
}
