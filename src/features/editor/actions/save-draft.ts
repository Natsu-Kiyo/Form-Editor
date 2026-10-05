'use server';

import { revalidatePath } from 'next/cache';

import { requireDraftQuestionnaire } from '@/lib/auth/questionnaire-access';
import { prisma } from '@/lib/db';
import { toJsonColumn } from '@/lib/json';
import { questionnairePayloadSchema } from '@/lib/questionnaire-structure';

export type SaveDraftResult = { ok: true } | { ok: false; message: string };

/**
 * 保存编辑器草稿 —— **编辑器唯一的写入口**。
 *
 * 为什么是「整份结构替换」而不是逐字段更新：
 * - 手动保存的语义就是「把当前这份结构存下来」，一次事务写完，要么全成功要么全不动；
 *   逐字段更新会把一份结构拆成几十次往返，中途失败就留下一份半成品。
 * - 题目与选项在这里**删掉重建**。草稿态不该有答卷（发布即冻结，能编辑的一定是草稿），
 *   所以级联删掉作答值不会丢数据。
 *
 * 为什么只 revalidate 这一页、不带 layout：
 * 编辑器 layout 的上一层是管理台侧栏（工作区、通知、会话数）。改题目结构与侧栏无关，
 * 把它一起重触发就是白花四五次跨区域查询 —— 那正是「保存很慢」的元凶。
 */
export async function saveEditorDraftAction(
  questionnaireId: string,
  draft: unknown,
): Promise<SaveDraftResult> {
  await requireDraftQuestionnaire(questionnaireId);

  const parsed = questionnairePayloadSchema.safeParse(draft);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    const where = first.path.join('.') || '根节点';
    return { ok: false, message: `结构不合法（${where}：${first.message}）` };
  }

  const payload = parsed.data;

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

  revalidatePath(`/app/q/${questionnaireId}/edit`);

  return { ok: true };
}
