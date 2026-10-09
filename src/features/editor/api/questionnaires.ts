import 'server-only';

import { cache } from 'react';

import {
  RATING_SCALE,
  matrixColumns,
  type QuestionnaireStatus,
  type QuestionType,
} from '@/config/constants';
import { prisma } from '@/lib/db';

/** 编辑器可用的题型 = 全部 8 个（R62 矩阵开放后不再有补集） */
export type EditableQuestionType = QuestionType;

/** 题型差异项：评分范围、文本长度上限、矩阵的列 */
export type QuestionConfig = {
  min?: number;
  max?: number;
  maxLength?: number;
  /** 矩阵题的列（**行**在 `options` 里，与选项同构） */
  columns?: string[];
};

export type EditorOption = {
  id: string;
  label: string;
};

export type EditorQuestion = {
  id: string;
  type: EditableQuestionType;
  title: string;
  description: string | null;
  required: boolean;
  shuffleOptions: boolean;
  pageIndex: number;
  config: QuestionConfig;
  options: EditorOption[];
};

/** 编辑器为什么只读。`null` 表示可编辑 */
export type EditorReadOnlyReason = 'NO_PERMISSION' | 'FROZEN' | 'ARCHIVED' | null;

export type EditorQuestionnaire = {
  id: string;
  title: string;
  intro: string | null;
  status: QuestionnaireStatus;
  readOnlyReason: EditorReadOnlyReason;
  questions: EditorQuestion[];
};

/**
 * 读 Json 列的 config。
 *
 * 一律当**不可信输入**处理：字段可能缺失、可能是别的题型留下的、也可能是手改库留下的。
 * 所以逐字段校验类型并丢掉不认识的值，而不是直接把 Json 当 config 用 ——
 * 否则一个坏值会在渲染层炸出一个没人看得懂的错。
 */
function parseConfig(raw: unknown, type: EditableQuestionType): QuestionConfig {
  const source = (raw ?? {}) as Record<string, unknown>;
  const config: QuestionConfig = {};

  const min = source.min;
  const max = source.max;
  const maxLength = source.maxLength;

  if (type === 'RATING') {
    // 读进来就按当前规则收敛（上限规则是后加的，库里可能残留过大的历史值）：
    // 停在读取这一处，草稿与下次保存自然都是规范值，展示层不用各自再兜一遍
    config.min =
      typeof min === 'number'
        ? Math.min(Math.max(min, RATING_SCALE.MIN), RATING_SCALE.MAX - 1)
        : RATING_SCALE.MIN;
    config.max = typeof max === 'number' && max > config.min ? Math.min(max, RATING_SCALE.MAX) : 5;
  }

  if (type === 'SHORT_TEXT' || type === 'LONG_TEXT') {
    config.maxLength = typeof maxLength === 'number' && maxLength > 0 ? maxLength : undefined;
  }

  if (type === 'MATRIX') {
    // 与 RATING 同一条思路：读进来就按当前规则收敛（上限规则后加，库里可能残留超长/超量的值）
    config.columns = matrixColumns(source);
  }

  return config;
}

/** 编辑器需要的全部数据。`cache` 让 layout 与 page 在同一请求里只查一次 */
export const getEditorQuestionnaire = cache(
  async (questionnaireId: string): Promise<EditorQuestionnaire | null> => {
    const row = await prisma.questionnaire.findUnique({
      where: { id: questionnaireId },
      select: {
        id: true,
        title: true,
        intro: true,
        status: true,
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
            options: { orderBy: { order: 'asc' }, select: { id: true, label: true } },
          },
        },
      },
    });

    if (!row) return null;

    return {
      id: row.id,
      title: row.title,
      intro: row.intro,
      status: row.status as QuestionnaireStatus,
      // 只读理由由调用方（页面）结合角色决定，这里先留空
      readOnlyReason: null,
      questions: row.questions.map((question) => {
        const type = question.type as EditableQuestionType;

        return {
          id: question.id,
          type,
          title: question.title,
          description: question.description,
          required: question.required,
          shuffleOptions: question.shuffleOptions,
          pageIndex: question.pageIndex,
          config: parseConfig(question.config, type),
          options: question.options,
        };
      }),
    };
  },
);

/** 紧接着要写入的 `order`。用「最大值 + 1」而不是「数量」—— 删过题目之后数量会小于最大值 */
export async function getNextQuestionOrder(questionnaireId: string) {
  const last = await prisma.question.findFirst({
    where: { questionnaireId },
    orderBy: { order: 'desc' },
    select: { order: true },
  });

  return (last?.order ?? -1) + 1;
}

export function getQuestionCount(questionnaireId: string) {
  return prisma.question.count({ where: { questionnaireId } });
}

export function renameQuestionnaire(questionnaireId: string, title: string) {
  return prisma.questionnaire.update({ where: { id: questionnaireId }, data: { title } });
}

export function getQuestionType(questionId: string) {
  return prisma.question.findUnique({
    where: { id: questionId },
    select: { id: true, type: true, questionnaireId: true, config: true },
  });
}
