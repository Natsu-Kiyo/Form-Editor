/**
 * 朴素的固定窗口限流。
 *
 * 用途：**口令解锁的试错次数**（G7）。之前那里没有限制 —— 4 位口令加上无限制重试，
 * 暴力尝试是可执行的。
 *
 * 三条刻意的处理：
 * - **计数器在进程内存里**。这是一个演示部署的取舍，写清楚比假装严密好：
 *   多实例之间不共享，重启即清零。真要上线应换成 Redis / 一张计数表；
 *   接口就是为了换存储而留的（`createRateLimiter` 是工厂，调用方只认 `consume` / `reset`）。
 * - 时间由调用方传入（`now`）而不是内部读时钟：这样规则可以被单测精确钉住。
 * - 不 import 'server-only'：它是纯逻辑，能被 vitest 直接跑（这也正是它能被钉住的前提）。
 */
export type RateLimitResult = { ok: true; remaining: number } | { ok: false; retryAfterMs: number };

type Window = { count: number; resetAt: number };

export type RateLimiter = {
  /** 记一次尝试。返回是否放行，以及还能试几次 / 还要等多久 */
  consume: (key: string, now?: number) => RateLimitResult;
  /** 成功后清掉计数（一次成功不该继续背着之前的失败） */
  reset: (key: string) => void;
  /** 当前在跟踪多少个 key（供测试与排查用） */
  size: () => number;
};

/** 超过这个规模就顺手清掉已过期的窗口，避免长期运行的进程无限攒 key */
const SWEEP_THRESHOLD = 5_000;

export function createRateLimiter({
  limit,
  windowMs,
}: {
  limit: number;
  windowMs: number;
}): RateLimiter {
  const windows = new Map<string, Window>();

  const sweep = (now: number) => {
    if (windows.size < SWEEP_THRESHOLD) return;
    for (const [key, window] of windows) {
      if (window.resetAt <= now) windows.delete(key);
    }
  };

  return {
    consume: (key, now = Date.now()) => {
      const hit = windows.get(key);

      if (!hit || hit.resetAt <= now) {
        sweep(now);
        windows.set(key, { count: 1, resetAt: now + windowMs });
        return { ok: true, remaining: limit - 1 };
      }

      if (hit.count >= limit) {
        return { ok: false, retryAfterMs: hit.resetAt - now };
      }

      hit.count += 1;
      return { ok: true, remaining: limit - hit.count };
    },

    reset: (key) => {
      windows.delete(key);
    },

    size: () => windows.size,
  };
}
