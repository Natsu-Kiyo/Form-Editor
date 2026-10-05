'use client';

import { createContext, useContext } from 'react';

/**
 * 把侧栏内容放进 context，供顶栏在窄屏下取出、塞进左侧抽屉。
 *
 * 为什么要绕这一下：顶栏由**每个页面**自己渲染（设计稿里每页的标题与主操作都不同），
 * 而侧栏在 layout 里只渲染一次。若让每页自己拼一份侧栏，必然漂移。
 */
const SidebarContext = createContext<React.ReactNode>(null);

export function useShellSidebar() {
  return useContext(SidebarContext);
}

export type AppShellProps = {
  /** 侧栏内容（服务端渲染好后传进来） */
  sidebar: React.ReactNode;
  children: React.ReactNode;
};

/**
 * 管理台外壳：桌面端常驻左侧栏，窄屏把同一份侧栏收进抽屉。
 *
 * 这里**不做鉴权** —— 见 `src/lib/auth/dal.ts` 的说明，
 * layout 拦不住直接访问子路由的人，安全边界在每个数据函数内部。
 */
export function AppShell({ sidebar, children }: AppShellProps) {
  return (
    <SidebarContext.Provider value={sidebar}>
      <div className="bg-ink-50 flex min-h-full flex-1">
        <div className="hidden lg:flex">{sidebar}</div>

        <div className="flex min-w-0 flex-1 flex-col">{children}</div>
      </div>
    </SidebarContext.Provider>
  );
}
