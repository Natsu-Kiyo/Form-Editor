'use client';

import { ErrorCard } from '@/components/layout/error-card';

/**
 * 全站错误边界。
 *
 * 为什么需要它：这个项目里有几类失败是**抛**出来的 —— 权限断言（`requireActiveWorkspace`
 * 的 `NO_WORKSPACE` / `FORBIDDEN`、`requireQuestionnaireAccess` 的 `NOT_FOUND`）
 * 与「本来就不该发生」的服务端异常。它们不该被伪装成业务提示，但也不该让用户看到
 * Next 的默认错误页（白底英文 + 一串 digest），那看起来像站点坏了。
 *
 * 业务上**预期得到**的失败不走这里：那些由各自的 action 返回 `{ ok: false, message }`，
 * 在页面上原位说明（见 PLAN.md R89）。
 *
 * 这一层也要兜住 `/app` 外壳自身抛出的错（那时侧栏不在场），所以它自带整屏居中。
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="bg-ink-50 flex min-h-[100dvh] items-center justify-center p-6">
      <ErrorCard digest={error.digest} onRetry={reset} />
    </div>
  );
}
