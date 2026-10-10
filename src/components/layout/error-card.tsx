'use client';

import Link from 'next/link';

import { AlertTriangleIcon } from '@/components/icons/ui-icons';
import { Button } from '@/components/ui/button';

/**
 * 错误边界的卡片（根那层 `app/error.tsx` 与管理台那层 `app/app/error.tsx` 共用）。
 *
 * 为什么共用：两处的文案与出口必须一致 —— 各写一遍必然漂移，而「同一类出错有两个说法」
 * 比出错本身更让人怀疑站点坏了。两处只有外壳不同（整屏 / 外壳内）。
 *
 * 四样东西是硬要求：**为什么**（服务端出错，不是你填错了）、**下一步**（重试）、
 * **出口**（回问卷列表）、以及 `digest` —— 只有它能让管理员在服务器日志里定位那一条。
 * 刻意**不显示 `error.message`**：生产环境它多半是一句笼统的话，而客户端抛出的错误
 * 可能带着不该给用户看的内容。
 */
export function ErrorCard({ digest, onRetry }: { digest?: string; onRetry: () => void }) {
  return (
    <div className="border-ink-200 w-full max-w-[420px] rounded-xl border bg-white p-8 text-center">
      {/* 状态一律「图标 + 文字」双通道，不靠颜色单独传达 */}
      <div className="mx-auto mb-3 flex size-11 items-center justify-center rounded-full bg-rose-50">
        <AlertTriangleIcon className="size-5 text-rose-500" />
      </div>

      <h1 className="text-ink-900 text-[15px] font-semibold">这一步没能完成</h1>
      <p className="text-ink-500 mt-2 text-[12.5px] leading-5">
        服务端处理这个请求时出错了，不是你填错了什么。
        <br />
        可以重试一次；如果一直这样，把下面的编号发给管理员。
      </p>

      {digest ? <p className="text-ink-400 mt-3 font-mono text-[11px]">错误编号 {digest}</p> : null}

      <div className="mt-6 flex justify-center gap-2.5">
        <Button onClick={onRetry}>重试</Button>
        <Button variant="outline" asChild>
          <Link href="/app">回到问卷列表</Link>
        </Button>
      </div>
    </div>
  );
}
