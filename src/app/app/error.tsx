'use client';

import { ErrorCard } from '@/components/layout/error-card';

/**
 * 管理台内的错误边界。
 *
 * 与根那一层（`app/error.tsx`）的分工：这一层渲染在**外壳里面**，侧栏与当前工作区还在
 * —— 某个页面上出的错不该让整块导航跟着消失。外壳自己抛的错冒到根那一层去兜。
 *
 * `reset` 只重渲染这一段；数据库抖动、并发改动的失败大多一次重试就过去了。
 */
export default function AppSectionError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="mx-auto flex min-h-0 w-full max-w-[560px] flex-1 items-center justify-center overflow-y-auto px-6 py-7">
      <ErrorCard digest={error.digest} onRetry={reset} />
    </main>
  );
}
