import { describe, expect, it } from 'vitest';

import { TEMPLATE_CATEGORY_NEW } from '@/config/constants';

import { saveAsTemplateSchema } from '../schemas';

/**
 * 另存为模板的表单校验。
 *
 * 分类有两个来源（现有分类 / 新增分类），schema 管的是**形状**：
 * 选没选、新名字给没给、有多长。
 * 「新分类名是否与现有分类重名」**不在这里判** —— 完整清单（常量 + 本工作区已有的）
 * 只有服务端查得到，那一半在 `actions/save-as-template.ts` 里。
 */
describe('saveAsTemplateSchema', () => {
  const base = { title: '社团招新报名', description: '' };

  it('选了现有分类：通过', () => {
    const parsed = saveAsTemplateSchema.safeParse({ ...base, category: '报名登记' });

    expect(parsed.success).toBe(true);
  });

  it('没选分类：报在 category 上，提示去选一个', () => {
    const parsed = saveAsTemplateSchema.safeParse({ ...base, category: '   ' });

    expect(parsed.success).toBe(false);
    expect(parsed.error?.issues[0]?.path).toEqual(['category']);
    expect(parsed.error?.issues[0]?.message).toContain('请选择模板分类');
  });

  it('选了「新增分类」但名字为空：报在 newCategory 上', () => {
    const parsed = saveAsTemplateSchema.safeParse({
      ...base,
      category: TEMPLATE_CATEGORY_NEW,
      newCategory: '   ',
    });

    expect(parsed.success).toBe(false);
    expect(parsed.error?.issues[0]?.path).toEqual(['newCategory']);
    expect(parsed.error?.issues[0]?.message).toContain('请输入新的分类名称');
  });

  it('新增分类名超过 20 个字：拦下', () => {
    const parsed = saveAsTemplateSchema.safeParse({
      ...base,
      category: TEMPLATE_CATEGORY_NEW,
      newCategory: '一'.repeat(21),
    });

    expect(parsed.success).toBe(false);
    expect(parsed.error?.issues[0]?.path).toEqual(['newCategory']);
  });

  it('新增分类名合法：通过（重名与否交给服务端）', () => {
    const parsed = saveAsTemplateSchema.safeParse({
      ...base,
      category: TEMPLATE_CATEGORY_NEW,
      newCategory: '面试评估',
    });

    expect(parsed.success).toBe(true);
  });

  it('模板名超长仍然拦得住（原有规则没被分类改动破坏）', () => {
    const parsed = saveAsTemplateSchema.safeParse({
      ...base,
      title: '一'.repeat(61),
      category: '报名登记',
    });

    expect(parsed.success).toBe(false);
    expect(parsed.error?.issues[0]?.path).toEqual(['title']);
  });
});
