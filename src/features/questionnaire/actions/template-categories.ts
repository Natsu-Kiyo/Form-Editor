'use server';

import { TEMPLATE_CATEGORIES, LEGACY_TEMPLATE_CATEGORY } from '@/config/constants';
import { requireActiveWorkspace } from '@/lib/auth/active-workspace';

import { listWorkspaceTemplateCategories } from '../api/templates';

/**
 * 「另存为模板」弹层里分类下拉的选项。
 *
 * 为什么做成 action 而不是从页面一层层传 prop：这个弹层目前挂在**问卷卡片的「⋯」菜单**里，
 * 列表页一屏有几十张卡，把同一份分类数组塞进每张卡的 props 是白费 payload；
 * 而分类是**打开弹层那一刻**才需要的东西，取一次就够。这样也保证了它总是最新的
 * （别的标签页刚建了新分类，这里打开就能选到）。
 *
 * 顺序：**计划书定下的五个在前**（它们是标准分类），用户自建的去重后按名称排在后。
 * 早期的 `我的模板` 不列出来 —— 它是老数据，不是可选值。
 */
export async function getTemplateCategoryOptionsAction(): Promise<string[]> {
  const { workspace } = await requireActiveWorkspace('EDITOR');

  const mine = await listWorkspaceTemplateCategories(workspace.id);
  const extra = mine.filter(
    (category) =>
      category !== LEGACY_TEMPLATE_CATEGORY &&
      !(TEMPLATE_CATEGORIES as readonly string[]).includes(category),
  );

  return [...TEMPLATE_CATEGORIES, ...extra];
}
