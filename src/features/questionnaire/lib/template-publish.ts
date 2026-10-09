import { TEMPLATE_PUBLIC_CATEGORIES } from '@/config/constants';

/**
 * 模板公开的**准入规则**（X2）。
 *
 * 为什么要有这道门槛：公开池是**跨工作区可见**的（本项目第一次出现这种数据），
 * 一份「两个字的标题 + 没描述 + 空题目」的模板公开出去，是所有人都会看到的东西。
 * 三件事各管一段：
 * - **配额**（`TEMPLATE_PUBLIC_LIMIT`）：一个工作区最多往池子里放几张 —— 防「一大堆」的主闸；
 * - **内容门槛**（本文件的规则）：题数、描述、分类 —— 挡「奇怪的模板」；
 * - **限流**（action 里的 `createRateLimiter`）：防反复公开/取消公开刷库。
 *
 * **界面与服务端共用这一个函数**（与 `preflight.ts` 同一条思路）：菜单项是否可点是它，
 * 服务端放不放行也是它 —— 两处各写一份必然出现「界面说能点、服务端说不行」。
 *
 * 调用方需要保证的前置：模板是**可编辑的**（本工作区的、非官方）。
 * 官方模板不属于任何工作区、也不允许公开（它本来就是公开内容，来源不同）。
 */
export const TEMPLATE_PUBLIC_LIMIT = 10;

export const TEMPLATE_PUBLIC_RULES = {
  minQuestions: 1,
  /** 上限是防「超长 payload 进公共池」：五十道题的问卷已经超出「模板」的合理形态 */
  maxQuestions: 50,
  minDescription: 10,
  maxDescription: 120,
} as const;

export type TemplatePublishCheck = { ok: true } | { ok: false; reasons: string[] };

export function canPublishTemplate(input: {
  description: string;
  questionCount: number;
  category: string;
  /** 本工作区**已公开**的模板数量（由调用方查库传进来） */
  publicCount: number;
}): TemplatePublishCheck {
  const reasons: string[] = [];
  const { description, questionCount, category, publicCount } = input;
  const descriptionLength = description.trim().length;

  if (publicCount >= TEMPLATE_PUBLIC_LIMIT) {
    reasons.push(`本工作区已公开 ${TEMPLATE_PUBLIC_LIMIT} 张（上限），先取消一些再公开`);
  }

  if (questionCount < TEMPLATE_PUBLIC_RULES.minQuestions) {
    reasons.push('空的模板不能公开，先加一道题');
  } else if (questionCount > TEMPLATE_PUBLIC_RULES.maxQuestions) {
    reasons.push(`模板最多 ${TEMPLATE_PUBLIC_RULES.maxQuestions} 道题，这份太多了`);
  }

  if (descriptionLength < TEMPLATE_PUBLIC_RULES.minDescription) {
    reasons.push(
      `公开的模板需要一段 ${TEMPLATE_PUBLIC_RULES.minDescription} 个字以上的说明，让别人知道它是什么`,
    );
  } else if (descriptionLength > TEMPLATE_PUBLIC_RULES.maxDescription) {
    reasons.push(`模板说明不超过 ${TEMPLATE_PUBLIC_RULES.maxDescription} 个字`);
  }

  // 公开池的分类只有六个：官方五类 + 「其他」（兜底）。自建分类不进公共池 ——
  // 弹层里会把「其他」预先选好，走弹层的用户碰不到这条，它是防绕过的那道。
  if (!(TEMPLATE_PUBLIC_CATEGORIES as readonly string[]).includes(category)) {
    reasons.push('公开的模板要从公开分类里选一个（官方五类之外的选「其他」）');
  }

  return reasons.length > 0 ? { ok: false, reasons } : { ok: true };
}
