import { Skeleton, SkeletonStatic } from '@/components/ui/skeleton';

/**
 * 数据页骨架（设计稿 `补充.html` L04）。
 *
 * 两条来自设计稿、容易做错的细节：
 * - **柱形高度是随机的，不是等高的**：等高柱子看起来像一根横条，反而失去「这是图表」的暗示。
 *   随机高度让用户预判出「等一下这里会出现数据」。这里用一组**写死的**高低值 ——
 *   不能用 `Math.random()`：客户端导航时会重算出不一样的形状，造成闪烁。
 * - **坐标轴标签位（底部四个 `w-10`）也要占位**，否则图表出现时高度会变。
 *
 * 顶栏那一条与列表骨架同理：本项目顶栏由**页面**渲染，进 loading 时它会一起消失，
 * 不补一段占位就会看见「顶栏闪一下再回来」。（问卷内的切换条在 layout 里，不会消失。）
 */
export function StatsSkeleton() {
  return (
    <>
      <header className="border-ink-200 flex h-16 shrink-0 items-center justify-between gap-3 border-b bg-white px-4 sm:px-7">
        <SkeletonStatic className="h-5 w-24" />
        <SkeletonStatic className="rounded-btn h-9 w-[132px]" />
      </header>

      <main className="flex-1 overflow-y-auto p-6 pb-32 sm:p-7 lg:pb-7">
        <div aria-busy="true" className="qw-fade-up mx-auto max-w-[1020px]">
          <span role="status" className="sr-only">
            正在加载统计数据…
          </span>

          {/* 统一口径条：这一条在筛选变化时**不该动**（L09），所以它属于骨架里最上面的固定段 */}
          <div className="border-ink-200 mb-5 flex flex-wrap items-center gap-x-6 gap-y-2 rounded-xl border bg-white px-5 py-3.5">
            {[0, 1, 2].map((index) => (
              <SkeletonStatic key={index} className="h-4 w-24" />
            ))}
          </div>

          <div className="space-y-5">
            <QuestionCardSkeleton />
            <QuestionCardSkeleton />

            {/* 趋势卡 */}
            <div className="border-ink-200 rounded-xl border bg-white p-5">
              <SkeletonStatic className="h-4 w-28" />
              <SkeletonStatic className="mt-4 h-[160px] w-full rounded-lg" />
            </div>
          </div>
        </div>
      </main>
    </>
  );
}

/** 柱高**故意不等高**（见文件头说明） */
const BAR_HEIGHTS = [38, 62, 45, 74, 29, 58];

function QuestionCardSkeleton() {
  return (
    <div className="border-ink-200 rounded-xl border bg-white p-5">
      <div className="flex items-start justify-between gap-3">
        <SkeletonStatic className="h-4 w-40" />
        <SkeletonStatic className="h-6 w-[64px] rounded-full" />
      </div>

      <div className="mt-5 flex h-[120px] items-end gap-3">
        {BAR_HEIGHTS.map((height, index) => (
          <div key={index} className="flex-1" style={{ height: `${height}%` }}>
            <Skeleton className="h-full w-full rounded-t-md" />
          </div>
        ))}
      </div>

      {/* 坐标轴标签位：占位，避免图表出现时高度变化 */}
      <div className="mt-2 flex gap-3">
        {[0, 1, 2, 3].map((index) => (
          <SkeletonStatic key={index} className="h-3 w-10" />
        ))}
      </div>
    </div>
  );
}
