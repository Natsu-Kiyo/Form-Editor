import { z } from 'zod';

import { parseDateTimeLocal } from '@/utils/format';

/**
 * 发布设置。
 *
 * 时间与上限都以**输入框的字符串**形式校验（`''` 表示「不设置」），
 * 这样错误能稳稳落在对应字段上；真正的业务规则（时间先后、上限与已回收量的矛盾、
 * 题目完整性）不在这里，而在 `lib/preflight.ts` —— 那份规则界面与服务端**共用一份**。
 */
const optionalDateTime = (label: string) =>
  z
    .string()
    .trim()
    .refine((value) => value === '' || parseDateTimeLocal(value) !== null, {
      error: `${label}格式不正确`,
    });

export const publishSettingsSchema = z
  .object({
    startsAt: optionalDateTime('开始时间'),
    endsAt: optionalDateTime('结束时间'),
    responseLimit: z
      .string()
      .trim()
      .refine((value) => value === '' || /^\d{1,6}$/.test(value), { error: '回收上限请填整数' }),
    identityMode: z.enum(['ANONYMOUS', 'LOGIN_REQUIRED', 'PASSWORD'], {
      error: '请选择作答身份',
    }),
    // 口令留空不算错：已经设过口令的问卷改别的设置时不必重填（服务端沿用旧口令）。
    // 「选了口令访问却一个口令都没有」由发布前检查拦（它才知道库里已有口令没）
    password: z
      .string()
      .trim()
      .max(64, { error: '口令不超过 64 位' })
      .refine((value) => value === '' || value.length >= 4, { error: '口令至少 4 位' }),
  })
  .superRefine((value, ctx) => {
    const startsAt = parseDateTimeLocal(value.startsAt);
    const endsAt = parseDateTimeLocal(value.endsAt);

    if (startsAt && endsAt && endsAt.getTime() <= startsAt.getTime()) {
      ctx.addIssue({ code: 'custom', path: ['endsAt'], message: '结束时间必须晚于开始时间' });
    }
  });

export type PublishSettingsInput = z.infer<typeof publishSettingsSchema>;

/**
 * 新建渠道。
 *
 * 链接参数允许留空 —— 由服务端按渠道名推一个（中文名推不出拉丁串，会落成 `ch-xxxxxx`）。
 * 填了就要合规矩：`?src=` 出现在链接里，混进空格、问号、中文都只会拼出坏链接。
 */
export const createChannelSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, { error: '请填写渠道名称' })
    .max(20, { error: '渠道名称不超过 20 个字' }),
  srcToken: z
    .string()
    .trim()
    .max(20, { error: '链接参数不超过 20 个字符' })
    .refine((value) => value === '' || /^[a-zA-Z0-9_-]+$/.test(value), {
      error: '链接参数只能用字母、数字、连字符和下划线',
    }),
});

export type CreateChannelInput = z.infer<typeof createChannelSchema>;
