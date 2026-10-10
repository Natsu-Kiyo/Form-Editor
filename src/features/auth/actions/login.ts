'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

import { verifyPassword } from '@/lib/auth/password';
import { createSession } from '@/lib/auth/session';
import { getUserByEmail } from '@/lib/auth/users';
import { createRateLimiter } from '@/lib/rate-limit';
import type { FormState } from '@/types/form-state';
import { toFieldErrors } from '@/utils/zod-errors';

import { loginSchema } from '../schemas/credentials';

/**
 * 登录的试错预算：**10 次 / 10 分钟**，按「邮箱 + 来源 IP」计数，成功即清零。
 *
 * 与 `unlock-questionnaire.ts`（口令解锁）同一个套路，只是目标换成账号 ——
 * 拿到账号等于拿到整个工作区，比 4 位口令更值得挡。存储取舍见 `lib/rate-limit.ts`
 *（进程内存、多实例不共享、重启即清零，演示部署够用）。
 */
const LOGIN_LIMIT = 10;
const LOGIN_WINDOW_MS = 10 * 60 * 1000;

const limiter = createRateLimiter({ limit: LOGIN_LIMIT, windowMs: LOGIN_WINDOW_MS });

/**
 * 邮箱不存在时用它「陪跑」一次校验（用法见下面）。
 *
 * 它是一个随机串的 argon2id 哈希：**反推不出原文**，也不会被任何人当成口令接受，
 * 唯一用途是让「邮箱不存在」与「口令错」这两条路径花掉同样多的时间。
 */
const DUMMY_HASH =
  '$argon2id$v=19$m=19456,t=2,p=1$HEHQVqFgYEvErODnekBtmQ$ezWrnnt/SEHAAFX86pUZAbVEUPU/9R2YRNEbAr4m3tA';

/** 来源标识：优先取代理链里的第一跳，取不到就退化成 'unknown'（这时限流按全站算） */
async function clientKey() {
  const store = await headers();
  const forwarded = store.get('x-forwarded-for')?.split(',')[0]?.trim();

  return forwarded || store.get('x-real-ip') || 'unknown';
}

/** 只接受站内相对路径，避免被构造成开放重定向 */
function safeNextPath(value: FormDataEntryValue | null) {
  if (typeof value !== 'string') return '/app';
  if (!value.startsWith('/') || value.startsWith('//')) return '/app';
  return value;
}

export async function loginAction(_prevState: FormState, formData: FormData): Promise<FormState> {
  const parsed = loginSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  });

  if (!parsed.success) {
    return {
      fieldErrors: toFieldErrors(parsed.error),
      values: { email: String(formData.get('email') ?? '') },
    };
  }

  // 限流放在校验之后、查库之前：格式不合法的提交不该花掉真实的试错预算
  const key = `${parsed.data.email.toLowerCase()}:${await clientKey()}`;
  const limit = limiter.consume(key);
  if (!limit.ok) {
    return {
      message: `尝试次数过多，请 ${Math.ceil(limit.retryAfterMs / 60_000)} 分钟后再试`,
      values: { email: parsed.data.email },
    };
  }

  const user = await getUserByEmail(parsed.data.email);

  /*
   * 「邮箱不存在」与「密码错误」返回**同一句提示** —— 否则这个接口可以用来枚举账号。
   *
   * 只说同一句话还不够：`||` 短路会让「邮箱不存在」跳过 argon2（这条路径上最慢的一步），
   * 于是响应时间的差异本身就泄露了答案。所以邮箱不存在时让 `DUMMY_HASH` 陪跑一次校验，
   * 两条路径的耗时才是真的不可区分。
   */
  const passwordOk = await verifyPassword(user?.passwordHash ?? DUMMY_HASH, parsed.data.password);

  if (!user || !passwordOk) {
    return {
      message: '邮箱或密码不正确',
      /*
       * **只回填邮箱**：`values` 会被序列化进 action 的响应体、落到 React 状态与 input
       * 的 value 里，而登录失败时浏览器本来就不会清空口令框 —— 回填换不来任何体验收益，
       * 代价却是把明文口令推到好几个不该出现的地方（响应体、页面源码、前端错误上报）。
       * 需要「少填一次」的话，让口令框保持焦点就够了，不必回填值。
       */
      values: { email: parsed.data.email },
    };
  }

  // 一次成功不该继续背着之前的失败计数
  limiter.reset(key);

  await createSession(user.id, {
    rememberMe: formData.get('rememberMe') === 'on',
    userAgent: (await headers()).get('user-agent') ?? undefined,
  });

  redirect(safeNextPath(formData.get('next')));
}
