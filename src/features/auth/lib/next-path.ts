/**
 * 登录 / 注册成功后的回跳地址（审查 #8）。
 *
 * 这个值来自 URL（`?next=`），会被直接交给 `redirect()` —— 也就是一个**开放重定向**入口。
 * 所以只接受「站内相对路径」，并且把两种容易被忽略的写法一并挡掉：
 *
 * - `//evil.com`：协议相对地址，浏览器会当成外站；
 * - `/\evil.com`：**反斜杠会被浏览器归一成斜杠**，等价于上一条。
 *
 * 空值、非字符串、裸域名一律回落到 `/app` —— 这是「不知道用户想去哪」时的安全默认。
 */
export function safeNextPath(value: unknown) {
  if (typeof value !== 'string') return '/app';
  if (!value.startsWith('/') || value.startsWith('//')) return '/app';
  if (value.includes('\\') || value.includes('\n') || value.includes('\r')) return '/app';

  return value;
}
