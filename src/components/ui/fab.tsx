import { cn } from '@/utils/cn';

export type FabProps = React.ComponentProps<'button'>;

/**
 * 移动端悬浮操作按钮。
 *
 * 这是**唯一**允许带投影的按钮 —— 设计系统明确规定 `shadow-fab` 仅用于此场景，
 * 因为它真的浮在页面内容之上。桌面端一律不用 FAB。
 */
export function Fab({ className, ...props }: FabProps) {
  return (
    <button
      type="button"
      className={cn(
        'inline-flex size-12 items-center justify-center rounded-full',
        'bg-brand-500 shadow-fab text-white',
        'hover:bg-brand-600 transition-colors duration-150',
        'disabled:cursor-not-allowed disabled:opacity-45',
        className,
      )}
      {...props}
    />
  );
}
