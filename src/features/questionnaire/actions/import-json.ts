'use server';

import { revalidatePath } from 'next/cache';

import type { FormState } from '@/types/form-state';

import { OPERATION_TYPE } from '@/config/constants';
import { replaceQuestionnaireStructure } from '../api/questionnaires';
import { requireQuestionnaireAccess } from '@/lib/auth/questionnaire-access';
import { writeOperationLog } from '@/lib/operation-log';
import { questionnairePayloadSchema } from '@/lib/questionnaire-structure';

/** 上传文件的体积上限。结构 JSON 几十 KB 足够，超过这个数多半是传错了文件 */
const MAX_FILE_BYTES = 512 * 1024;

/**
 * 导入 JSON：用文件里的结构**替换**当前问卷的题目结构。
 *
 * 语义选择说明：这块菜单项与「导出 JSON」成对出现，导出的是「结构快照」，
 * 那么导入对应的就是「把结构放回来」—— 于是它做的是替换而不是新建
 * （新建有「新建问卷」那条路径，不需要在这里再来一份）。
 *
 * 两条硬约束：**只有草稿能导入**（发布即冻结结构，见 §9.1 第 1 条），
 * 以及解析失败时必须给出**具体到字段**的原因，而不是笼统的「文件格式错误」。
 */
export async function importQuestionnaireJsonAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const questionnaireId = String(formData.get('questionnaireId') ?? '');
  const { user, questionnaire } = await requireQuestionnaireAccess(questionnaireId, 'EDITOR');

  if (questionnaire.status !== 'DRAFT') {
    return { message: '只有草稿状态的问卷可以导入结构；已发布的问卷题目结构是冻结的' };
  }

  const file = formData.get('file');
  if (!(file instanceof File) || file.size === 0) {
    return { message: '请先选择一个 JSON 文件' };
  }
  if (file.size > MAX_FILE_BYTES) {
    return { message: '文件太大，结构 JSON 不应超过 512 KB' };
  }

  let raw: unknown;
  try {
    raw = JSON.parse(await file.text());
  } catch {
    return { message: '这个文件不是合法的 JSON' };
  }

  const parsed = questionnairePayloadSchema.safeParse(raw);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    const path = first.path.join('.') || '根节点';
    return { message: `文件结构与预期不符（${path}：${first.message}）` };
  }

  await replaceQuestionnaireStructure({
    questionnaireId,
    payload: parsed.data,
    title: parsed.data.title.slice(0, 80),
    intro: parsed.data.intro ?? null,
  });

  await writeOperationLog({
    workspaceId: questionnaire.workspaceId,
    actorId: user.id,
    type: OPERATION_TYPE.IMPORT,
    targetType: 'QUESTIONNAIRE',
    targetId: questionnaireId,
    // 用**改之前**的名字：导入可能连标题一起换了，而日志要说的
    // 是「谁在哪份问卷上做了这件事」
    targetName: questionnaire.title,
    detail: { questions: parsed.data.questions.length },
  });

  revalidatePath('/app');
  revalidatePath('/app/logs');
  return { success: `已导入 ${parsed.data.questions.length} 道题` };
}
