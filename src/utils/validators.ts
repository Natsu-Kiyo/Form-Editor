import { z } from 'zod';

/**
 * 跨 feature 共用的 zod 基本规则。
 *
 * 放在 shared 层而不是某个 feature 里：注册、改密码都要用同一套密码强度规则，
 * 而 features 之间禁止互相导入 —— 各自写一份必然会漂移
 * （出现「注册要求 8 位、改密码只要 6 位」这种不一致）。
 */

/**
 * 邮箱：**先去空格、再转小写，最后才做格式校验**。
 * 顺序不能反 —— 否则 " A@B.com " 会被判成非法邮箱。
 */
export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email({ error: '请输入有效的邮箱地址' }));

/** 密码强度：至少 8 位，且同时含字母与数字 */
export const newPasswordSchema = z
  .string()
  .min(8, { error: '密码至少 8 位' })
  .regex(/[a-zA-Z]/, { error: '密码需包含至少一个字母' })
  .regex(/[0-9]/, { error: '密码需包含至少一个数字' });
