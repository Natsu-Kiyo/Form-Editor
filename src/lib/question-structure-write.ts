import 'server-only';

import type { Prisma } from '@/generated/prisma/client';
import { toJsonColumn } from '@/lib/json';
import type { QuestionnairePayload } from '@/lib/questionnaire-structure';

/**
 * 把一份题目结构**批量**写入某份问卷（审查 #15）。
 *
 * 新建 / 整份替换 / 导入三条路径共用这一个实现。原先各自 `for` 循环逐题 `create`：
 * 跨境库单次往返约 223ms，50 题就是 50 次往返 —— 20 秒的交互事务很容易
 * `expired transaction`，而且报错与「题太多」毫无关系，用户只会看到保存失败。
 *
 * 现在固定**两次往返**：题目一次 `createManyAndReturn`（拿回 id），选项一次 `createMany`。
 * 与题数、选项数无关。
 *
 * 调用方负责**先删旧结构**（替换场景）与事务边界 —— 这里只做插入。
 */
export async function insertQuestionStructure(
  tx: Prisma.TransactionClient,
  questionnaireId: string,
  questions: QuestionnairePayload['questions'],
) {
  if (questions.length === 0) return;

  const created = await tx.question.createManyAndReturn({
    data: questions.map((question, index) => ({
      questionnaireId,
      type: question.type,
      title: question.title,
      description: question.description ?? null,
      required: question.required,
      shuffleOptions: question.shuffleOptions,
      order: index,
      pageIndex: question.pageIndex,
      config: toJsonColumn(question.config),
    })),
    select: { id: true, order: true },
  });

  // `createManyAndReturn` 返回的行序**不保证**等于输入序：按 order 认领，不拿下标赌
  const idByOrder = new Map(created.map((row) => [row.order, row.id]));

  const options = questions.flatMap((question, index) => {
    const questionId = idByOrder.get(index);
    if (!questionId) return [];

    return question.options.map((label, optionIndex) => ({
      questionId,
      label,
      order: optionIndex,
    }));
  });

  if (options.length > 0) await tx.option.createMany({ data: options });
}
