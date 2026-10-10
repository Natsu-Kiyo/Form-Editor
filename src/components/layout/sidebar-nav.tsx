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
   * 只认**路径完全相等**，连自己的子路径都不给。
   *
   * 必须给 `/app` 加上：它是所有管理台页面的共同前缀，按前缀匹配的话，
   * 进「模板中心」「我的」这些子路由时「问卷列表」会一直亮着 ——
   * 用户第一眼就会以为导航坏了。
   */
  exact?: boolean;
  /**
   * 额外算作「本项」的子路径（不含 `href` 自身）。
   *
   * 给 `/app` 用：`/app/q/**` 是问卷的**工作区**（编辑 / 发布设置 / 分享 / 数据 / 答卷），
   * 在那里「问卷列表」应当保持选中。不能改用前缀匹配（`exact` 一去掉，模板中心、
   * 成员页也会跟着亮），所以这里是**逐个登记**的 —— 与「只认全等」并不冲突。
   */
  matchPrefixes?: readonly string[];
  /**
   * 只在桌面端出现。
   *
   * 「成员与权限」与「操作日志」都属设计稿标了**移动端隐藏**的页面（M10 复核项），
   * 所以窄屏下侧栏抽屉里**完全不渲染**这一项，而不是让它进去看到一个没做版式的页面。
   */
  desktopOnly?: boolean;
};

/**
 * 某个导航项是不是「当前页」。
 *
 * 三种取值组合出三条规则，缺哪条都会出问题：
 * - 默认：`href` 全等，**或**落在它的子路径下（模板中心 → 模板详情这类）
 * - `exact`：砍掉「自己的子路径」这条（`/app` 必须用它，否则到处亮）
 * - `matchPrefixes`：补回**指定的**子路径（`/app/q/**` 要算作问卷列表）
 *
 * ⚠️ 别把 `exact` 换成 `matchPrefixes` 了事、也别反过来 —— 它们解决的是两个方向的问题。
 */
function isNavItemActive(
  pathname: string,
  item: Pick<SidebarNavItem, 'href' | 'exact' | 'matchPrefixes'>,
) {
  const inExtraPrefix = (item.matchPrefixes ?? []).some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );

  if (pathname === item.href || inExtraPrefix) return true;
  if (item.exact) return false;

  return pathname.startsWith(`${item.href}/`);
}

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
          const active = isNavItemActive(pathname, item);

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
