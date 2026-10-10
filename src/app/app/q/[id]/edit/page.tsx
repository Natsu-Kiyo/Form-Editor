import type { Metadata } from 'next';

import { getEditorQuestionnaire } from '@/features/editor/api/questionnaires';
import { listVersions } from '@/features/editor/api/versions';
import { EditorChrome } from '@/features/editor/components/editor-chrome';
import { EditorDraftProvider } from '@/features/editor/components/editor-draft';
import { EditorWorkspace } from '@/features/editor/components/editor-workspace';
import { getPublishPageData } from '@/features/publish/api/publish';
import { PublishSettings } from '@/features/publish/components/publish-settings';
import { hasAtLeastRole } from '@/lib/auth/permissions';
import { requireQuestionnaireAccess } from '@/lib/auth/questionnaire-access';

export const metadata: Metadata = { title: '问卷编辑' };

/**
 * 编辑器（W03 / P08-a,b,c）。
 *
 * 草稿 provider 与顶栏都在**这一页**里：顶栏那个「标题输入框 / 保存状态 / 保存」读写的是草稿，
 * 而草稿只在编辑器里有意义 —— 放到 layout 反而会让发布页也被迫挂一个用不上的草稿。
 */
export default async function EditQuestionnairePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [{ role }, editor, versions, publishData] = await Promise.all([
    requireQuestionnaireAccess(id, 'VIEWER'),
    getEditorQuestionnaire(id),
    listVersions(id),
    // 窄屏的「发布」要开 P08-d 弹层，所以这份数据在这一页就取好（与其它三项并行，不额外加一次往返）
    getPublishPageData(id),
  ]);

  if (!editor) {
    return (
      <div className="p-7">
        <p className="text-ink-500 text-[13px]">这份问卷已经不存在了。</p>
      </div>
    );
  }

  const readOnlyReason = !hasAtLeastRole(role, 'EDITOR')
    ? ('NO_PERMISSION' as const)
    : editor.status !== 'DRAFT'
      ? ('FROZEN' as const)
      : null;

  const canPublish = hasAtLeastRole(role, 'EDITOR');

  return (
    <EditorDraftProvider
      questionnaireId={editor.id}
      initialTitle={editor.title}
      initialQuestions={editor.questions}
      readOnly={readOnlyReason !== null}
    >
      <EditorChrome
        readOnlyReason={readOnlyReason}
        versions={versions}
        // 窄屏的发布弹层在**页面**构造：publish 是另一个 feature，编辑器那一层不跨域引用
        publishSheet={
          publishData ? (
            <PublishSettings data={publishData} canEdit={canPublish} variant="sheet" />
          ) : null
        }
      />
      {readOnlyReason ? <ReadOnlyBanner reason={readOnlyReason} /> : null}
      <EditorWorkspace readOnly={readOnlyReason !== null} />
    </EditorDraftProvider>
  );
}

function ReadOnlyBanner({ reason }: { reason: 'NO_PERMISSION' | 'FROZEN' }) {
  return (
    <div className="flex shrink-0 items-start gap-2 border-b border-amber-200 bg-amber-50 px-6 py-3 text-[12.5px] leading-5 text-amber-800">
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
