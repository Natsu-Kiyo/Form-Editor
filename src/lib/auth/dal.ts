import 'server-only';

import { redirect } from 'next/navigation';
import { cache } from 'react';

import { prisma } from '@/lib/db';

import { readSessionToken } from './session';
import { hashToken } from './tokens';

/** 传给界面层的用户信息 —— 只带必要字段，绝不带 passwordHash */
export type SessionUser = {
  id: string;
  email: string;
  name: string;
};

/**
 * 当前登录用户（未登录返回 null）。
 *
 * 这是**唯一**的会话校验入口：所有需要登录的数据函数都必须先过它。
 * 用 React 的 `cache` 包一层 —— 同一次渲染里 layout、page、多个组件都调用时
 * 只会查一次数据库。
 *
 * ⚠️ 不要在 layout 里依赖它做访问控制。Next 16 文档
 * （guides/authentication → "Layouts and auth checks"）明确说明：layout 在导航时
 * 不会重渲染，也不阻止子段渲染，所以「在 layout 里 return null」拦不住任何人。
 * **安全边界必须落在每个数据函数内部。**
 */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const token = await readSessionToken();
  if (!token) return null;

  const tokenHash = hashToken(token);

  const session = await prisma.session.findUnique({
    where: { tokenHash },
    select: {
      expiresAt: true,
      user: { select: { id: true, email: true, name: true } },
    },
  });

  if (!session) return null;

  if (session.expiresAt.getTime() <= Date.now()) {
    // 顺手清掉过期会话，避免死记录堆积
    await prisma.session.deleteMany({ where: { tokenHash } });
    return null;
  }

  return session.user;
});

/**
 * 需要登录时用它：未登录直接跳登录页。
 * 返回非空用户，调用方不必再判空。
 */
export const requireUser = cache(async (): Promise<SessionUser> => {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/login');
  }
  return user;
});
