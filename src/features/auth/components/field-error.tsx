import { cn } from '@/utils/cn';

/**
 * 字段下方的校验提示。
 *
 * 规则（设计系统 §09）：表单错误必须绑定在字段下方，并**指明具体原因**，
 * 不能只把边框变红就完事。
 */
export function FieldError({ messages, className }: { messages?: string[]; className?: string }) {
  if (!messages || messages.length === 0) return null;

  return (
    <p className={cn('text-caption mt-1.5 text-rose-500', className)}>{messages.join('，')}</p>
  );
}
