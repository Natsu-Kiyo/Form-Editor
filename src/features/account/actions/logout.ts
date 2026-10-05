'use server';

import { redirect } from 'next/navigation';

import { destroyCurrentSession } from '@/lib/auth/session';

/**
 * 退出登录。
 *
 * 放在 account 而不是 auth feature：auth 负责「进入」（登录 / 注册 / 会话），
 * 退出登录的入口在账号菜单里，由 account 这个域拥有更顺
 * （也避免 account 反过来去导入 auth —— features 之间禁止互相导入）。
 */
export async function logoutAction() {
  await destroyCurrentSession();
  redirect('/login');
}
