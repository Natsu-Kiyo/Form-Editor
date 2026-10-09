import type { Metadata } from 'next';

import {
  countWorkspaceTemplates,
  hasOtherPublicTemplates,
  listFavoriteTemplates,
  listTemplateCards,
  listWorkspaceTemplateCategories,
  TEMPLATE_SCOPE,
  type TemplateScope,
} from '@/features/questionnaire/api/templates';
import { TemplateGallery } from '@/features/questionnaire/components/template-gallery';
import {
  LEGACY_TEMPLATE_CATEGORY,
  TEMPLATE_CATEGORIES,
  TEMPLATE_PUBLIC_CATEGORIES,
} from '@/config/constants';
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
 * - 公开模板（X2 起取代原来的「官方模板」Tab）：计划书定下的五个常量 + **「其他」**
 *   （官方五类之外的公开模板归到这里；它**有内容才出现**，避免空胶囊）——
 *   公开门槛要求分类必须在这六个里，所以点每一颗胶囊都必然有内容可筛；
 * - 我的模板：**该工作区自建模板实际用过的分类**（含用户自己新建的），
 *   按「常量在前、其余按名称」排。这里不用常量全集 —— 用户没建过「考试测验」模板时，
 *   那颗胶囊点进去必然是空的，看起来像坏了；而这也正是「新增分类」能被筛出来的原因。
 *   早期的 `我的模板` 不列（老数据，只在「全部」里可见）。
 *
 * 权限按权限矩阵下传两档（与列表页同一条规矩）：
 * 「使用此模板 / ⋯」= EDITOR；「设为公开 / 取消公开」= ADMIN。
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

  const scope: TemplateScope = query.tab === 'mine' ? TEMPLATE_SCOPE.MINE : TEMPLATE_SCOPE.PUBLIC;
  const keyword = typeof query.q === 'string' ? query.q.trim().slice(0, 60) : '';

  // 胶囊清单要先算出来，下面校验 URL 里的分类时用的就是它（两者必须是同一份）
  const mineCategories =
    scope === TEMPLATE_SCOPE.MINE ? await listWorkspaceTemplateCategories(workspace.id) : [];

  /*
   * 公开池的分类胶囊 = 官方五类 + **有内容时才出现的「其他」**（兜底分类）。
   * 「其他」不随官方五类常驻：它没有官方模板，空着的时候点进去什么都没有，
   * 看起来像坏了 —— 由 `hasOtherPublicTemplates` 决定它的去留。
   * （「我的模板」那边的胶囊本来就是「实际用过的分类」，不受影响。）
   */
  const showOther = scope === TEMPLATE_SCOPE.PUBLIC ? await hasOtherPublicTemplates() : false;

  const myCategories = mineCategories.filter((item) => item !== LEGACY_TEMPLATE_CATEGORY);
  const knownCategories = TEMPLATE_CATEGORIES as readonly string[];
  const chipCategories =
    scope === TEMPLATE_SCOPE.MINE
      ? [
          ...knownCategories.filter((item) => myCategories.includes(item)),
          ...myCategories.filter((item) => !knownCategories.includes(item)),
        ]
      : showOther
        ? [...TEMPLATE_PUBLIC_CATEGORIES]
        : [...TEMPLATE_CATEGORIES];

  const category =
    typeof query.category === 'string' && chipCategories.includes(query.category)
      ? query.category
      : null;

  const [items, mineCount, favoriteItems] = await Promise.all([
    listTemplateCards(workspace.id, { scope, keyword, category }),
    countWorkspaceTemplates(workspace.id),
    // 收藏分组只在「我的模板」Tab 渲染；公开池那侧不查（省一次往返）
    scope === TEMPLATE_SCOPE.MINE ? listFavoriteTemplates(workspace.id) : Promise.resolve([]),
  ]);

  return (
    <TemplateGallery
      items={items}
      scope={scope}
      keyword={keyword}
      category={category}
      categories={chipCategories}
      mineCount={mineCount}
      canCreate={hasAtLeastRole(workspace.role, 'EDITOR')}
      canPublish={hasAtLeastRole(workspace.role, 'ADMIN')}
      favoriteItems={favoriteItems}
    />
  );
}
