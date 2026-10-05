import type { z } from 'zod';

/**
 * 把 zod 的校验错误摊平成「字段名 → 错误文案数组」。
 *
 * 为什么不直接用 zod 自带的 flatten：这里只依赖 `error.issues`，是最稳定的部分；
 * 字段名直接对应表单控件的 `name`，界面层不需要再做一次映射。
 */
export function toFieldErrors(error: z.ZodError): Record<string, string[]> {
  const fieldErrors: Record<string, string[]> = {};

  for (const issue of error.issues) {
    const key = issue.path[0];
    if (typeof key !== 'string') continue;
    fieldErrors[key] = [...(fieldErrors[key] ?? []), issue.message];
  }

  return fieldErrors;
}
