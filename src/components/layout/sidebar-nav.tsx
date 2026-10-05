'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { cn } from '@/utils/cn';

export type SidebarNavItem = {
  href: string;
  label: string;
  icon: React.ReactNode;
};

/**
 * 侧栏主导航。
 *
 * 做成客户端组件只为拿 `usePathname()` 判当前项 —— layout 拿不到 pathname。
 * 激活态用 `bg-brand-50` + `brand-600` 文字，**不填深底**（设计铁律）。
 */
export function SidebarNav({ items }: { items: SidebarNavItem[] }) {
  const pathname = usePathname();

  return (
    <nav className="space-y-0.5 px-3">
      {items.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);

        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'flex h-10 items-center gap-3 rounded-[10px] px-3 transition-colors duration-150',
              active
                ? 'bg-brand-50 text-brand-600'
                : 'text-ink-600 hover:bg-ink-50 hover:text-ink-900',
            )}
          >
            <span className="flex size-[17px] shrink-0 items-center justify-center [&>svg]:size-[17px]">
              {item.icon}
            </span>
            <span className="text-[13px] font-medium">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
