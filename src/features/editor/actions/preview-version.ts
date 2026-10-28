'use server';

import { readVersionPreview, type VersionPreviewResult } from '../api/versions';

/**
 * 「预览这一版」—— 按需取一份历史结构。
 *
 * 为什么走 Server Action 而不是直接调数据函数：版本抽屉是客户端组件，
 * 不能 import `server-only` 的模块。而 **action 是公开的 POST 端点**，
 * 所以权限断言必须在数据函数内部再走一遍（`readVersionPreview` 里的 `readQuestionnaireAccess`）。
 */
export async function previewVersionAction(
  questionnaireId: string,
  versionId: string,
): Promise<VersionPreviewResult> {
  return readVersionPreview(questionnaireId, versionId);
}
