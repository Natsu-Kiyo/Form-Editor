import { cn } from '@/utils/cn';

import { fieldBase, fieldBorder, fieldErrorBorder, fieldHeight } from './field';

export type InputProps = Omit<React.ComponentProps<'input'>, 'size'> & {
  /** 校验失败态：描边转玫红。必须同时给出字段下方说明原因的文案 */
  invalid?: boolean;
  /** 桌面 40 / 移动 48 */
  size?: keyof typeof fieldHeight;
};

export function Input({ className, invalid = false, size = 'md', ...props }: InputProps) {
  return (
    <input
      aria-invalid={invalid || undefined}
      className={cn(
        fieldBase,
        fieldHeight[size],
        invalid ? fieldErrorBorder : fieldBorder,
        className,
      )}
      {...props}
    />
  );
}
