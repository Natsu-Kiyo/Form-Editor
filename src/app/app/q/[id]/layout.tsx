import { notFound } from 'next/navigation';

import { QuestionnaireTabs } from '@/components/layout/questionnaire-tabs';
import { getEditorQuestionnaire } from '@/features/editor/api/questionnaires';
import { requireQuestionnaireAccess } from '@/lib/auth/questionnaire-access';

/**
 * 问卷内的外壳。
 *
 * 只放**各 Tab 共有**的东西（这里是切换条），顶栏交给各页面自己渲染：
 * 顶栏右侧每个 Tab 都不一样（编辑器是保存状态 + 保存 + 发布，发布页是保存并发布，
 * 分享页是状态徽章 + 暂停/截止），硬塞进 layout 就要引入一层插槽机制，
 * 而那一层机制换来的只是少写一个共用组件 —— 不值。
 *
 * 高度用 `100dvh` 而不是靠父级撑开：编辑器是三栏各自独立滚动的工作台，
 * 需要一条**被约束住的高度链**；用 `min-h-*` 那种自由高度会让 overflow 失效或裁切内容。
 */
export default async function QuestionnaireLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  // 能看就能进：只读浏览是查看者也该有的能力，写操作才要求 EDITOR
  const [{}, editor] = await Promise.all([
    requireQuestionnaireAccess(id, 'VIEWER'),
    getEditorQuestionnaire(id),
  ]);

  if (!editor) notFound();

  return (
    <div className="flex h-[100dvh] flex-col">
      <QuestionnaireTabs questionnaireId={id} />
      {children}
    </div>
  );
}
