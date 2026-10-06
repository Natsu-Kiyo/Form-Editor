import { z } from 'zod';

import { emailSchema } from '@/utils/validators';

/**
 * 邀请成员。
 *
 * **所有者不在可邀请的角色里**：转让工作区属 2.0，而「邀请一个所有者进来」
 * 会让「工作区只有一个所有者」这条不变量失去意义（`Workspace.ownerId` 也就成了摆设）。
 */
export const inviteMemberSchema = z.object({
  email: emailSchema,
  role: z.enum(['ADMIN', 'EDITOR', 'VIEWER'], { error: '请选择角色' }),
});

export type InviteMemberInput = z.infer<typeof inviteMemberSchema>;

/** 角色变更：同样不接受 OWNER */
export const changeRoleSchema = z.object({
  membershipId: z.string().min(1),
  role: z.enum(['ADMIN', 'EDITOR', 'VIEWER'], { error: '请选择角色' }),
});
