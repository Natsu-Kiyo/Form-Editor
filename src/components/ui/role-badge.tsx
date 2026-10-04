import { ROLE_LABEL, type Role } from '@/config/constants';
import { cn } from '@/utils/cn';

/**
 * 角色徽标：权限层级用**同一色系的深浅**表达 —— 颜色越深权限越高。
 * 比四种不同颜色更容易形成直觉，也不会和状态标签的语义色打架。
 */
const ROLE_STYLE: Record<Role, string> = {
  OWNER: 'bg-brand-500 text-white',
  ADMIN: 'bg-brand-100 text-brand-700',
  EDITOR: 'bg-ink-100 text-ink-700',
  VIEWER: 'border border-ink-200 bg-ink-50 text-ink-500',
};

export function RoleBadge({ role, className }: { role: Role; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex h-6 items-center rounded-md px-2.5 text-[11.5px] font-medium',
        ROLE_STYLE[role],
        className,
      )}
    >
      {ROLE_LABEL[role]}
    </span>
  );
}
