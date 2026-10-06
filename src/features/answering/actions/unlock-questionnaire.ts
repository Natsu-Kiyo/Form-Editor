'use server';

import { revalidatePath } from 'next/cache';

import { verifyPassword } from '@/lib/auth/password';

import { getAccessPasswordHash } from '../api/public-questionnaire';
import { markUnlocked } from '../lib/unlock';

export type UnlockResult = { ok: true } | { ok: false; message: string };

/**
 * 口令访问的解锁。
 *
 * 口令**只在服务端比对**（bcrypt），比中之后只在浏览器里放一个不可伪造的标记
 * （`lib/unlock.ts`），后续提交凭它放行 —— 口令本身不会被写进任何地方。
 *
 * 已知取舍：这里没有做失败次数限制。它是一个演示项目、口令由发布者自己发给特定人群，
 * 加限流要引入存储与封禁策略；真要上线时这一条必须补（见计划书遗留）。
 */
export async function unlockQuestionnaireAction(
  slug: string,
  password: unknown,
): Promise<UnlockResult> {
  const questionnaire = await getAccessPasswordHash(slug);
  if (!questionnaire) return { ok: false, message: '问卷不存在' };

  // 没设口令的问卷不需要解锁（也避免有人拿它当作「探测接口」）
  if (!questionnaire.accessPasswordHash) return { ok: true };

  const value = typeof password === 'string' ? password : '';
  if (value.length === 0) return { ok: false, message: '请输入访问口令' };

  if (!(await verifyPassword(questionnaire.accessPasswordHash, value))) {
    return { ok: false, message: '口令不正确' };
  }

  await markUnlocked(questionnaire.id, questionnaire.accessPasswordHash);

  revalidatePath(`/s/${slug}`);

  return { ok: true };
}
