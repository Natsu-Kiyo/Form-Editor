import type { Metadata } from 'next';

import { listOfficialTemplates } from '@/features/questionnaire/api/templates';
import {
  countWorkspaceTemplates,
  listTemplateCards,
  TEMPLATE_SCOPE,
  type TemplateScope,
} from '@/features/questionnaire/api/templates';
import { TemplateGallery } from '@/features/questionnaire/components/template-gallery';
import { TEMPLATE_CATEGORIES } from '@/config/constants';
import { requireActiveWorkspace } from '@/lib/auth/active-workspace';
import { hasAtLeastRole } from '@/lib/auth/permissions';

export const metadata: Metadata = { title: '模板中心' };

/**
 * 模板中心（W08 / P07）。
 *
 * Tab、搜索、分类都从 URL 读，并且**一律白名单校验**：Tab 只认 `mine`，
 * 分类只认计划书定下的那五个 —— 手改一个不存在的分类不该被送进查询，
 * 它会返回空列表，而界面看起来像是「这个分类下真没有模板」。
 *
 * 「新建问卷」与「使用此模板」都要求 EDITOR（矩阵里「创建问卷」= 编辑者）：
 * 查看者能浏览、能预览，但没有创建入口。
 */
export default async function TemplatesPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; q?: string; category?: string }>;
}) {
  const [{ workspace }, query] = await Promise.all([
    requireActiveWorkspace('VIEWER'),
    searchParams,
  ]);

  const scope: TemplateScope = query.tab === 'mine' ? TEMPLATE_SCOPE.MINE : TEMPLATE_SCOPE.OFFICIAL;
  const keyword = typeof query.q === 'string' ? query.q.trim().slice(0, 60) : '';
  const category =
    typeof query.category === 'string' &&
    (TEMPLATE_CATEGORIES as readonly string[]).includes(query.category)
      ? query.category
      : null;

  const [items, mineCount, templates] = await Promise.all([
    listTemplateCards(workspace.id, { scope, keyword, category }),
    countWorkspaceTemplates(workspace.id),
    listOfficialTemplates(),
  ]);

  return (
    <TemplateGallery
      items={items}
      scope={scope}
      keyword={keyword}
      category={category}
      mineCount={mineCount}
      templates={templates}
      canCreate={hasAtLeastRole(workspace.role, 'EDITOR')}
    />
  );
}
