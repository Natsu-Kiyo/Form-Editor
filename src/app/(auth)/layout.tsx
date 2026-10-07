import { redirect } from 'next/navigation';

import { BrandPanel, BrandPanelCompact } from '@/features/auth/components/brand-panel';
import { getCurrentUser } from '@/lib/auth/dal';

/**
 * W01 两态（登录 / 注册）共用的版式：
 * 左侧品牌面板 + 右侧 360px 表单区，**只换右侧表单内容**。
 *
 * 设计稿画了三态（含找回密码）。**所有者决定不提供找回密码** ——
 * 它必须有真实邮件投递才成立，未接入时会留下一个「点了没反应」的入口。
 * 因此这里只有两态，`/forgot-password` 与 `/reset-password/[token]` 都已移除。
 *
 * 窄屏（<1024px）收起品牌面板，改用顶部的紧凑 logo 头部 ——
 * 设计稿说「移动端复用同一套响应式版式」，所以这里不另起一套页面。
 */
export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  /*
   * 「已登录就别再看登录页」在这里做，**不在 proxy 里** —— 两者的信息源不同：
   * proxy 只认 Cookie 在不在，而 Cookie 可能比库里的会话活得更久；这里查的是真会话，
   * 判断一定准，也就不会出现「`/login` 送去 `/app`、`/app` 又送回 `/login`」那种死循环
   * （详见 `src/proxy.ts` 顶部的说明）。
   */
  const user = await getCurrentUser();
  if (user) redirect('/app');

  return (
    <div className="flex min-h-full flex-1 bg-white">
      <BrandPanel />

      <div className="flex flex-1 items-center justify-center bg-white px-6 py-10 sm:px-10">
        <div className="w-full max-w-[360px]">
          <BrandPanelCompact />
          {children}
        </div>
      </div>
    </div>
  );
}
