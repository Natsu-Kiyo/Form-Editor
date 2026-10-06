import { describe, expect, it } from 'vitest';

import { createRateLimiter } from '../rate-limit';

/**
 * 限流的规则是**纯逻辑**，所以能被精确钉住 —— 时间由调用方传入，
 * 不需要 `vi.useFakeTimers()` 也不需要 sleep。
 */
describe('createRateLimiter', () => {
  const build = () => createRateLimiter({ limit: 3, windowMs: 60_000 });

  it('窗口内放行 limit 次，并报出还能试几次', () => {
    const limiter = build();

    expect(limiter.consume('a', 0)).toEqual({ ok: true, remaining: 2 });
    expect(limiter.consume('a', 1)).toEqual({ ok: true, remaining: 1 });
    expect(limiter.consume('a', 2)).toEqual({ ok: true, remaining: 0 });
  });

  it('第 limit + 1 次被挡住，并告诉还要等多久', () => {
    const limiter = build();
    limiter.consume('a', 0);
    limiter.consume('a', 1);
    limiter.consume('a', 2);

    const blocked = limiter.consume('a', 3);
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) expect(blocked.retryAfterMs).toBe(60_000 - 3);
  });

  it('窗口一过就重新放行（固定窗口，不是永久封禁）', () => {
    const limiter = build();
    for (let i = 0; i < 4; i += 1) limiter.consume('a', i);

    expect(limiter.consume('a', 60_000).ok).toBe(true);
  });

  it('key 之间互不影响 —— 挡的是「这份问卷 + 这个来源」，不是所有人', () => {
    const limiter = build();
    for (let i = 0; i < 4; i += 1) limiter.consume('a', i);

    expect(limiter.consume('b', 10).ok).toBe(true);
  });

  it('成功之后 reset 会清掉计数：不该继续背着之前的失败', () => {
    const limiter = build();
    limiter.consume('a', 0);
    limiter.consume('a', 1);
    limiter.reset('a');

    expect(limiter.consume('a', 2)).toEqual({ ok: true, remaining: 2 });
    expect(limiter.size()).toBe(1);
  });
});
