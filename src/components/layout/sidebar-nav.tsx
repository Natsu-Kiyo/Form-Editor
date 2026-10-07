'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { useIsDesktop } from '@/hooks/use-is-desktop';
import { cn } from '@/utils/cn';

export type SidebarNavItem = {
  href: string;
  label: string;
  icon: React.ReactNode;
  /**
   * 只认**路径完全相等**，不做前缀匹配。
   *
   * 必须给 `/app` 加上：它是所有管理台页面的共同前缀，按前缀匹配的话，
   * 进「模板中心」「我的」这些子路由时「问卷列表」会一直亮着 ——
   * 用户第一眼就会以为导航坏了。
   */
  exact?: boolean;
  /**
   * 只在桌面端出现。
   *
   * 「成员与权限」与「操作日志」都属设计稿标了**移动端隐藏**的页面（M10 复核项），
   * 所以窄屏下侧栏抽屉里**完全不渲染**这一项，而不是让它进去看到一个没做版式的页面。
   */
  desktopOnly?: boolean;
};

/**
 * 侧栏主导航。
 *
 * 做成客户端组件只为拿 `usePathname()` 判当前项 —— layout 拿不到 pathname。
 * 激活态用 `bg-brand-50` + `brand-600` 文字，**不填深底**（设计铁律）。
 */
export function SidebarNav({ items }: { items: SidebarNavItem[] }) {
  const pathname = usePathname();
  const isDesktop = useIsDesktop();

  return (
    <nav className="space-y-0.5 px-3">
      {items
        .filter((item) => isDesktop || !item.desktopOnly)
        .map((item) => {
          const active = item.exact
            ? pathname === item.href
            : pathname === item.href || pathname.startsWith(`${item.href}/`);

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
