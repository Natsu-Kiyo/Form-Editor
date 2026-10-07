import { Skeleton, SkeletonStatic } from '@/components/ui/skeleton';

/**
 * 公开作答页的等待态。
 *
 * **它同时修掉一个措辞错误**：这之前，`/s/[slug]` 会落到根段的启动兜底上，
 * 而那里写的是「正在校验登录状态…」—— 作答者根本没登录，那句话是错的。
 * 公开端有自己的 loading 之后，就说自己的话（「正在加载问卷…」）。
 *
 * 形状按作答页来：标题 + 说明 + 几道题的卡片（题干 + 选项圈），
 * 这样内容到位时不会整页重排。
 *
 * 刻意**不做**花哨的东西：公众页面对陌生访客，慢一点点也比看到一个跳来跳去的骨架强。
 */
export default function PublicQuestionnaireLoading() {
  return (
    <main className="bg-ink-50 min-h-[100dvh] px-4 py-10">
      <div aria-busy="true" className="qw-fade-up mx-auto w-full max-w-[640px]">
        <span role="status" className="sr-only">
          正在加载问卷…
        </span>

        <SkeletonStatic className="mb-4 h-6 w-40" />
        <Skeleton className="h-7 w-3/5" />

        <div className="mt-8 space-y-4">
          {[0, 1, 2].map((index) => (
            <div key={index} className="border-ink-200 rounded-xl border bg-white p-5">
              <SkeletonStatic className="h-4 w-2/5" />
              <div className="mt-4 space-y-2.5">
                {[0, 1, 2].map((option) => (
                  <div key={option} className="flex items-center gap-2.5">
                    <SkeletonStatic className="size-4 rounded-full" />
                    <Skeleton className="h-3.5 w-1/3" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
