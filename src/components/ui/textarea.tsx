import { cn } from '@/utils/cn';

import { fieldBase, fieldBorder, fieldErrorBorder } from './field';

export type TextareaProps = React.ComponentProps<'textarea'> & {
  invalid?: boolean;
};

/**
 * 多行输入。默认 `resize-none`（与设计稿题目属性面板一致）——
 * 需要用户自行调整高度时由调用方传 `className="resize-y"` 覆盖。
 */
export function Textarea({ className, invalid = false, rows = 3, ...props }: TextareaProps) {
  return (
    <textarea
      rows={rows}
      aria-invalid={invalid || undefined}
      className={cn(
        fieldBase,
        'resize-none py-2 leading-5',
        invalid ? fieldErrorBorder : fieldBorder,
        className,
      )}
      {...props}
    />
  );
}
