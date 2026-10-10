import { hasAtLeastRole, type Role } from '@/config/constants';

/**
 * 权限矩阵（W09 页尾那张表）。
 *
 * **它同时是 UI 与文档的唯一来源**：表格按它渲染，`docs/VERIFY.md` 的越权走查也按它走。
 * 这张表会被当成「谁能做什么」的承诺，不允许出现「表里说不能、代码里其实能」。
 *
 * **每一行的来历写在注释里，不渲染到界面上**（R81 删掉了原先跟在权限点后面的
 * 浅色小字 —— 那是给对着代码的人看的线索，摆在界面上只是噪音）。来历分三种：
 * - **不标注的行** = 照设计稿 W09 那张矩阵；
 * - **「推得」的行** = 设计稿没画到、由相邻行补出来的；
 * - **「代码口径」的行** = 设计稿写反了、以代码为准的。
 */
export const PERMISSION_MATRIX: { point: string; min: Role }[] = [
  { point: '创建问卷', min: 'EDITOR' },
  // 设计稿写的是「仅被分配」，而本项目**没有问卷级分配**（工作区级权限），
  // 所以这里是「编辑者都能改」—— 与代码一致
  { point: '编辑问卷内容', min: 'EDITOR' },
  { point: '发布 / 暂停 / 截止', min: 'ADMIN' },
  // 设计稿矩阵里没有这一行，由上一行（状态变更）推得 —— 归档也是一种状态变更
  { point: '归档 / 恢复问卷', min: 'ADMIN' },
  { point: '删除问卷', min: 'ADMIN' },
  { point: '查看答卷数据', min: 'VIEWER' },
  // 设计稿该行是笔误（写成「查看者 ● / 编辑者 —」）：把全部原始回答打包带走，
  // 不该比「看」更低。按代码口径（要求 EDITOR）写
  { point: '导出答卷数据', min: 'EDITOR' },
  // 设计稿没有这一行：模板不是数据（没有答卷挂在上面），与「改内容」同档；
  // 官方模板在服务端另有拦（`findEditableTemplate` 里带 workspaceId 条件）
  { point: '重命名 / 删除模板', min: 'EDITOR' },
  // X2 新增（设计稿没有）：公开是**对外动作** —— 内容会离开工作区边界、
  // 被其他工作区看到并使用，与「发布 / 归档 / 删除问卷」同档；action 里再拦一次
  { point: '公开模板到公开池', min: 'ADMIN' },
  { point: '邀请 / 移除成员', min: 'ADMIN' },
  { point: '工作区设置 / 解散', min: 'OWNER' },
];

/** 某个角色在这一行上是否可用（表尾给的是「颜色越深权限越高」的实心点） */
export function canDo(min: Role, role: Role) {
  return hasAtLeastRole(role, min);
}

/** 矩阵里出现的角色列顺序（从高到低，与设计稿一致） */
export const MATRIX_ROLES: Role[] = ['OWNER', 'ADMIN', 'EDITOR', 'VIEWER'];
