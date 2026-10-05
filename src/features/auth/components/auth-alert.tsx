import { AlertCircleIcon, CheckCircleIcon, InfoIcon } from '@/components/icons/ui-icons';
import { cn } from '@/utils/cn';

const TONE = {
  error: {
    wrapper: 'border-rose-200 bg-rose-50 text-rose-700',
    icon: <AlertCircleIcon className="mt-px size-3.5 shrink-0" />,
  },
  success: {
    wrapper: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    icon: <CheckCircleIcon className="mt-px size-3.5 shrink-0" />,
  },
  info: {
    wrapper: 'border-brand-200 bg-brand-50 text-brand-700',
    icon: <InfoIcon className="mt-px size-3.5 shrink-0" />,
  },
} as const;

export type AuthAlertProps = {
  tone?: keyof typeof TONE;
  children: React.ReactNode;
  className?: string;
};

/** 表单级提示条：整体性错误、成功提示、说明性信息都用它 */
export function AuthAlert({ tone = 'error', children, className }: AuthAlertProps) {
  const { wrapper, icon } = TONE[tone];

  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={cn(
        'text-label flex items-start gap-2 rounded-[10px] border p-3 leading-5',
        wrapper,
        className,
      )}
    >
      {icon}
      <span className="min-w-0 flex-1">{children}</span>
    </div>
  );
}
