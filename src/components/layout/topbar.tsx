'use client';

import { MenuIcon } from '@/components/icons/ui-icons';
import { Drawer, DrawerContent, DrawerTrigger } from '@/components/ui/drawer';

import { useShellSidebar } from './app-shell';

export type TopbarProps = {
  title: string;
  /** 右侧的通知铃铛 */
  notifications?: React.ReactNode;
  /** 右侧的页面主操作（例如「新建问卷」） */
  actions?: React.ReactNode;
};

/**
 * 顶栏。高 64，左边距 28（与页面内容对齐）。
 *
 * 由**页面**渲染而不是 layout：设计稿里每一页的标题与主操作都不同，
 * 放进 layout 就得再想办法把标题从页面传上去。
 * 窄屏下的导航入口在这里 —— 它从 shell context 取出侧栏内容塞进左侧抽屉。
 */
export function Topbar({ title, notifications, actions }: TopbarProps) {
  const sidebar = useShellSidebar();

  return (
    <header className="border-ink-200 flex h-16 shrink-0 items-center justify-between gap-3 border-b bg-white px-4 sm:px-7">
      <div className="flex min-w-0 items-center gap-2">
        {sidebar ? (
          <Drawer>
            <DrawerTrigger asChild>
              <button
                type="button"
                aria-label="打开导航"
                className="text-ink-500 hover:bg-ink-100 flex size-9 items-center justify-center rounded-[10px] transition-colors duration-150 lg:hidden"
              >
                <MenuIcon className="size-5" />
              </button>
            </DrawerTrigger>
            <DrawerContent title="导航" side="left" widthClassName="max-w-[260px]">
              {sidebar}
            </DrawerContent>
          </Drawer>
        ) : null}

        <h1 className="text-ink-900 truncate text-[17px] font-semibold">{title}</h1>
      </div>

      <div className="flex shrink-0 items-center gap-2 sm:gap-3">
        {notifications}
        {actions}
      </div>
    </header>
  );
}
