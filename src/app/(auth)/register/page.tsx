import type { Metadata } from 'next';

import { RegisterForm } from '@/features/auth/components/register-form';

export const metadata: Metadata = { title: '注册' };

/**
 * `?next=` 从登录页带过来（审查 #8）：被邀请的人没有账号时，登录页会把他导到这里，
 * 注册成功后要回到邀请链接，而不是掉到 `/app`。
 */
export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;

  return <RegisterForm nextPath={next} />;
}
