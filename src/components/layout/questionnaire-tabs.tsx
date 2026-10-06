'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { cn } from '@/utils/cn';

/**
 * 问卷内的 5 个 Tab（设计稿 W03–W07 都带这条切换条）。
 *
 * **只登记已交付的页面**：分享（M4-b）、数据（M6）、答卷（M7）的入口会在各自落地时加进来 ——
 * 提前画出来就是点了 404 的假入口，这跟侧栏导航是同一条规则。
 *
 * 它是客户端组件，因为「哪个 Tab 是当前页」要按路径判断。
 */
const TABS = [
  { segment: 'edit', label: '编辑' },
  { segment: 'publish', label: '发布设置' },
  { segment: 'share', label: '分享' },
  { segment: 'stats', label: '数据' },
] as const;

export function QuestionnaireTabs({ questionnaireId }: { questionnaireId: string }) {
  const pathname = usePathname();

  return (
    // role + aria-label 不只是给读屏用的：「顶栏的发布设置」与「Tab 的发布设置」同名，
    // 有了这个导航地标，人和测试都能一眼分清点的是哪一个
    <nav
      aria-label="问卷内页面"
      className="border-ink-200 flex shrink-0 items-center gap-1 border-b bg-white px-6"
    >
      {TABS.map((tab) => {
        const href = `/app/q/${questionnaireId}/${tab.segment}`;
        const active = pathname === href;

        return (
          <Link
            key={tab.segment}
            href={href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              '-mb-px flex h-11 items-center px-4 text-[13px] transition-colors duration-150',
              active
                ? 'border-brand-500 text-brand-500 border-b-2 font-medium'
                : 'text-ink-500 hover:text-ink-800',
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
