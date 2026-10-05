import 'server-only';

import { prisma } from '@/lib/db';

/** 当前仍有效的登录会话数（账号与安全里的「当前 N 台设备登录中」） */
export function countActiveSessions(userId: string) {
  return prisma.session.count({
    where: { userId, expiresAt: { gt: new Date() } },
  });
}
