'use server';

import { redirect } from 'next/navigation';

import { requireUser } from '@/lib/auth/dal';
import { destroyCurrentSession, revokeAllSessions } from '@/lib/auth/session';

/**
 * 退出全部设备。
 *
 * 语义就是「把这张账号上的所有登录态清掉」，包括当前这台 ——
 * 所以先删光会话，再清掉本地 Cookie 并跳登录页。
 * 常用场景是「怀疑账号被盗」。
 */
export async function signOutAllDevicesAction() {
  const user = await requireUser();

  await revokeAllSessions(user.id);
  await destroyCurrentSession();

  redirect('/login');
}
