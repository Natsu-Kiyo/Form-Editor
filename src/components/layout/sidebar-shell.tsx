import { Logo } from '@/components/icons/logo';
import { cn } from '@/utils/cn';

export type SidebarShellProps = {
  /** 工作区切换器（由 workspace feature 提供，含自己的交互与数据） */
  workspaceSwitcher: React.ReactNode;
  /** 主导航 */
  nav: React.ReactNode;
  /** 底部账号行（由 account feature 提供） */
  account: React.ReactNode;
  className?: string;
};

/**
 * 侧栏骨架（宽 236）。
 *
 * 只负责版式：品牌行 / 工作区切换 / 导航 / 底部账号行。
 * 交互与数据都通过插槽从各 feature 传进来 ——
 * `src/components/` 是 shared 层，**不允许导入 features**。
 *
 * 桌面端常驻、窄屏收进左侧抽屉，两处复用同一份内容。
 *
 * 高度：整条侧栏不参与滚动（`h-full` + 四个部分各自 `shrink-0`），
 * **只有导航那一块**在装不下时自己滚 —— 这样底部账号行永远贴在视口底边。
 */
export function SidebarShell({ workspaceSwitcher, nav, account, className }: SidebarShellProps) {
  return (
    <aside
      className={cn(
        'border-ink-200 flex h-full w-[236px] shrink-0 flex-col border-r bg-white',
        className,
      )}
    >
      <div className="flex h-16 shrink-0 items-center gap-2.5 px-5">
        <div className="bg-brand-500 flex size-7 items-center justify-center rounded-lg text-white">
          <Logo className="size-4" />
        </div>
        <span className="text-ink-900 text-[14.5px] font-semibold tracking-tight">轻问卷</span>
      </div>

      <div className="mb-4 shrink-0 px-3">{workspaceSwitcher}</div>

      {/* 中间这块吃掉剩余高度并自己滚动：工作区一多也不会把底部账号行挤出视口 */}
      <div className="min-h-0 flex-1 overflow-y-auto">{nav}</div>

      <div className="border-ink-100 shrink-0 border-t p-3">{account}</div>
    </aside>
  );
}
