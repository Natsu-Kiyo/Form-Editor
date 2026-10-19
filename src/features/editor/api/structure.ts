import 'server-only';

import { PAYLOAD_LIMITS } from '@/config/constants';
import { prisma } from '@/lib/db';
import type { QuestionnairePayload } from '@/lib/questionnaire-structure';
import { insertQuestionStructure } from '@/lib/question-structure-write';

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
      // 上限与 schema 同一份常量（R9-5）：这里只是防御性收敛，正常永远不会触发
      data: {
        title: payload.title.slice(0, PAYLOAD_LIMITS.QUESTIONNAIRE_TITLE),
        intro: payload.intro ?? null,
      },
    });

    await tx.question.deleteMany({ where: { questionnaireId } });

    // 两次往返写完（审查 #15）：题数与选项数都不再影响事务时长
    await insertQuestionStructure(tx, questionnaireId, payload.questions);
  });
}
