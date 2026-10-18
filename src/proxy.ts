import { NextResponse, type NextRequest } from 'next/server';

/**
 * 会话 Cookie 名。刻意在这里再写一遍常量而不是 import：
 * `src/lib/auth/session.ts` 会拉起 Prisma，而 proxy 跑在每次请求（含预取）上，
 * 不能把数据库相关代码带进来。两处保持一致，改名时一起改。
 */
const SESSION_COOKIE = 'qw_session';

/**
 * 匿名作答的浏览器标识（审查 #10）。
 *
 * 由 proxy **在服务端**下发：以前只有作答页的客户端 JS 会种它，
 * 拿不到时指纹退化成 UA 哈希 —— 同一浏览器类型的所有人共用一个指纹，
 * 第一个人交完，同 UA 的其他人全被当成「已提交过」。
 */
const CLIENT_ID_COOKIE = 'qw_client_id';
const CLIENT_ID_MAX_AGE = 365 * 24 * 60 * 60;

// `/app/me` 由 `/app` 这个前缀覆盖，**不要再单独列**（列了也没有对应路由，只会误导读的人）
//
// `/invite` 也在这里（审查 #8）：邀请链接是最需要「登录后回到原处」的一条 ——
// 它不在这个列表里时，未登录访客会被页面的 `requireUser` 送去登录，
// 而 proxy 不注入路径，登录回来就落到 `/app`，链接等于丢了。
const PROTECTED_PREFIXES = ['/app', '/invite'];

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

  // 带上查询串：被拦下的可能是「筛到第 3 页」这种地址，回跳时不该丢掉条件
  const pathWithSearch = `${pathname}${request.nextUrl.search}`;

  if (isProtected && !hasSessionCookie) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('next', pathWithSearch);
    return NextResponse.redirect(loginUrl);
  }

  /*
   * 把当前路径交给服务端（审查 #8）。proxy 不查库，所以「Cookie 在、会话已过期」
   * 这一种它拦不住 —— 那一步是页面里的 `requireUser` 做最后判断，而它需要知道
   * 用户原本想去哪。没有这个头时，登录回来只能落到 `/app`。
   */
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-pathname', pathWithSearch);

  /*
   * 公开作答页：没有 `qw_client_id` 就现发一个（审查 #10）。
   *
   * 两件事都要做：
   * - 把值并进**本次请求**的 cookie 头 —— 页面在同一个请求里就能读到，
   *   于是「你已提交过」的首次渲染不依赖 JS；
   * - 在响应上 Set-Cookie —— 之后的提交（Server Action 是另一次请求）才带得上。
   */
  const existingClientId = request.cookies.get(CLIENT_ID_COOKIE)?.value;
  const issuedClientId =
    pathname.startsWith('/s/') && !existingClientId ? crypto.randomUUID() : null;

  if (issuedClientId) {
    const incoming = request.headers.get('cookie');
    requestHeaders.set(
      'cookie',
      incoming
        ? `${incoming}; ${CLIENT_ID_COOKIE}=${issuedClientId}`
        : `${CLIENT_ID_COOKIE}=${issuedClientId}`,
    );
  }

  const response = NextResponse.next({ request: { headers: requestHeaders } });

  if (issuedClientId) {
    response.cookies.set(CLIENT_ID_COOKIE, issuedClientId, {
      /*
       * **刻意不加 httpOnly**：它只是一个随机标识，不是凭据；而作答页的 JS 要能读到它
       * 并沿用同一个值。加了 httpOnly 会让客户端读不到、再生成一个，两边打架。
       */
      sameSite: 'lax',
      path: '/',
      maxAge: CLIENT_ID_MAX_AGE,
      secure: process.env.NODE_ENV === 'production',
    });
  }

  return response;
}

export const config = {
  // `/s/*` 也在这里：不是为了鉴权，而是要在服务端为匿名访客下发 `qw_client_id`（审查 #10）
  matcher: ['/app/:path*', '/invite/:path*', '/s/:path*'],
};
