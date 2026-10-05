import type { Metadata } from 'next';

import { getEditorQuestionnaire } from '@/features/editor/api/questionnaires';
import { EditorWorkspace } from '@/features/editor/components/editor-workspace';
import { hasAtLeastRole } from '@/lib/auth/permissions';
import { requireQuestionnaireAccess } from '@/lib/auth/questionnaire-access';

export const metadata: Metadata = { title: '问卷编辑' };

/**
 * 编辑器画布（W03 / P08-a,b,c）。
 *
 * 草稿由 layout 里的 `EditorDraftProvider` 提供（顶栏要看见「有没有未保存的修改」），
 * 这里只负责把数据读出来、算出只读态。
 */
export default async function EditQuestionnairePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [{ role }, editor] = await Promise.all([
    requireQuestionnaireAccess(id, 'VIEWER'),
    getEditorQuestionnaire(id),
  ]);

  if (!editor) {
    return (
      <div className="p-7">
        <p className="text-ink-500 text-[13px]">这份问卷已经不存在了。</p>
      </div>
    );
  }

  const readOnly = !hasAtLeastRole(role, 'EDITOR') || editor.status !== 'DRAFT';

  return <EditorWorkspace readOnly={readOnly} />;
}
