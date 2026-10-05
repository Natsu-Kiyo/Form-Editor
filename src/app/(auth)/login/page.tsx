import type { Metadata } from 'next';

import { LoginForm } from '@/features/auth/components/login-form';

export const metadata: Metadata = { title: '登录' };

/** `?next=` 由 proxy 在拦下未登录访问时写入，登录成功后回跳 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;

  return <LoginForm nextPath={next} />;
}
