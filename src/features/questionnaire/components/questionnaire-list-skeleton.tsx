import { Skeleton, SkeletonStatic } from '@/components/ui/skeleton';

/**
 * 问卷列表的骨架屏（设计稿 `补充.html` L03）。
 *
 * **形状与真实卡片逐个对齐**，这是这一节最硬的规矩：状态胶囊、右上「⋯」、标题行、
 * 两行描述、回收进度数字行、进度条、底部分隔线 + 三个按钮位 —— 一个都不能少，
 * 连内边距都用同一个（`p-5` / `rounded-xl` / `border-ink-200`）。
 * 对不齐的话，内容一出现整页重排，而列表是这个项目打开频率最高的页面。
 *
 * 数量按**首屏可视区**给（见下面栅格处的说明），不是按总数渲染十几张。
 *
 * 顶部那一条（顶栏 + 汇总卡 + 工具条）是**本项目的必要补充**：设计稿的 L03 只画了卡片，
 * 因为它的前提是「顶栏属于外壳、跳转时还在」；而我们这里顶栏是**页面自己渲染**的
 * （设计稿 W02 每页标题与主操作都不同，见 `topbar.tsx` 的说明），页面进 loading 时它会一起消失 ——
 * 不补这一段，每次跳转都会看见「顶栏闪一下再回来」。
 */
export function QuestionnaireListSkeleton() {
  return (
    <>
      {/* 顶栏占位：标题与主操作各留一块，高度与真实顶栏一致（h-16） */}
      <header className="border-ink-200 hidden h-16 shrink-0 items-center justify-between gap-3 border-b bg-white px-4 sm:px-7 lg:flex">
        <SkeletonStatic className="h-5 w-20" />
        <SkeletonStatic className="rounded-btn h-9 w-[104px]" />
      </header>

      <main className="mx-auto min-h-0 w-full max-w-[1180px] flex-1 overflow-y-auto px-6 pt-6 pb-28 lg:py-7">
        <div aria-busy="true" className="qw-fade-up">
          <span role="status" className="sr-only">
            正在加载问卷列表…
          </span>

          {/* 汇总卡：三张并排（真实页面就在这个位置） */}
          <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
            {[0, 1, 2].map((index) => (
              <div key={index} className="border-ink-200 rounded-xl border bg-white p-5">
                <SkeletonStatic className="h-3.5 w-16" />
                <Skeleton className="mt-3 h-7 w-12" />
              </div>
            ))}
          </div>

          {/* 工具条：搜索框 + 筛选项 */}
          <div className="mb-5 flex items-center gap-3">
            <SkeletonStatic className="rounded-btn h-10 w-[240px]" />
            <SkeletonStatic className="rounded-btn h-10 w-[120px]" />
          </div>

          {/*
            6 张而不是设计稿举例的 3 张：栅格是 `md:2 列 / xl:3 列`，3 张在 2 列宽度下
            正好铺成 2 + 1，右下角空一格 —— 看起来像"少了东西"而不是"在加载"。
            6 张两种列宽都能铺成整行，仍然只是两屏内的量，不会按总数渲染十几张。
          */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {[0, 1, 2, 3, 4, 5].map((index) => (
              <QuestionnaireCardSkeleton key={index} />
            ))}
          </div>
        </div>
      </main>
    </>
  );
}

/** 单张卡片骨架：与 `questionnaire-card.tsx` 的版式一一对应 */
function QuestionnaireCardSkeleton() {
  return (
    <div className="border-ink-200 flex flex-col rounded-xl border bg-white p-5">
      {/* 状态胶囊（含圆点）+ 右上「⋯」 */}
      <div className="mb-3 flex items-start justify-between gap-2">
        <SkeletonStatic className="h-6 w-[76px] rounded-full" />
        <SkeletonStatic className="size-8 rounded-lg" />
      </div>

      {/* 标题行 + 两行描述 */}
      <Skeleton className="h-5 w-3/5" />
      <SkeletonStatic className="mt-2.5 h-3.5 w-full" />
      <SkeletonStatic className="mt-2 h-3.5 w-4/5" />

      {/* 回收进度：左标签、右数字 */}
      <div className="mt-5 flex items-center justify-between">
        <SkeletonStatic className="h-3.5 w-14" />
        <SkeletonStatic className="h-3.5 w-10" />
      </div>

      {/* 进度条 */}
      <SkeletonStatic className="mt-2 h-1.5 w-full rounded-full" />

      {/* 底部分隔线 + 三个按钮位 */}
      <div className="border-ink-100 mt-4 flex items-center gap-2 border-t pt-3.5">
        <SkeletonStatic className="h-8 flex-1 rounded-lg" />
        <SkeletonStatic className="h-8 flex-1 rounded-lg" />
        <SkeletonStatic className="h-8 flex-1 rounded-lg" />
      </div>
    </div>
  );
}
