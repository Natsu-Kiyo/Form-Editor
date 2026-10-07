import { redirect } from 'next/navigation';

import { getCurrentUser } from '@/lib/auth/dal';

/**
 * 根路由**只做导航**，自己不渲染任何东西。
 *
 * 原先这里是一张品牌占位页（logo + 一句话定位），当时的理由是「M11 之前不放假入口」。
 * 但实测下来它是**纯粹的过路页**：从启动到开始干活必须多点一次，而它既不提供入口、
 * 也不提供信息。所以改成**按登录态直接分流**：
 *
 * - 已登录 → `/app`（工作台）
 * - 未登录 → `/login`
 *
 * 这也是公开作答页那两个出口里「返回首页」的目标页：作答者点它时会按自己的登录态分流。
 * 判断用 `getCurrentUser`（唯一会话校验入口）而不是 `requireUser` —— 后者未登录时自己就
 * 重定向走了，这里需要的是「先问一声」。
 */
export default async function HomePage() {
  const user = await getCurrentUser();

  redirect(user ? '/app' : '/login');
}
