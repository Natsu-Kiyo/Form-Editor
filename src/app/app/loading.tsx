import { QuestionnaireListSkeleton } from '@/features/questionnaire/components/questionnaire-list-skeleton';

/**
 * `/app` 列表页的等待态（Next 的 `loading.tsx`）。
 *
 * 它在**外壳之内**渲染：侧栏不动（那是 layout，导航时不会重挂），
 * 只有内容区换成骨架 —— 这正是设计稿 L02 里说的「目标页的版式已经有了」。
 *
 * 具体形状见 `questionnaire-list-skeleton.tsx`（L03 那节）。
 */
export default function AppListLoading() {
  return <QuestionnaireListSkeleton />;
}
