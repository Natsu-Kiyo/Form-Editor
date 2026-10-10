'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

import { createSession } from '@/lib/auth/session';
import { createUserWithDefaultWorkspace, getUserByEmail } from '@/lib/auth/users';
import type { FormState } from '@/types/form-state';
import { toFieldErrors } from '@/utils/zod-errors';

import { registerSchema } from '../schemas/credentials';

export async function registerAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = registerSchema.safeParse({
    name: formData.get('name'),
    email: formData.get('email'),
    password: formData.get('password'),
    confirmPassword: formData.get('confirmPassword'),
  });

  // 校验失败与邮箱已存在都要回填：注册表单有四个字段，清空重填的代价最大。
  // **但口令那两栏不回填** —— `values` 会进 action 的响应体与 input 的 value 里，
  // 而浏览器本来就不会清空口令框（完整理由见 `login.ts` 里那段注释）。
  if (!parsed.success) {
    return {
      fieldErrors: toFieldErrors(parsed.error),
      values: {
        name: String(formData.get('name') ?? ''),
        email: String(formData.get('email') ?? ''),
      },
    };
  }

  const existing = await getUserByEmail(parsed.data.email);
  if (existing) {
    // 注册流程里可以直接说「已注册」：用户本来就知道这个邮箱存不存在，
    // 泄露的只是「这个人用过本站」，换来的是一次明确的引导。
    return {
      fieldErrors: { email: ['该邮箱已注册，直接登录即可'] },
      values: {
        name: parsed.data.name,
        email: parsed.data.email,
      },
    };
  }

  const user = await createUserWithDefaultWorkspace(parsed.data);

  // 刚注册完默认记住登录态：这一步本来就是他主动表达的意图
  await createSession(user.id, {
    rememberMe: true,
    userAgent: (await headers()).get('user-agent') ?? undefined,
  });

  redirect('/app');
}
