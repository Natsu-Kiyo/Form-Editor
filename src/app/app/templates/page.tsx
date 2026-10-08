import type { Metadata } from 'next';

import { listOfficialTemplates } from '@/features/questionnaire/api/templates';
import {
  countWorkspaceTemplates,
  listTemplateCards,
  listWorkspaceTemplateCategories,
  TEMPLATE_SCOPE,
  type TemplateScope,
} from '@/features/questionnaire/api/templates';
import { TemplateGallery } from '@/features/questionnaire/components/template-gallery';
import { LEGACY_TEMPLATE_CATEGORY, TEMPLATE_CATEGORIES } from '@/config/constants';
import { requireActiveWorkspace } from '@/lib/auth/active-workspace';
import { hasAtLeastRole } from '@/lib/auth/permissions';

export const metadata: Metadata = { title: '模板中心' };

/**
 * 模板中心（W08 / P07）。
 *
 * Tab、搜索、分类都从 URL 读，并且**一律白名单校验**：Tab 只认 `mine`，
 * 分类只认**这一页实际会渲染出来的那些胶囊** —— 手改一个不存在的分类不该被送进查询，
 * 它会返回空列表，而界面看起来像是「这个分类下真没有模板」。
 *
 * 「分类胶囊列哪些」在两个 Tab 上是**两套口径**：
 * - 官方模板：计划书定下的五个常量（顺序也是它）
 * - 我的模板：**该工作区自建模板实际用过的分类**（含用户自己新建的），
 *   按「常量在前、其余按名称」排。这里不用常量全集 —— 用户没建过「考试测验」模板时，
 *   那颗胶囊点进去必然是空的，看起来像坏了；而这也正是「新增分类」能被筛出来的原因。
 *   早期的 `我的模板` 不列（老数据，只在「全部」里可见）。
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

  // 胶囊清单要先算出来，下面校验 URL 里的分类时用的就是它（两者必须是同一份）
  const mineCategories =
    scope === TEMPLATE_SCOPE.MINE ? await listWorkspaceTemplateCategories(workspace.id) : [];

  const myCategories = mineCategories.filter((item) => item !== LEGACY_TEMPLATE_CATEGORY);
  const knownCategories = TEMPLATE_CATEGORIES as readonly string[];
  const chipCategories =
    scope === TEMPLATE_SCOPE.MINE
      ? [
          ...knownCategories.filter((item) => myCategories.includes(item)),
          ...myCategories.filter((item) => !knownCategories.includes(item)),
        ]
      : [...TEMPLATE_CATEGORIES];

  const category =
    typeof query.category === 'string' && chipCategories.includes(query.category)
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
      categories={chipCategories}
      mineCount={mineCount}
      templates={templates}
      canCreate={hasAtLeastRole(workspace.role, 'EDITOR')}
    />
  );
}
