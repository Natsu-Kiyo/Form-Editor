import { createEnv } from '@t3-oss/env-nextjs';
import { z } from 'zod';

/**
 * 环境变量唯一入口：缺失或格式错误时**启动/构建即失败**，而不是等线上报错。
 * 新增环境变量时必须同时更新：本文件、.env.example、docs/PLAN.md §10.2。
 */
export const env = createEnv({
  server: {
    /** 运行时连接串（生产为 Neon 池化连接串） */
    DATABASE_URL: z.string().min(1),
    /** 迁移专用直连串；仅在执行 prisma migrate 时需要 */
    DIRECT_URL: z.string().min(1).optional(),
  },
  client: {
    /** 应用对外地址（短链与二维码内容依赖它） */
    NEXT_PUBLIC_APP_URL: z.url(),
  },
  runtimeEnv: {
    DATABASE_URL: process.env.DATABASE_URL,
    DIRECT_URL: process.env.DIRECT_URL,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  },
  emptyStringAsUndefined: true,
});
