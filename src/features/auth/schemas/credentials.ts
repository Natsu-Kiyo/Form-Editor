import { z } from 'zod';

import { emailSchema, newPasswordSchema } from '@/utils/validators';

/**
 * 登录只校验非空 —— 强度规则属于注册与改密码，
 * 拿它去卡老用户会导致「密码设得早的人登不进来」。
 */
export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, { error: '请输入密码' }),
});

export const registerSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, { error: '请输入姓名' })
      .max(32, { error: '姓名不超过 32 个字' }),
    email: emailSchema,
    password: newPasswordSchema,
    confirmPassword: z.string().min(1, { error: '请再次输入密码' }),
  })
  // 两次输入不一致时，错误挂在「确认密码」字段上 —— 用户要改的是它
  .refine((values) => values.password === values.confirmPassword, {
    error: '两次输入的密码不一致',
    path: ['confirmPassword'],
  });
