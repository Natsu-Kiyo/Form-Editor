'use client';

import { createContext, useContext } from 'react';

import { NavigationProgress } from './navigation-progress';

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
      {/* 路由切换的顶部进度条（L02）：挂在最外层，压在旧页面之上 */}
      <NavigationProgress />

      {/*
        「整页不超过视口」就落在这一层：
        - 外层 `h-dvh overflow-hidden` 把高度**箍死在视口上**，于是页面级滚动条只可能
          出现在下面第二列里的滚动容器上（各页面的 `<main className="flex-1 overflow-y-auto">`）。
        - 第二列必须写 `min-h-0`：flex 子项默认 `min-height: auto`，不写它的话长内容会把
          这一列**撑高**，`overflow` 随之失效 —— 这是这类布局最常见的坑。
        - 侧栏自己 `h-full` 且不参与滚动，所以它底部那行账号永远在视口内。
          原先这里是 `min-h-full`：整页高度跟着主区内容长，滚到最下面才看得见账号行。
      */}
      <div className="bg-ink-50 flex h-dvh overflow-hidden">
        <div className="hidden min-h-0 lg:flex">{sidebar}</div>

        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">{children}</div>
      </div>
    </SidebarContext.Provider>
  );
}
