'use client';

import { usePathname } from 'next/navigation';

import { Logo } from '@/components/icons/logo';

/**
 * 启动 / 会话校验的全屏加载（设计稿 `补充.html` L01）。
 *
 * 三条来自设计稿的处理：
 * - **这是唯一允许占满全屏的加载态** —— 此刻还没有任何版式可以搭骨架。
 * - **不用旋转 spinner**：全屏中心转圈是「卡住了」的心理暗示，而这里只是初始化。
 *   动效只有两处：标记的轻微浮动 + 一道 2.6s 循环的高光扫过。
 * - 下方细进度条是**不确定进度**：它不会跑到 100%（无法预知耗时），只做「一直在动」的活体证明。
 *
 * 文案按路径分两种：`/app` 下是「正在准备工作区 / 正在校验登录状态」；
 * 其余页面说「正在加载…」。**根段的 loading 同时覆盖后者**（登录、公开作答页都没有自己的
 * loading 文件），在公开作答页上写「校验登录状态」是错的 —— 作答者根本没登录。
 */
export function StartupSplash() {
  const pathname = usePathname();
  const isApp = pathname?.startsWith('/app') ?? false;

  return (
    <div
      aria-busy="true"
      className="bg-ink-50 flex min-h-[100dvh] flex-col items-center justify-center px-6"
    >
      <div className="qw-float bg-brand-500 relative mb-6 flex size-14 items-center justify-center overflow-hidden rounded-2xl text-white">
        <Logo className="relative z-10 size-7" />
        <span className="qw-sweep" />
      </div>

      <div className="text-center">
        <p className="text-ink-800 text-[14px] font-medium">
          {isApp ? '正在准备工作区' : '正在加载…'}
        </p>
        {isApp ? (
          <p role="status" className="text-ink-400 mt-1.5 text-[12px]">
            正在校验登录状态…
          </p>
        ) : null}
      </div>

      {/* 不确定进度条：只表示「还在动」，不表示「快到哪了」 */}
      <div className="bg-ink-100 mt-7 h-[3px] w-[220px] overflow-hidden rounded-full">
        <div className="qw-indeterminate bg-brand-500 h-full rounded-full" />
      </div>
    </div>
  );
}
