/**
 * 从 `searchParams` 里取一个字符串参数（审查 #6）。
 *
 * Next 的值是 `string | string[] | undefined`：`?q=a&q=b` 会被解析成数组。
 * 页面若按 `string` 收窄，`.trim()` 会抛 `TypeError`，而把它直接传给 Prisma
 * 会触发运行时校验错误 —— 两种都是**无需登录就能触发的 500**（公开作答页也有）。
 *
 * 口径：数组取第一个，空串与空数组回落到 `undefined`（与「没传这个参数」等价，
 * 调用方的白名单与默认值逻辑都不用改）。
 */
export function firstParam(value: string | string[] | undefined | null): string | undefined {
  const raw = Array.isArray(value) ? value[0] : value;

  return typeof raw === 'string' && raw.length > 0 ? raw : undefined;
}
