/**
 * 把 PostgreSQL 连接串的 `sslmode` 钉死为 `verify-full`。
 *
 * 为什么需要它：Neon（以及多数托管 Postgres）给的连接串写的是 `sslmode=require`。
 * pg **目前**把 require 当 verify-full 处理，但 pg 9 起 require 会变成更宽松的
 * libpq 语义 —— **不校验证书链与主机名**。也就是说，光升级一次依赖就会静默降低安全性，
 * 而现在唯一的提示是一段警告。
 *
 * 生产环境的连接串由 Vercel 的 Neon 集成注入，值不受我们控制；
 * 与其依赖「部署时记得手动覆盖环境变量」，不如在**唯一出口**处把它钉死，
 * 这样无论平台注入什么，行为都是确定的。
 *
 * 两点刻意保留：
 * - **只改 query，不碰 userinfo 与路径。** 用 URL 对象整体往返会重新编码密码，
 *   那正是最容易出事的地方；所以这里只在第一个 `?` 之后做参数级替换。
 * - **本地与显式关闭不动。** 本地 Docker 的 Postgres 通常没有 TLS，
 *   对回环地址强行 verify-full 会把开发环境打死；`sslmode=disable` 视为操作者的明确选择。
 */

const FORCED_SSLMODE = 'verify-full';

/** 与 sslmode 冲突、或会改写其语义的参数，一并去掉，免得两个开关打架 */
const CONFLICTING_PARAMS = ['ssl', 'uselibpqcompat'];

/** 回环地址不强制 TLS —— 本地实例一般没有证书 */
const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

function isLocalOrDisabled(rawUrl: string, params: URLSearchParams) {
  // 显式 disable 是操作者的决定，尊重它
  if (params.get('sslmode') === 'disable') return true;

  try {
    // 这里只**读** hostname，不用它重建连接串，所以不存在重编码风险
    return LOOPBACK_HOSTS.has(new URL(rawUrl).hostname);
  } catch {
    // 解析不了就不要自作主张，原样放行，交给下游报明确的错
    return true;
  }
}

export function withVerifiedTls(rawUrl: string): string {
  const questionMark = rawUrl.indexOf('?');
  const base = questionMark === -1 ? rawUrl : rawUrl.slice(0, questionMark);
  const query = questionMark === -1 ? '' : rawUrl.slice(questionMark + 1);

  const params = new URLSearchParams(query);
  if (isLocalOrDisabled(rawUrl, params)) return rawUrl;

  // URLSearchParams.set 会先删掉同名参数再追加，所以重复的 sslmode 也一并收敛
  params.set('sslmode', FORCED_SSLMODE);
  for (const name of CONFLICTING_PARAMS) params.delete(name);

  const nextQuery = params.toString();
  return nextQuery ? `${base}?${nextQuery}` : base;
}
