import { z } from 'zod';

import { newPasswordSchema } from '@/utils/validators';

export const updateProfileSchema = z.object({
  name: z.string().trim().min(1, { error: '请输入姓名' }).max(32, { error: '姓名不超过 32 个字' }),
});

/**
 * 改密码。
 *
 * 强度规则与注册**共用同一份** `newPasswordSchema` ——
 * 否则很容易出现「注册要求 8 位、改密码只要求 6 位」这种不一致。
 */
export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, { error: '请输入当前密码' }),
  newPassword: newPasswordSchema,
});

export const feedbackSchema = z.object({
  content: z
    .string()
    .trim()
    .min(5, { error: '请至少写 5 个字，方便我们定位问题' })
    .max(1000, { error: '不超过 1000 个字' }),
});
