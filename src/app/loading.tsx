import { StartupSplash } from '@/components/layout/startup-splash';

/**
 * 根段的等待态（设计稿 `补充.html` L01「启动 / 会话校验」）。
 *
 * 为什么在这一层：`app/app/layout.tsx` 在首屏要 `requireUser()` + 解析活动工作区 ——
 * **外壳本身还没渲染出来**，所以这段时间的兜底只能挂在它的父段（也就是这里）。
 * 这也是设计稿说的「唯一允许占满全屏的加载态，因为此刻还没有任何版式可以搭骨架」。
 *
 * 文案由 `StartupSplash` 按当前路径决定：`/app` 下说的是「正在准备工作区 / 正在校验登录状态」，
 * 其它页面（登录、公开作答等）说「正在加载…」—— 在公开作答页上说「校验登录状态」是错的，
 * 而根段这一层**同时覆盖了它们**（它们没有自己的 loading 文件）。
 */
export default function RootLoading() {
  return <StartupSplash />;
}
