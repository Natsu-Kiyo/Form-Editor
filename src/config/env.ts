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
    /**
     * 应用对外地址（短链与二维码内容依赖它）。
     *
     * 名字带 `NEXT_PUBLIC_`，但**本项目只在服务端读它** —— 客户端要取地址一律用
     * `window.location.origin`（见 `features/members/components/members-panel.tsx`）。
     * 所以下面那句「没配就取平台域名」是安全的：不会在浏览器里求值。
     */
    NEXT_PUBLIC_APP_URL: z.url(),
  },
  runtimeEnv: {
    DATABASE_URL: process.env.DATABASE_URL,
    DIRECT_URL: process.env.DIRECT_URL,
    NEXT_PUBLIC_APP_URL: resolveAppUrl(),
  },
  emptyStringAsUndefined: true,
});

/**
 * 应用对外地址：**显式配置优先，其次取平台给的域名**。
 *
 * 为什么要有第二档：这个值必须在**部署成功之前**就填好（构建期就要校验），
 * 而那时你还不知道平台会分给你哪个域名 —— `<项目名>.vercel.app` 很可能已被占用。
 * 于是部署链条上多出一次「先失败一遍 → 拿到域名 → 改值 → 重新部署」的来回，
 * 以后换自定义域名还得再走一遍。Vercel 会把域名注入成环境变量，直接用它就没有这个问题：
 *
 * - `VERCEL_PROJECT_PRODUCTION_URL`：项目的**生产**域名（绑了自定义域名时就是自定义域名）
 * - `VERCEL_URL`：**本次部署**的域名 —— 预览部署靠它指向自己，而不是指向生产
 *
 * 两者都没有（本地开发、自托管）时返回 undefined，交给 schema 报错拦下。
 * **不能悄悄拼一个兜底地址**：短链与二维码上都印着它，错了是发出去之后才发现。
 */
function resolveAppUrl() {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL;

  const host = process.env.VERCEL_PROJECT_PRODUCTION_URL ?? process.env.VERCEL_URL;
  return host ? `https://${host}` : undefined;
}
