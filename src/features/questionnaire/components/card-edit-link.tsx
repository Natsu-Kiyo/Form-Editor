'use client';

import Link from 'next/link';

import { useIsDesktop } from '@/hooks/use-is-desktop';

/**
 * 卡片底部的「编辑」入口。
 *
 * **窄屏下不渲染**：设计稿的移动端编辑是弹层化的一套交互（P08），属 M10；
 * 现在把三栏工作台硬塞进 375px 会得到一个不能用的页面。
 * 与其画一个点开就崩的入口，不如先不出这个入口 —— M10 交付 P08 时在这里打开。
 */
export function CardEditLink({
  questionnaireId,
  title,
}: {
  questionnaireId: string;
  title: string;
}) {
  const isDesktop = useIsDesktop();

  if (!isDesktop) return null;

  return (
    <div className="border-ink-100 flex items-center gap-1 border-t pt-3.5">
      <Link
        href={`/app/q/${questionnaireId}/edit`}
        aria-label={`编辑「${title}」`}
        className="text-ink-600 hover:bg-ink-100 flex h-8 flex-1 items-center justify-center rounded-lg text-[12.5px] font-medium transition-colors duration-150"
      >
        编辑
      </Link>
    </div>
  );
}
