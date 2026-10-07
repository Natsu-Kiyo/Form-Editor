import { cn } from '@/utils/cn';

/**
 * 骨架块（设计稿 `补充.html` L03 / L05）。
 *
 * 三条来自设计稿、**不能自己改**的规矩：
 *
 * 1. **一律 `ink-100`，不用品牌色**。品牌色只做「点」不做「面」—— 满屏浅蓝骨架会把界面
 *    染成蓝色、重量过重（L10 反例）。
 * 2. **形状必须与真实内容逐个对齐**，包括圆角与内边距。骨架是「版式的占位」，
 *    不是「灰色的装饰」：对不齐的话，内容一出现整页重排（L10 里最致命的一条之一）。
 * 3. **表头不加动画**（见 `SkeletonStatic`）：表头从一开始就存在，给它加扫光反而暴露
 *    「整张表是假的」。
 *
 * 扫光是 1500ms ease-in-out 的横向高光（L00 参数表）；`prefers-reduced-motion` 下
 * 换成低频呼吸（2.4s）—— 那是在 globals.css 里按媒体查询切的，组件这边不用管。
 */
export function Skeleton({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn('qw-skeleton bg-ink-100 relative block overflow-hidden rounded-md', className)}
    />
  );
}

/** 静态骨架块：与 `Skeleton` 同色同形，但**不扫光**（表头、坐标轴标签这类「本来就存在」的结构） */
export function SkeletonStatic({ className }: { className?: string }) {
  return <span aria-hidden="true" className={cn('bg-ink-100 block rounded-md', className)} />;
}
