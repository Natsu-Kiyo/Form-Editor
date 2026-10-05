'use server';

import { revalidatePath } from 'next/cache';

import { requireUser } from '@/lib/auth/dal';

import { markAllNotificationsRead, markNotificationRead } from '../api/notifications';

export async function markNotificationReadAction(notificationId: string) {
  const user = await requireUser();
  await markNotificationRead(user.id, notificationId);
  revalidatePath('/app', 'layout');
}

export async function markAllNotificationsReadAction() {
  const user = await requireUser();
  await markAllNotificationsRead(user.id);
  revalidatePath('/app', 'layout');
}
