import 'server-only';

import { cookies } from 'next/headers';

import { prisma } from '@/lib/db';

import { createToken, hashToken } from './tokens';

/**
 * 会话 Cookie 名。在 `src/proxy.ts` 里也用到，所以两处必须一致 ——
 * proxy 只做「有没有这个 Cookie」的乐观判断，不做数据库校验。
 */
export const SESSION_COOKIE = 'qw_session';

/** 勾选「记住我」30 天，否则 1 天 */
const REMEMBER_ME_DAYS = 30;
const DEFAULT_DAYS = 1;

function cookieOptions(expiresAt: Date) {
  return {
    httpOnly: true,
    // 本地开发是 http，加 Secure 浏览器会丢掉这个 Cookie
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    expires: expiresAt,
  };
}

export async function createSession(
  userId: string,
  options: { rememberMe?: boolean; userAgent?: string } = {},
) {
  const days = options.rememberMe ? REMEMBER_ME_DAYS : DEFAULT_DAYS;
  const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  const { token, tokenHash } = createToken();

  await prisma.session.create({
    data: { userId, tokenHash, expiresAt, userAgent: options.userAgent },
  });

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, cookieOptions(expiresAt));

  return { expiresAt };
}

/** 退出登录：删库里的会话 + 清 Cookie */
export async function destroyCurrentSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  cookieStore.delete(SESSION_COOKIE);

  if (token) {
    await prisma.session.deleteMany({ where: { tokenHash: hashToken(token) } });
  }
}

/** 会话对应的原始令牌（只读取，不校验） */
export async function readSessionToken() {
  const cookieStore = await cookies();
  return cookieStore.get(SESSION_COOKIE)?.value ?? null;
}

/**
 * 作废某个用户的全部会话。
 * 「退出全部设备」用它 —— 调用方随后要把当前 Cookie 也清掉并跳登录页。
 */
export function revokeAllSessions(userId: string) {
  return prisma.session.deleteMany({ where: { userId } });
}

/**
 * 作废该用户**除当前这台以外**的全部会话。
 * 改密码后调用它：别的设备上拿着旧密码的人应该被踢掉，
 * 但用户自己正在操作的这一台不该被自己踢下线。
 */
export async function revokeOtherSessions(userId: string) {
  const token = await readSessionToken();
  const currentHash = token ? hashToken(token) : null;

  return prisma.session.deleteMany({
    where: { userId, ...(currentHash ? { tokenHash: { not: currentHash } } : {}) },
  });
}
