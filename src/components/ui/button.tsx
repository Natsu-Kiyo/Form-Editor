import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/utils/cn';

import { Spinner } from './spinner';

/**
 * 按钮（设计系统稿 §06）
 *
 * 硬规则：**按钮一律不加投影**。层级靠主色 + 尺寸 + 位置表达就够了。
 * 唯二例外是分段控件选中块与移动端 FAB，都不在这里。
 *
 * 高度：36 紧凑（sm，用 `h-8` 之外的 36 由 9 号尺寸承载）/ 40 标准 / 44 移动端与主操作。
 * 触控目标不小于 44×44 —— 移动端场景请用 `size="lg"`。
 */
const buttonVariants = cva(
  [
    'inline-flex shrink-0 items-center justify-center gap-1.5',
    'font-medium whitespace-nowrap',
    'transition-colors duration-150',
    'disabled:cursor-not-allowed disabled:opacity-45',
  ],
  {
    variants: {
      variant: {
        /** 一个页面只允许一个 Primary */
        primary: 'bg-brand-500 text-white hover:bg-brand-600',
        /** 次级填充：brand-50 浅底 + brand-600 文字 */
        secondary: 'border border-brand-200 bg-brand-50 text-brand-600 hover:bg-brand-100',
        /** 白底描边，用于「预览」这类中性动作 */
        outline: 'border border-ink-200 bg-white text-ink-700 hover:border-ink-300 hover:bg-ink-50',
        /** 纯文字，用于「取消」 */
        ghost: 'text-ink-600 hover:bg-ink-100',
        /**
         * 危险动作（删除 / 移除 / 撤回 / 截止 / 放弃修改）。
         *
         * **实心 rose-500 + 白字**，与设计稿的危险确认样本一致（`bg-rose-500 text-white`）。
         * 原先写的是浅底描边（rose-50 + rose-600 文字），设计稿里没有这个样式 ——
         * 那个样子看起来像「次要按钮」，而这类动作恰恰是最需要一眼看出不可撤销的。
         */
        danger: 'bg-rose-500 text-white hover:bg-rose-600',
      },
      size: {
        sm: 'h-8 rounded-lg px-3.5 text-label',
        md: 'h-10 rounded-btn px-5 text-body-s',
        lg: 'h-11 rounded-btn px-6 text-body',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
);

export type ButtonProps = React.ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & {
    /** 渲染成子元素（例如包一层 Link），保持按钮外观 */
    asChild?: boolean;
    /**
     * 图标（可选）。
     *
     * 单独给它一个 prop，是为了**加载态能原样顶掉它**（设计稿 L06）：
     * 「spinner 占据的正是原图标的位置，所以图标不会被挤走、文字起点也不会移动」。
     * 如果调用方自己把图标塞进 children，加载时就会变成「图标 + spinner + 文案」三样挤一排。
     */
    icon?: React.ReactNode;
    /**
     * 正在做这件事（提交中 / 保存中）。
     *
     * 与普通 `disabled` 的区别是**外观**：加载态**不降低不透明度**（L10 反例：
     * 「降低不透明度看起来像不可用，而不是正在工作」），只把指针变成 `not-allowed`，
     * 并把内容换成「spinner + 文案」。文案由调用方给（必须说清在做什么，见 L00 无障碍）。
     */
    loading?: boolean;
  };

export function Button({
  className,
  variant,
  size,
  asChild = false,
  icon,
  loading = false,
  children,
  disabled,
  ...props
}: ButtonProps) {
  const Comp = asChild ? Slot : 'button';

  return (
    <Comp
      className={cn(
        buttonVariants({ variant, size }),
        // 加载态：保持原色原尺寸，只换内容
        loading && 'cursor-not-allowed disabled:opacity-100',
        className,
      )}
      // 非 asChild 时默认 button 类型，避免在 form 里意外触发提交
      {...(asChild ? {} : { type: 'button' as const })}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {/*
        `asChild` 时**只能有一个子元素** —— Radix 的 `Slot` 要把 props 合并到那个孩子上，
        给两个就会抛「Slot failed to slot onto its children」（这轮 E2E 实测撞上的就是这个：
        全项目所有 `<Button asChild><Link/></Button>` 一起炸）。
        所以这条路径只透传 children：图标 / spinner 是「按钮自己的装饰」，
        而 asChild 的用法是「包一层 Link」，装饰由那个元素自己承担。
      */}
      {asChild ? (
        children
      ) : (
        <>
          {loading ? (
            <Spinner
              size="sm"
              tone={variant === 'primary' || variant === 'danger' ? 'onDark' : 'default'}
            />
          ) : (
            icon
          )}
          {children}
        </>
      )}
    </Comp>
  );
}

export { buttonVariants };
