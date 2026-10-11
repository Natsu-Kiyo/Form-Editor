import { z } from 'zod';

/**
 * 标记无效 / 恢复有效的入参。
 *
 * 为什么要过 zod（R91 · N2）：Server Action 的参数是**客户端可控的入参** ——
 * `input.reason?.trim()` 对非字符串会抛 `TypeError`（→ 500），`invalid` 用真值判断
 * 则会把字符串 `'false'` 当成真。项目里其余 action 一律「zod → 权限断言 → 落库」，
 * 这条是补齐，不是新增规则。
 */
export const setResponseValiditySchema = z.object({
  responseId: z.string().min(1),
  invalid: z.boolean(),
  /**
   * 标无效的原因（可选，会写进 `invalidReason`）。
   *
   * 200 字与题目/说明同一量级。界面目前**还没有**这个输入框（调用点只传 id 与 invalid），
   * 这里先把规矩立住：将来接上输入框时口径已经在了，伪造请求也灌不进一兆的文本。
   */
  reason: z.string().trim().max(200, { error: '原因不超过 200 个字' }).optional(),
});

export type SetResponseValidityInput = z.infer<typeof setResponseValiditySchema>;
