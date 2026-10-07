'use server';

import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';

import { createRateLimiter } from '@/lib/rate-limit';

import { getAccessPassword } from '../api/public-questionnaire';
import { verifyAccessCode } from '../lib/access-code';
import { markUnlocked } from '../lib/unlock';

export type UnlockResult = { ok: true } | { ok: false; message: string };

/**
 * 试错限流（G7）。
 *
 * **10 分钟内同一份问卷 + 同一个来源最多试 5 次**。4 位口令配上无限制重试是可被暴力破解的，
 * 这里把「可重试次数」压到不足以穷举；成功后立刻清零（一次成功不该继续背着之前的失败）。
 *
 * 存储取舍写在 `lib/rate-limit.ts`：计数在**进程内存**里，多实例不共享、重启即清零。
 * 演示部署够用，真要上线换 Redis / 计数表 —— 换的时候只改那一处。
 */
const UNLOCK_LIMIT = 5;
const UNLOCK_WINDOW_MS = 10 * 60 * 1000;

const limiter = createRateLimiter({ limit: UNLOCK_LIMIT, windowMs: UNLOCK_WINDOW_MS });

/** 来源标识：优先取代理链里的第一跳，取不到就退化成 'unknown'（这时限流是按全站算的） */
async function clientKey() {
  const store = await headers();
  const forwarded = store.get('x-forwarded-for')?.split(',')[0]?.trim();

  return forwarded || store.get('x-real-ip') || 'unknown';
}

/**
 * 口令访问的解锁。
 *
 * 口令**只在服务端比对**（等时比较，见 `lib/access-code.ts`），比中之后只在浏览器里
 * 放一个「已解锁」的标记（`lib/unlock.ts`）。
 */
export async function unlockQuestionnaireAction(
  slug: string,
  password: unknown,
): Promise<UnlockResult> {
  const questionnaire = await getAccessPassword(slug);
  if (!questionnaire) return { ok: false, message: '问卷不存在' };

  // 非口令模式的问卷不需要解锁（也避免有人拿它当作「探测接口」）
  if (questionnaire.identityMode !== 'PASSWORD') return { ok: true };

  /*
   * 口令模式、但库里没有口令：迁移之后会出现的一种状态。
   *
   * **不能放行** —— 放行等于把一份「设了口令却丢了口令」的问卷公开出去。
   * 拦住它，发起人在设置页会看到发布前检查的报错，重设一个口令即可。
   */
  if (!questionnaire.accessPassword) {
    return { ok: false, message: '这份问卷的口令还没设置好，请联系发起人' };
  }

  // 口令前后可能有粘贴带进来的空格，先 trim（库里那份也是 trim 过的）
  const value = typeof password === 'string' ? password.trim() : '';
  if (value.length === 0) return { ok: false, message: '请输入访问口令' };

  const key = `${questionnaire.id}:${await clientKey()}`;
  const gate = limiter.consume(key);

  if (!gate.ok) {
    // 说清「还要等多久」，而不是笼统的「操作过于频繁」—— 后者会让人反复重试
    const minutes = Math.max(1, Math.ceil(gate.retryAfterMs / 60_000));

    return { ok: false, message: `试错次数过多，请 ${minutes} 分钟后再试` };
  }

  if (!verifyAccessCode(questionnaire.accessPassword, value)) {
    return {
      ok: false,
      message: gate.remaining > 0 ? `口令不正确，还可试 ${gate.remaining} 次` : '口令不正确',
    };
  }

  // 成功即清零：之前那几次失败翻篇
  limiter.reset(key);

  await markUnlocked(questionnaire.id, questionnaire.accessPassword);

  revalidatePath(`/s/${slug}`);

  return { ok: true };
}
