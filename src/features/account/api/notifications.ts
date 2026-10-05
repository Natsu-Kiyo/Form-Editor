import 'server-only';

import { prisma } from '@/lib/db';
import { formatNotificationTime } from '@/utils/format';

/**
 * 传给客户端组件的通知 DTO。
 *
 * 时间**在服务端就格式化成展示文案**（`createdAtLabel`），不是把 ISO 串丢给客户端：
 * 客户端格式化会因服务端（UTC）与浏览器（本地时区）不一致而触发 hydration 报错。
 */
export type NotificationItem = {
  id: string;
  title: string;
  body: string | null;
  linkUrl: string | null;
  read: boolean;
  createdAtLabel: string;
};

export async function getNotifications(userId: string, take = 20): Promise<NotificationItem[]> {
  const rows = await prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take,
    select: {
      id: true,
      title: true,
      body: true,
      linkUrl: true,
      readAt: true,
      createdAt: true,
    },
  });

  const now = new Date();

  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    body: row.body,
    linkUrl: row.linkUrl,
    read: row.readAt !== null,
    createdAtLabel: formatNotificationTime(row.createdAt, now),
  }));
}

export function getUnreadNotificationCount(userId: string) {
  return prisma.notification.count({ where: { userId, readAt: null } });
}

/**
 * 标记单条已读。
 * `userId` 条件不能省 —— 否则传入别人的通知 id 就能改别人的数据。
 */
export function markNotificationRead(userId: string, notificationId: string) {
  return prisma.notification.updateMany({
    where: { id: notificationId, userId },
    data: { readAt: new Date() },
  });
}

export function markAllNotificationsRead(userId: string) {
  return prisma.notification.updateMany({
    where: { userId, readAt: null },
    data: { readAt: new Date() },
  });
}
