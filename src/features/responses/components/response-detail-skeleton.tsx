import { Skeleton, SkeletonStatic } from '@/components/ui/skeleton';

/**
 * 答卷详情的骨架（右栏，360px）。
 *
 * 形状与 `response-detail-panel.tsx` 逐个对齐 —— 标题行 / 元信息三条 / 题目块 /
 * 底部动作，宽度与真实那一栏一致（`w-[360px]`）：骨架是「版式的占位」，
 * 内容到位时那一栏不该重排。一律 `ink-100`（L03 / L10：品牌色只做「点」不做「面」）。
 *
 * 用在**打开**详情的等待期（初始 → 查看、以及从一份切到另一份）：
 * 右栏先立起这一栏的形状，Tab、列表与筛选都保持在场。
 * 关闭不摆它 —— 关闭的语义是「这一栏要走」，见 `ResponseDetailPanel` 的 closing 态。
 */
export function ResponseDetailSkeleton() {
  return (
    <aside
      aria-label="答卷详情"
      aria-busy="true"
      className="border-ink-200 qw-fade-up w-[360px] shrink-0 self-start overflow-hidden rounded-xl border bg-white"
    >
      {/* 状态不能只靠动画传达（L00）：读屏听到的是这句话 */}
      <span role="status" className="sr-only">
        正在加载答卷…
      </span>

      {/* 标题行：答卷 #N + 提交时间；右侧留出关闭按钮的位置 */}
      <div className="border-ink-100 flex items-start justify-between gap-2 border-b px-5 py-4">
        <div>
          <Skeleton className="h-3.5 w-24" />
          <SkeletonStatic className="mt-2 h-2.5 w-32" />
        </div>
        <SkeletonStatic className="size-7 rounded-md" />
      </div>

      <div className="space-y-4 p-5">
        {/* 元信息（渠道 / 身份 / 提交方式）：标签占 w-14，与真实那几行同一个起点 */}
        {[0, 1, 2].map((row) => (
          <div key={row} className="flex items-baseline gap-2">
            <span className="w-14 shrink-0">
              <SkeletonStatic className="h-2.5 w-8" />
            </span>
            <SkeletonStatic className="h-2.5 w-24" />
          </div>
        ))}

        {/* 题目块：题号·题干一行 + 答案块（h-9 与文本 / 标签答案的实际高度对齐） */}
        <div className="border-ink-100 space-y-4 border-t pt-4">
          {[0, 1, 2, 3].map((item) => (
            <div key={item}>
              <SkeletonStatic className="h-2.5 w-1/3" />
              <Skeleton className="mt-1.5 h-9 rounded-lg" />
            </div>
          ))}
        </div>

        {/* 底部动作（标记为无效答卷） */}
        <div className="border-ink-100 border-t pt-4">
          <SkeletonStatic className="h-9 w-full rounded-[10px]" />
        </div>
      </div>
    </aside>
  );
}
