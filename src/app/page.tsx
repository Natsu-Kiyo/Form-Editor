import { Logo } from '@/components/icons/logo';

/**
 * 产品首页（公开）。
 *
 * 在 M11 之前这里是占位：只表达品牌与一句话定位，**不放任何按钮**——
 * 按「无假入口」规则，没有落点的入口不允许存在。
 * 这也是公开作答页那两个出口里「返回首页」的目标页。
 */
export default function HomePage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 py-24">
      <div className="bg-brand-500 flex size-11 items-center justify-center rounded-xl text-white">
        <Logo className="size-5" />
      </div>

      <h1 className="text-display text-ink-900 mt-6 font-semibold tracking-[-0.02em]">轻问卷</h1>

      <p className="text-body-s text-ink-500 mt-3 max-w-md text-center">
        面向小团队的问卷协作工具 —— 创建、发放、回收、分析，一条线走完。
      </p>
    </main>
  );
}
