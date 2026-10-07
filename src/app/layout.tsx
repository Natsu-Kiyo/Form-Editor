import type { Metadata } from 'next';
import { Analytics } from '@vercel/analytics/next';
import { SpeedInsights } from '@vercel/speed-insights/next';

import { ToastProvider } from '@/components/ui/toast';
import { TooltipProvider } from '@/components/ui/tooltip';

import './globals.css';

export const metadata: Metadata = {
  title: {
    default: '轻问卷',
    template: '%s · 轻问卷',
  },
  description: '面向小团队的问卷协作工具：创建、发放、回收、分析，一条线走完。',
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="zh-CN" className="h-full">
      {/* 字体不加载 webfont：设计系统要求「中文走系统字体栈，避免额外字体加载」，
          英文与数字优先命中本机 Inter，缺失时回落到系统字体。 */}
      <body className="bg-ink-50 text-body text-ink-800 flex min-h-full flex-col font-sans antialiased">
        {/* Tooltip 与 Toast 的 Provider 放在最外层：两者都是全局浮层，
            任何页面都可能用到，且必须比页面内容先挂载。 */}
        <TooltipProvider delayDuration={300}>
          <ToastProvider>{children}</ToastProvider>
        </TooltipProvider>

        {/*
          Vercel 的访问统计与真实用户性能指标（M11）。
          两者都只在部署到 Vercel 时才有接收端，本地开发与自托管下不会真正上报 ——
          所以不需要按环境条件渲染，放最外层即可。
        */}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
