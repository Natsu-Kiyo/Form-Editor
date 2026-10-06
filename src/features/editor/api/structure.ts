import 'server-only';

import { prisma } from '@/lib/db';
import { toJsonColumn } from '@/lib/json';
import type { QuestionnairePayload } from '@/lib/questionnaire-structure';

/**
 * 把一份结构**整份**写进问卷（题目与选项删掉重建）。
 *
 * 编辑器有两条路径要写结构：保存草稿、回滚版本。两条都用这一个函数 ——
 * 各写一份必然出现「回滚后选项顺序不对」这类只在其中一条路径上的问题。
 *
 * 为什么是整份替换而不是逐字段更新：
 * - 「把当前这份结构存下来」本来就是一个原子动作，一次事务写完，要么全成要么全不动；
 *   逐字段更新会把一份结构拆成几十次跨区域往返，中途失败就留下半成品。
 * - 题目与选项在这里**删掉重建**。能走到这里的问卷一定是草稿
 *   （发布即冻结，`requireDraftQuestionnaire` 会把关），草稿态不该有答卷，
 *   所以级联删掉作答值不会丢数据。
 */
export async function replaceStructure(questionnaireId: string, payload: QuestionnairePayload) {
  await prisma.$transaction(async (tx) => {
    await tx.questionnaire.update({
      where: { id: questionnaireId },
      data: { title: payload.title.slice(0, 80), intro: payload.intro ?? null },
    });

    await tx.question.deleteMany({ where: { questionnaireId } });

    for (const [index, question] of payload.questions.entries()) {
      await tx.question.create({
        data: {
          questionnaireId,
          type: question.type,
          title: question.title,
          description: question.description ?? null,
          required: question.required,
          shuffleOptions: question.shuffleOptions,
          order: index,
          pageIndex: question.pageIndex,
          config: toJsonColumn(question.config),
          options: question.options.length
            ? {
                create: question.options.map((label, optionIndex) => ({
                  label,
                  order: optionIndex,
                })),
              }
            : undefined,
        },
      });
    }
  });
}
