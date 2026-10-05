import { NextResponse, type NextRequest } from 'next/server';

/**
 * 会话 Cookie 名。刻意在这里再写一遍常量而不是 import：
 * `src/lib/auth/session.ts` 会拉起 Prisma，而 proxy 跑在每次请求（含预取）上，
 * 不能把数据库相关代码带进来。两处保持一致，改名时一起改。
 */
const SESSION_COOKIE = 'qw_session';

const PROTECTED_PREFIXES = ['/app', '/me'];
/** 已登录用户不该再看到这些页 */
const GUEST_ONLY_PATHS = ['/login', '/register'];

/**
 * 乐观鉴权（Next 16 起 Middleware 更名为 Proxy）。
 *
 * 它**只看 Cookie 在不在，不查库**，因此不是安全边界 ——
 * 真正的授权判断在每个数据函数与 Server Action 里（见 src/lib/auth/dal.ts）。
 * 之所以这么切：proxy 会在每次请求（含预取的路由）上运行，查库会直接拖垮性能。
 * 详见 Next 16 文档 guides/authentication → "Optimistic checks with Proxy"。
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

  const isGuestOnly = GUEST_ONLY_PATHS.some((path) => pathname === path);

  if (isGuestOnly && hasSessionCookie) {
    return NextResponse.redirect(new URL('/app', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/app/:path*', '/me', '/login', '/register'],
};
