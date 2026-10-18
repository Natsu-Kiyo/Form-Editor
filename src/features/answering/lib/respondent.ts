import type { IdentityMode } from '@/config/constants';

import { buildFingerprint } from './fingerprint';

export type Respondent = {
  /** 登录作答时记的账号；**匿名问卷恒为 null** */
  respondentId: string | null;
  /** 匿名判定用的浏览器指纹；记了账号时恒为 null（账号本身就是唯一键） */
  fingerprint: string | null;
};

/**
 * 「这份答卷算谁的」—— 提交链路上唯一决定身份的地方（审查 #2）。
 *
 * 两条不变量，缺一条都会出事：
 *
 * 1. **`ANONYMOUS` 一律不记账号**。以前只要访问者恰好登录着，匿名问卷也会写
 *    `respondentId`：公开页说「不会记录你的身份信息」，结果库里记着他是谁 ——
 *    承诺与数据不符。而查重又会因为「有账号就按账号查」而绕过指纹，
 *    于是他先匿名、再登录（或反过来）就能交两份。
 * 2. **记了账号就不记指纹**。同一账号在第二台设备上也该只交一次；
 *    记上指纹反而会把他挡在门外（误判成另一个人）。
 *
 * 刻意写成纯函数：这是提交链路上最容易「看着对、实际反了」的一段，
 * 而它没有任何 IO，正好能穷举。
 */
export function resolveRespondent(input: {
  identityMode: IdentityMode;
  userId: string | null;
  clientId: string | null;
  userAgent: string | null;
}): Respondent {
  const anonymous = input.identityMode === 'ANONYMOUS';
  const respondentId = anonymous ? null : input.userId;

  return {
    respondentId,
    fingerprint: respondentId ? null : buildFingerprint(input.clientId, input.userAgent),
  };
}
