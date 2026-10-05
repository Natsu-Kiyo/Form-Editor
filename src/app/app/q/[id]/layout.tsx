import { notFound } from 'next/navigation';

import { InfoIcon } from '@/components/icons/ui-icons';
import type { EditorReadOnlyReason } from '@/features/editor/api/questionnaires';
import { getEditorQuestionnaire } from '@/features/editor/api/questionnaires';
import { EditorChrome } from '@/features/editor/components/editor-chrome';
import { EditorDraftProvider } from '@/features/editor/components/editor-draft';
import { hasAtLeastRole } from '@/lib/auth/permissions';
import { requireQuestionnaireAccess } from '@/lib/auth/questionnaire-access';

/**
 * 编辑器外壳。
 *
 * **草稿 provider 放在这里**而不是页面里：顶栏（标题输入框、保存按钮、保存状态）
 * 在 layout 里，而改动发生在页面里的画布与属性面板 —— 两者分居组件树的两处，
 * 草稿必须由 layout 提供才能让顶栏看见「有没有未保存的修改」。
 *
 * 只读有**两种互不相同的原因**，界面必须分开说：
 * 没有编辑权限（查看者）→ 换个人就能改；问卷已发布 → 谁都不能改，只能复制为新问卷。
 * 混成一句「不可编辑」会让用户去问一个得不到答案的问题。
 *
 * 高度用 `100dvh` 而不是靠父级撑开：编辑器是三栏各自独立滚动的工作台，
 * 需要一条**被约束住的高度链**；用 `min-h-*` 那种自由高度会让 overflow 失效或裁切内容。
 */
export default async function QuestionnaireEditorLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  // 能看就能进：只读浏览是查看者也该有的能力，写操作才要求 EDITOR
  const [{ role }, editor] = await Promise.all([
    requireQuestionnaireAccess(id, 'VIEWER'),
    getEditorQuestionnaire(id),
  ]);

  if (!editor) notFound();

  const readOnlyReason: EditorReadOnlyReason = !hasAtLeastRole(role, 'EDITOR')
    ? 'NO_PERMISSION'
    : editor.status !== 'DRAFT'
      ? 'FROZEN'
      : null;

  return (
    <EditorDraftProvider
      questionnaireId={editor.id}
      initialTitle={editor.title}
      initialQuestions={editor.questions}
      readOnly={readOnlyReason !== null}
    >
      <div className="flex h-[100dvh] flex-col">
        <EditorChrome readOnlyReason={readOnlyReason} />

        {readOnlyReason ? <ReadOnlyBanner reason={readOnlyReason} /> : null}

        {children}
      </div>
    </EditorDraftProvider>
  );
}

function ReadOnlyBanner({ reason }: { reason: Exclude<EditorReadOnlyReason, null> }) {
  return (
    <div className="flex shrink-0 items-start gap-2 border-b border-amber-200 bg-amber-50 px-6 py-3 text-[12.5px] leading-5 text-amber-800">
      <InfoIcon className="mt-0.5 size-3.5 shrink-0" />
      {reason === 'NO_PERMISSION' ? (
        <span>你在本工作区是查看者，可以浏览题目结构，但没有编辑权限。</span>
      ) : (
        <span>
          这份问卷已发布，题目结构已冻结 ——
          保证历史答卷与统计口径一致。如需调整，请在问卷列表里把它复制为新问卷。
        </span>
      )}
    </div>
  );
}
