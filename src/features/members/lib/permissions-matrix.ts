import { hasAtLeastRole, type Role } from '@/config/constants';

/**
 * 权限矩阵（W09 页尾那张表）。
 *
 * **它同时是 UI 与文档的唯一来源**：表格按它渲染，`docs/VERIFY.md` 的越权走查也按它走。
 * 每一行的来历都写在注释里 —— 这张表会被当成「谁能做什么」的承诺，
 * 不允许出现「表里说不能、代码里其实能」。
 */
export const PERMISSION_MATRIX: { point: string; min: Role; source: string }[] = [
  { point: '创建问卷', min: 'EDITOR', source: '设计稿 W09 矩阵' },
  // 设计稿写的是「仅被分配」，而本项目**没有问卷级分配**（工作区级权限），
  // 所以这里是「编辑者都能改」—— 与代码一致，且写进说明里
  { point: '编辑问卷内容', min: 'EDITOR', source: '设计稿 W09 矩阵（本项目无问卷级分配）' },
  { point: '发布 / 暂停 / 截止', min: 'ADMIN', source: '设计稿 W09 矩阵' },
  { point: '归档 / 恢复问卷', min: 'ADMIN', source: '由「状态变更」一行推得' },
  { point: '删除问卷', min: 'ADMIN', source: '设计稿 W09 矩阵' },
  { point: '查看答卷数据', min: 'VIEWER', source: '设计稿 W09 矩阵' },
  // 设计稿这张表把「导出」写成「查看者 ● / 编辑者 —」，那是 mock 写反了：
  // 把全部原始回答打包带走，不该比「看」更低。按代码口径（要求 EDITOR）写。
  { point: '导出答卷数据', min: 'EDITOR', source: '代码口径（设计稿该行系笔误）' },
  // 模板不是数据（没有答卷挂在上面），所以与「改内容」同档；
  // 官方模板在服务端另有拦（`findEditableTemplate` 里带 workspaceId 条件）
  { point: '重命名 / 删除模板', min: 'EDITOR', source: '与「编辑内容」同档（模板不含数据）' },
  // X2：公开是**对外动作** —— 内容会离开工作区边界、被其他工作区看到并使用，
  // 与「发布 / 归档 / 删除问卷」同档；界面按这一行渲染，action 里再拦一次
  { point: '公开模板到公开池', min: 'ADMIN', source: '由「对外动作」推得（与「发布」同档）' },
  { point: '邀请 / 移除成员', min: 'ADMIN', source: '设计稿 W09 矩阵' },
  { point: '工作区设置 / 解散', min: 'OWNER', source: '设计稿 W09 矩阵' },
];

/** 某个角色在这一行上是否可用（表尾给的是「颜色越深权限越高」的实心点） */
export function canDo(min: Role, role: Role) {
  return hasAtLeastRole(role, min);
}

/** 矩阵里出现的角色列顺序（从高到低，与设计稿一致） */
export const MATRIX_ROLES: Role[] = ['OWNER', 'ADMIN', 'EDITOR', 'VIEWER'];
