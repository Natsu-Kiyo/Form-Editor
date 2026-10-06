'use server';

import { revalidatePath } from 'next/cache';

import { requireDraftQuestionnaire } from '@/lib/auth/questionnaire-access';
import { questionnairePayloadSchema } from '@/lib/questionnaire-structure';
import { writeQuestionnaireVersion } from '@/lib/questionnaire-version';

import { replaceStructure } from '../api/structure';

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
  const { user } = await requireDraftQuestionnaire(questionnaireId);

  const parsed = questionnairePayloadSchema.safeParse(draft);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    const where = first.path.join('.') || '根节点';
    return { ok: false, message: `结构不合法（${where}：${first.message}）` };
  }

  const payload = parsed.data;

  await replaceStructure(questionnaireId, payload);

  // 保存成功后写一条版本快照（结构没变时会跳过）。
  // 「版本历史」要能回答「我上周改坏了，想退回去」—— 只在发布时记版本是不够的：
  // 本项目的状态机里一份问卷只会发布一次，那样抽屉里永远只有一条。
  // 把刚落库的 payload 直接传进去，省掉一次「再读一遍结构」的跨区域往返。
  await writeQuestionnaireVersion({
    questionnaireId,
    label: '保存草稿',
    createdById: user.id,
    payload,
  });

  revalidatePath(`/app/q/${questionnaireId}/edit`);

  return { ok: true };
}
