import 'server-only';

import { prisma } from '@/lib/db';
import type { QuestionnairePayload } from '@/lib/questionnaire-structure';

/**
 * 读一份问卷的结构快照。
 *
 * 为什么在 shared 层：**四个调用方分属两个 feature** —— 导出 JSON / 复制问卷 / 另存为模板
 * （questionnaire），以及发布时写版本快照（publish）。而 features 之间禁止互相导入。
 *
 * 为什么与 `questionnaire-structure.ts` 拆成两个文件：那个文件是**纯 schema**，
 * 要被单测直接导入；这里必须 server-only（要碰数据库）。混在一起会让单测跑不起来。
 */
export async function getQuestionnairePayload(
  questionnaireId: string,
): Promise<{ title: string; intro: string | null; payload: QuestionnairePayload } | null> {
  const questionnaire = await prisma.questionnaire.findUnique({
    where: { id: questionnaireId },
    select: {
      title: true,
      intro: true,
      questions: {
        orderBy: { order: 'asc' },
        select: {
          type: true,
          title: true,
          description: true,
          required: true,
          shuffleOptions: true,
          pageIndex: true,
          config: true,
          options: { orderBy: { order: 'asc' }, select: { label: true } },
        },
      },
    },
  });

  if (!questionnaire) return null;

  return {
    title: questionnaire.title,
    intro: questionnaire.intro,
    payload: {
      formatVersion: 1,
      title: questionnaire.title,
      intro: questionnaire.intro,
      questions: questionnaire.questions.map((question) => ({
        type: question.type,
        title: question.title,
        description: question.description,
        required: question.required,
        shuffleOptions: question.shuffleOptions,
        pageIndex: question.pageIndex,
        config: (question.config ?? null) as Record<string, unknown> | null,
        options: question.options.map((option) => option.label),
      })),
    },
  };
}
