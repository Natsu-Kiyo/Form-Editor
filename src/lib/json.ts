import type { Prisma } from '@/generated/prisma/client';

/**
 * 写 JSON 列的统一入口。
 *
 * Prisma 的 Json 列只接受它自己的 `InputJsonValue`，而项目里要写入的都是
 * zod 校验过的普通对象（`Record<string, unknown>`）。**转换只在这一处做** ——
 * 散在各个写库的地方会出现「这里 cast 了、那里忘了」，而漏掉的地方报的错
 * 与真实原因毫无关系，很难查。
 */
export function toJsonColumn<T>(value: T): Prisma.InputJsonValue;
export function toJsonColumn<T>(value: T | null | undefined): Prisma.InputJsonValue | undefined;
export function toJsonColumn<T>(value: T | null | undefined) {
  return value === null || value === undefined ? undefined : (value as Prisma.InputJsonValue);
}
