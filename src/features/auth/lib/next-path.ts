/**
 * 登录 / 注册成功后的回跳地址（审查 #8）。
 *
 * 这个值来自 URL（`?next=`），会被直接交给 `redirect()` —— 也就是一个**开放重定向**入口。
 * 所以只接受「站内相对路径」。
 *
 * **不要靠枚举字符黑名单**：URL 解析器会在解析前**删掉制表符与换行**
 * （`/\t/evil.com` 会被当成 `//evil.com` → 外站），黑名单永远慢一步。
 * 这里改成「用 URL 解析，再看它落到哪个 origin」：只要解析出来不是我们的哨兵 origin，
 * 就不是站内路径。控制字符另行整段拒绝（`\u0000`–`\u001f`、`\u007f`）——
 * 它们即便不改变 origin，也不该出现在跳转地址里。
 */
const INTERNAL_ORIGIN = 'http://internal.invalid';

export function safeNextPath(value: unknown) {
  if (typeof value !== 'string' || !value.startsWith('/')) return '/app';
  // 控制字符：URL 解析器会删掉 \t \n \r（`/\t/evil.com` → `//evil.com`），整段拒绝最省事
  if (/[\u0000-\u001f\u007f]/.test(value)) return '/app';
  // 反斜杠会被浏览器归一成斜杠：`/\evil.com` 等价于 `//evil.com`
  if (value.includes('\\')) return '/app';

  try {
    const url = new URL(value, INTERNAL_ORIGIN);

    if (url.origin !== INTERNAL_ORIGIN) return '/app';

    // 返回**解析后**的地址：原文里的各种怪写法（`/./app`、重复斜杠）都已被归一
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return '/app';
  }
}
