'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

import { verifyPassword } from '@/lib/auth/password';
import { createSession } from '@/lib/auth/session';
import { getUserByEmail } from '@/lib/auth/users';
import type { FormState } from '@/types/form-state';
import { toFieldErrors } from '@/utils/zod-errors';

import { loginSchema } from '../schemas/credentials';

/** 只接受站内相对路径，避免被构造成开放重定向 */
function safeNextPath(value: FormDataEntryValue | null) {
  if (typeof value !== 'string') return '/app';
  if (!value.startsWith('/') || value.startsWith('//')) return '/app';
  return value;
}

export async function loginAction(_prevState: FormState, formData: FormData): Promise<FormState> {
  const parsed = loginSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  });

  if (!parsed.success) {
    return {
      fieldErrors: toFieldErrors(parsed.error),
      values: { email: String(formData.get('email') ?? '') },
    };
  }

  const user = await getUserByEmail(parsed.data.email);

  // 「邮箱不存在」与「密码错误」返回同一句提示 —— 否则这个接口可以用来枚举账号
  if (!user || !(await verifyPassword(user.passwordHash, parsed.data.password))) {
    return {
      message: '邮箱或密码不正确',
      // 原样回填：用户只需改错的那一处，不必重填整张表单
      values: { email: parsed.data.email, password: parsed.data.password },
    };
  }

  await createSession(user.id, {
    rememberMe: formData.get('rememberMe') === 'on',
    userAgent: (await headers()).get('user-agent') ?? undefined,
  });

  redirect(safeNextPath(formData.get('next')));
}
