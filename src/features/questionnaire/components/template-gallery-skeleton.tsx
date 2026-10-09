import { MobileTabBar } from '@/components/layout/mobile-tab-bar';
import { Skeleton, SkeletonStatic } from '@/components/ui/skeleton';

/**
 * 模板中心的骨架屏（设计稿 `补充.html` L03 / L10 的规矩：**形状与真实内容逐个对齐**、
 * 一律 `ink-100` 不用品牌色；对不齐的话内容一出现整页重排）。
 *
 * 抽成一个文件是因为它**两处共用**：
 * - `app/app/templates/loading.tsx`：从别的页面进模板中心时的整页等待（与成员 / 日志页同款）；
 * - `template-gallery.tsx` 切 Tab / 分类时（`isPending`）：**只替换列表区** ——
 *   Tab 与胶囊保持在场，正在点的那颗按钮不该跟着消失。
 *
 * 数量 8 张：桌面栅格是 4 列（`lg:grid-cols-4`），8 张正好铺两行；窄屏 1 列时只露出前两张。
 * 不按总数渲染十几张（与问卷列表骨架同一条规矩）。
 */
export function TemplateGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div aria-busy="true" className="qw-fade-up">
      <span role="status" className="sr-only">
        正在加载模板…
      </span>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: count }, (_, index) => (
          <TemplateCardSkeleton key={index} />
        ))}
      </div>
    </div>
  );
}

/** 单张卡骨架：与 `template-card.tsx` 的版式一一对应（缩略图 120px / 标题 / 题数 / 两个按钮） */
function TemplateCardSkeleton() {
  return (
    <div className="border-ink-200 flex flex-col overflow-hidden rounded-xl border bg-white">
      {/*
        缩略图区：高度与真实一致（120px）。真实那张是 brand 浅渐变，
        骨架按规矩换成 ink-100 —— 形状对齐、颜色不越界。
      */}
      <div className="bg-ink-100 flex h-[120px] flex-col justify-center gap-2.5 p-4">
        <SkeletonStatic className="h-2.5 w-20 rounded-full" />
        <SkeletonStatic className="h-2 w-32 rounded-full" />
        <SkeletonStatic className="h-2 w-24 rounded-full" />
      </div>

      <div className="flex flex-1 flex-col p-4">
        <Skeleton className="h-3.5 w-3/5" />
        <SkeletonStatic className="mt-2.5 h-3 w-4/5" />

        <div className="mt-3 flex gap-2">
          <SkeletonStatic className="h-8 flex-1 rounded-lg" />
          <SkeletonStatic className="h-8 flex-1 rounded-lg" />
        </div>
      </div>
    </div>
  );
}

/**
 * 整页骨架（`app/app/templates/loading.tsx` 用）。
 *
 * 顶部两块与页面一一对应：桌面顶栏（标题 + 搜索 + 新建按钮，`hidden lg:flex`，
 * 与成员 / 日志页的 loading 同款）与窄屏头部（标题 + 新建 + 通栏搜索，`lg:hidden`）——
 * 模板页在两端的头部结构差别大，只补桌面那份的话，窄屏进页面骨架的上半截是空的。
 */
export function TemplatePageSkeleton() {
  return (
    <>
      <header className="border-ink-200 hidden h-16 shrink-0 items-center justify-between gap-3 border-b bg-white px-4 sm:px-7 lg:flex">
        <SkeletonStatic className="h-5 w-20" />
        <div className="flex items-center gap-3">
          <SkeletonStatic className="rounded-btn h-9 w-40" />
          <SkeletonStatic className="rounded-btn h-9 w-[104px]" />
        </div>
      </header>

      <div className="px-5 pt-4 pb-3 lg:hidden">
        <div className="flex items-center justify-between gap-3">
          <SkeletonStatic className="h-5 w-20" />
          <SkeletonStatic className="rounded-btn h-9 w-[104px]" />
        </div>
        <SkeletonStatic className="rounded-btn mt-3 h-9 w-full" />
      </div>

      <main className="flex-1 overflow-y-auto p-6 pt-6 pb-28 sm:p-7 lg:pb-7">
        <div className="mx-auto max-w-[1180px]">
          {/* Tab 行（两个：公开模板 / 我的模板） */}
          <div className="border-ink-200 mb-5 flex h-10 items-center gap-6 border-b">
            <SkeletonStatic className="h-4 w-14" />
            <SkeletonStatic className="h-4 w-24" />
          </div>

          {/* 分类胶囊 */}
          <div className="mb-5 flex items-center gap-2">
            {[0, 1, 2, 3, 4, 5].map((index) => (
              <SkeletonStatic key={index} className="h-8 w-16 rounded-full" />
            ))}
          </div>

          <TemplateGridSkeleton />
        </div>
      </main>

      {/*
        底栏也要在场：它由**页面**自己渲染（不在 layout 里），骨架替换页面内容时
        会跟着消失一下 —— 底栏是外壳，跳页时它闪没是最容易被看见的「坏了一瞬」。
      */}
      <MobileTabBar />
    </>
  );
}
