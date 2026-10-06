'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { FileTextIcon, GridIcon, UserIcon } from '@/components/icons/ui-icons';
import { cn } from '@/utils/cn';

/**
 * 移动端底部导航三格（设计稿 P04 / P07 / P09）。
 *
 * 三处刻意的处理：
 * - **只放三格**（问卷 / 模板 / 我的）。成员与权限、操作日志是桌面端专属
 *   （长表格与角色矩阵在 375px 下没法用），底部导航里也不给它们留位置 ——
 *   留一个点了就跳回抽屉的格子，比少一个格子糟。
 * - **问卷那一格要精确匹配**：`/app/q/xxx/edit` 等子路由不该让「问卷」高亮着，
 *   那些页面有自己的底部操作条（P05 的导出/分享、P08 的保存）。
 * - 用 CSS 控制显隐（`lg:hidden`）而不是 `useIsDesktop`：底部条是纯版式，
 *   不必参与水合判断，也就不会出现「先渲染后跳掉」的闪烁。
 */
const TABS = [
  { href: '/app', label: '问卷', icon: FileTextIcon },
  { href: '/app/templates', label: '模板', icon: GridIcon },
  { href: '/app/me', label: '我的', icon: UserIcon },
] as const;

export function MobileTabBar() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="主导航"
      className="border-ink-100 fixed inset-x-0 bottom-0 z-30 flex border-t bg-white pb-[env(safe-area-inset-bottom)] lg:hidden"
    >
      {TABS.map(({ href, label, icon: Icon }) => {
        const active = href === '/app' ? pathname === '/app' : pathname.startsWith(href);

        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'flex flex-1 flex-col items-center gap-1 pt-2.5 pb-2 transition-colors duration-150',
              active ? 'text-brand-500' : 'text-ink-400',
            )}
          >
            <Icon className="size-[21px]" />
            <span className={cn('text-[10px]', active && 'font-medium')}>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
