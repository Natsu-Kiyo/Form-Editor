import { cn } from '@/utils/cn';

export type EmptyStateProps = {
  /** 建议传 `<XxxIcon />`，尺寸由容器统一控制 */
  icon: React.ReactNode;
  title: string;
  description?: string;
  /** 出口动作。**必须是真的有落点的操作**，不要放「敬请期待」 */
  action?: React.ReactNode;
  className?: string;
};

/**
 * 空状态。硬性要求：包含「为什么空 + 下一步做什么」的明确出口，
 * 不能只写一句「暂无数据」。
 */
export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        'rounded-card border-ink-200 border border-dashed px-4 py-7 text-center',
        className,
      )}
    >
      <div className="rounded-card bg-brand-50 mx-auto mb-3 flex size-11 items-center justify-center">
        <span className="text-brand-400 [&>svg]:size-5">{icon}</span>
      </div>

      <div className="text-body-s text-ink-800 mb-1 font-medium">{title}</div>
      {description ? <p className="text-label text-ink-400">{description}</p> : null}
      {action ? <div className="mt-3.5 flex justify-center">{action}</div> : null}
    </div>
  );
}
