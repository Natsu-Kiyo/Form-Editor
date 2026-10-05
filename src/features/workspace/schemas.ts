import { z } from 'zod';

export const createWorkspaceSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, { error: '请输入工作区名称' })
    .max(32, { error: '名称不超过 32 个字' }),
});
