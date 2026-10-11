'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

import { createSession } from '@/lib/auth/session';
import { createUserWithDefaultWorkspace, getUserByEmail } from '@/lib/auth/users';
import { createRateLimiter } from '@/lib/rate-limit';
import { clientIp } from '@/lib/request-ip';
import type { FormState } from '@/types/form-state';
import { toFieldErrors } from '@/utils/zod-errors';

import { registerSchema } from '../schemas/credentials';

/**
 * 注册的频率预算：**20 次 / 10 分钟**，按来源 IP 计数（与登录 / 解锁 / 提交同一套实现）。
 *
 * 这里挡的不是爆破（注册没有可「猜」的对象），而是**批量注册**与**拿注册当 CPU 放大器**
 * —— 每次提交都要跑一遍 argon2（~34ms）并建 `User` + `Workspace` 两行。
 *
 * 为什么取 20 而不是更严的 5：**E2E 全量一轮会注册约 9 个账号，而且全来自同一个 IP**
 * （members 与 notifications 两个 spec 都要造新账号）。取 5 会把测试自己挡住，
 * 而「因为限流而变红的测试」是最难查的一类假失败。代价说清：20 次 / 10 分钟 ≈ 每 3 秒一次，
 * 挡不住有耐心的脚本，它只是把速率钉在一个明确的数字上。
 */
const REGISTER_LIMIT = 20;
const REGISTER_WINDOW_MS = 10 * 60 * 1000;

const limiter = createRateLimiter({ limit: REGISTER_LIMIT, windowMs: REGISTER_WINDOW_MS });

export async function registerAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = registerSchema.safeParse({
    name: formData.get('name'),
    email: formData.get('email'),
    password: formData.get('password'),
    confirmPassword: formData.get('confirmPassword'),
  });

  // 校验失败与邮箱已存在都要回填：注册表单有四个字段，清空重填的代价最大。
  // **但口令那两栏不回填** —— `values` 会进 action 的响应体与 input 的 value 里，
  // 而浏览器本来就不会清空口令框（完整理由见 `login.ts` 里那段注释）。
  if (!parsed.success) {
    return {
      fieldErrors: toFieldErrors(parsed.error),
      values: {
        name: String(formData.get('name') ?? ''),
        email: String(formData.get('email') ?? ''),
      },
    };
  }

  // 限流放在校验之后、查库与建号之前：格式不合法的提交不该花掉预算，
  // 被挡住的请求也不该再产生一次查询
  const limit = limiter.consume(await clientIp());
  if (!limit.ok) {
    return {
      message: `尝试次数过多，请 ${Math.ceil(limit.retryAfterMs / 60_000)} 分钟后再试`,
      values: { name: parsed.data.name, email: parsed.data.email },
    };
  }

  const existing = await getUserByEmail(parsed.data.email);
  if (existing) {
    // 注册流程里可以直接说「已注册」：用户本来就知道这个邮箱存不存在，
    // 泄露的只是「这个人用过本站」，换来的是一次明确的引导。
    return {
      fieldErrors: { email: ['该邮箱已注册，直接登录即可'] },
      values: {
        name: parsed.data.name,
        email: parsed.data.email,
      },
    };
  }

  const user = await createUserWithDefaultWorkspace(parsed.data);

  // 刚注册完默认记住登录态：这一步本来就是他主动表达的意图
  await createSession(user.id, {
    rememberMe: true,
    userAgent: (await headers()).get('user-agent') ?? undefined,
  });

  redirect('/app');
}
