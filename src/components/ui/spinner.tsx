import { cn } from '@/utils/cn';

/**
 * 旋转 spinner（设计稿 `补充.html` L00）。
 *
 * 尺寸只有三档，**别再造第四种** —— 每档对应一类场景：
 *
 * | 尺寸 | 用在哪 |
 * |---|---|
 * | `sm`（14px · 2px） | 行内 / 按钮里 |
 * | `md`（20px · 2px） | 区块局部 |
 * | `lg`（24px · 2.5px） | 全屏 / 弹层里 |
 *
 * 三个刻意的处理：
 * - **弧线用 brand-500、轨道用 brand-100**（不是灰）：它要看起来像「在动」而不是「灰色的圈」。
 * - **它自己是装饰**：`aria-hidden`。状态由旁边的文字承担（`role="status"`），
 *   因为「不要只靠动画传达状态」是这一套的硬规矩（L00 无障碍）。
 * - 时长 720ms linear（L00 的参数表）；`prefers-reduced-motion` 下放慢到 1.9s —— **保留旋转**
 *   （停了就完全看不出在加载），这是设计稿明确写的处理。
 */
export function Spinner({
  size = 'sm',
  tone = 'default',
  className,
}: {
  size?: 'sm' | 'md' | 'lg';
  /** `onDark` 用在深色底 / 品牌色按钮上 */
  tone?: 'default' | 'onDark';
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        // `inline-block` 不能省：`<span>` 是行内元素，`size-*` 在它身上**不生效**
        // （宽高被忽略，只剩上下两条边框 —— 看起来是一根竖条）。
        // 按钮里没暴露，因为 flex 会把子元素块级化；一旦放进普通文本流（比如提交遮罩）就露馅。
        'qw-spinner inline-block shrink-0 rounded-full',
        size === 'sm' && 'size-3.5 border-2',
        size === 'md' && 'size-5 border-2',
        size === 'lg' && 'size-6 border-[2.5px]',
        tone === 'onDark' ? 'qw-spinner-dark' : 'border-brand-100 border-t-brand-500',
        className,
      )}
    />
  );
}
