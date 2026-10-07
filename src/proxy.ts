import { NextResponse, type NextRequest } from 'next/server';

/**
 * 会话 Cookie 名。刻意在这里再写一遍常量而不是 import：
 * `src/lib/auth/session.ts` 会拉起 Prisma，而 proxy 跑在每次请求（含预取）上，
 * 不能把数据库相关代码带进来。两处保持一致，改名时一起改。
 */
const SESSION_COOKIE = 'qw_session';

const PROTECTED_PREFIXES = ['/app', '/me'];

/**
 * 乐观鉴权（Next 16 起 Middleware 更名为 Proxy）。
 *
 * 它**只看 Cookie 在不在，不查库**，因此不是安全边界 ——
 * 真正的授权判断在每个数据函数与 Server Action 里（见 src/lib/auth/dal.ts）。
 * 之所以这么切：proxy 会在每次请求（含预取的路由）上运行，查库会直接拖垮性能。
 * 详见 Next 16 文档 guides/authentication → "Optimistic checks with Proxy"。
 *
 * **这里只做「拦住未登录」，不做「赶走已登录」** —— 曾经有一条
 * `if (pathname === '/login' && hasSessionCookie) redirect('/app')`，
 * 它制造了一个**解不开的死循环**：
 *
 * - Cookie 在、库里的会话已失效（退出登录时 Cookie 的清理由响应头带出，
 *   那一步没落地就会留下这个孤儿 Cookie）
 * - `/login` 看 Cookie → 送去 `/app`；`/app` 查库发现没有会话 → 送回 `/login`
 * - 两边互相踢，浏览器在 `/login` ↔ `/app` 之间无限跳，页面永远出不来
 *   （E2E 里表现为「等元素等到 240 秒超时」，且导航日志来回两页）
 *
 * 为什么只有这一侧能留在 proxy：「拦住未登录」在 Cookie 缺失时**顶多多拦一次**，
 * 用户再登一次就好；而「赶走已登录」在信号不准时会**绕不出来**。
 * 「已登录就别看登录页」这条体验改到了 `(auth)/layout.tsx` 里做，
 * 那里能查库、判断一定准。
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasSessionCookie = Boolean(request.cookies.get(SESSION_COOKIE)?.value);

  const isProtected = PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );

  if (isProtected && !hasSessionCookie) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('next', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/app/:path*', '/me'],
};
