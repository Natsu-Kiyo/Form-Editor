'use server';

import { revalidatePath } from 'next/cache';

import { requireUser } from '@/lib/auth/dal';
import { verifyPassword } from '@/lib/auth/password';
import { revokeOtherSessions } from '@/lib/auth/session';
import { getUserPasswordHash, updateUserPassword, updateUserName } from '@/lib/auth/users';
import type { FormState } from '@/types/form-state';
import { toFieldErrors } from '@/utils/zod-errors';

import { changePasswordSchema, updateProfileSchema } from '../schemas';

export async function updateProfileAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser();

  const parsed = updateProfileSchema.safeParse({ name: formData.get('name') });

  if (!parsed.success) {
    return {
      fieldErrors: toFieldErrors(parsed.error),
      values: { name: String(formData.get('name') ?? '') },
    };
  }

  await updateUserName(user.id, parsed.data.name);
  revalidatePath('/app', 'layout');

  return { success: '已保存' };
}

export async function changePasswordAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser();

  const parsed = changePasswordSchema.safeParse({
    currentPassword: formData.get('currentPassword'),
    newPassword: formData.get('newPassword'),
  });

  if (!parsed.success) {
    return { fieldErrors: toFieldErrors(parsed.error) };
  }

  // 必须校验当前密码：会话被劫持时，光有有效 Cookie 不足以改掉密码
  const passwordHash = await getUserPasswordHash(user.id);
  if (!passwordHash || !(await verifyPassword(passwordHash, parsed.data.currentPassword))) {
    return {
      fieldErrors: { currentPassword: ['当前密码不正确'] },
    };
  }

  await updateUserPassword(user.id, parsed.data.newPassword);
  // 踢掉其它设备，但保留当前这台 —— 用户不该把自己踢下线
  await revokeOtherSessions(user.id);
  revalidatePath('/app', 'layout');

  return { success: '密码已更新，其它设备需要重新登录' };
}
