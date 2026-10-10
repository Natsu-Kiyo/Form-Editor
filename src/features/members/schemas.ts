import { z } from 'zod';

import { emailSchema } from '@/utils/validators';

/**
 * 邀请成员。
 *
 * **所有者不在可邀请的角色里**：工作区只有**一个**所有者（转让在自己那一行的
 * 角色下拉里做，见 R76），「邀请一个所有者进来」会让这条不变量失去意义
 * （`Workspace.ownerId` 也就成了摆设）。
 */
export const inviteMemberSchema = z.object({
  email: emailSchema,
  role: z.enum(['ADMIN', 'EDITOR', 'VIEWER'], { error: '请选择角色' }),
});

export type InviteMemberInput = z.infer<typeof inviteMemberSchema>;

/** 角色变更：同样不接受 OWNER（升为所有者只有转让一条路） */
export const changeRoleSchema = z.object({
  membershipId: z.string().min(1),
  role: z.enum(['ADMIN', 'EDITOR', 'VIEWER'], { error: '请选择角色' }),
});

/**
 * 转让所有权（R76）。
 *
 * 两件事一起提交：**谁继承**（`nextOwnerUserId`）与**发起人降级成什么**
 * （`selfRole`，就是他在角色下拉里选的哪一档）—— 它俩必须落在同一个事务里，
 * 否则会出现「没有所有者的工作区」这种中间态。
 */
export const transferOwnershipSchema = z.object({
  nextOwnerUserId: z.string().min(1, { error: '请选择继承所有者的成员' }),
  selfRole: z.enum(['ADMIN', 'EDITOR', 'VIEWER'], { error: '请选择角色' }),
});

export type TransferOwnershipInput = z.infer<typeof transferOwnershipSchema>;
