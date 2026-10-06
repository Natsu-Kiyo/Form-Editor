import 'server-only';

import { createHash } from 'node:crypto';

import { cookies } from 'next/headers';

/**
 * 「这道题我输过口令了」的记录。
 *
 * 存在 Cookie 里，值是 `sha256(questionnaireId + 口令哈希)` —— **不需要另加一个服务端密钥**：
 * 口令哈希本身只有服务端有，所以这个值伪造不出来；改了口令之后旧 Cookie 也自然失效，
 * 不用去清理任何东西。
 */
const COOKIE_PREFIX = 'qw_unlock_';

/** 口令解锁的有效期。一天足够填完一份问卷，也不至于把口令永久留在浏览器里 */
const UNLOCK_MAX_AGE_SECONDS = 24 * 60 * 60;

export function unlockCookieName(questionnaireId: string) {
  return `${COOKIE_PREFIX}${questionnaireId}`;
}

export function unlockToken(questionnaireId: string, passwordHash: string) {
  return createHash('sha256').update(`${questionnaireId}:${passwordHash}`).digest('hex');
}

export async function isUnlocked(questionnaireId: string, passwordHash: string | null) {
  if (!passwordHash) return false;

  const store = await cookies();

  return (
    store.get(unlockCookieName(questionnaireId))?.value ===
    unlockToken(questionnaireId, passwordHash)
  );
}

export async function markUnlocked(questionnaireId: string, passwordHash: string) {
  const store = await cookies();

  store.set(unlockCookieName(questionnaireId), unlockToken(questionnaireId, passwordHash), {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: UNLOCK_MAX_AGE_SECONDS,
  });
}
