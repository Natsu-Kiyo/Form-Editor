import 'server-only';

import { createHash } from 'node:crypto';

import { cookies } from 'next/headers';

/**
 * 「这道问卷我输过口令了」的记录。
 *
 * 存在 Cookie 里，值是 `sha256(questionnaireId + 口令)`；改了口令之后旧 Cookie 自然失效，
 * 不用去清理任何东西。
 *
 * ⚠️ 口令**存的是原文**（R40 起，为了让发起人能再看到它），所以这个值不再依赖
 * 「只有服务端知道口令」这个前提 —— 换句话说：**知道口令的人算得出这个 Cookie**。
 * 这不构成越权（他本来就能用口令正常解锁），但要清楚它**只是一个「省一次输入」的标记**，
 * 不是凭证。真正的拦截在 `unlock-questionnaire.ts` 的比对与试错限流上。
 */
const COOKIE_PREFIX = 'qw_unlock_';

/** 口令解锁的有效期。一天足够填完一份问卷，也不至于把口令永久留在浏览器里 */
const UNLOCK_MAX_AGE_SECONDS = 24 * 60 * 60;

function unlockCookieName(questionnaireId: string) {
  return `${COOKIE_PREFIX}${questionnaireId}`;
}

function unlockToken(questionnaireId: string, accessPassword: string) {
  return createHash('sha256').update(`${questionnaireId}:${accessPassword}`).digest('hex');
}

export async function isUnlocked(questionnaireId: string, accessPassword: string | null) {
  if (!accessPassword) return false;

  const store = await cookies();

  return (
    store.get(unlockCookieName(questionnaireId))?.value ===
    unlockToken(questionnaireId, accessPassword)
  );
}

export async function markUnlocked(questionnaireId: string, accessPassword: string) {
  const store = await cookies();

  store.set(unlockCookieName(questionnaireId), unlockToken(questionnaireId, accessPassword), {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: UNLOCK_MAX_AGE_SECONDS,
  });
}
