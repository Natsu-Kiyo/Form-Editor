import 'server-only';

import { PrismaPg } from '@prisma/adapter-pg';

import { env } from '@/config/env';
import { PrismaClient } from '@/generated/prisma/client';

/**
 * 全应用唯一的数据库访问出口。
 *
 * 规则（见 AGENTS.md）：
 * - 组件与 Server Action 都不得自行 `new PrismaClient()`。
 * - 所有查询写在 `src/features/<name>/api/*.ts`，并在文件首行 `import 'server-only'`。
 *
 * Prisma 7 起 SQL 客户端不再带 Rust 引擎，必须显式传入 driver adapter。
 * 连接数故意压到 1：Serverless 每个实例只需一条连接，真正的池化交给
 * Neon 的 pgbouncer（DATABASE_URL 上的 `pgbouncer=true`）。
 */
function createPrismaClient() {
  const adapter = new PrismaPg({
    connectionString: env.DATABASE_URL,
    max: 1,
    connectionTimeoutMillis: 5_000,
  });

  return new PrismaClient({ adapter });
}

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') {
  // 开发环境下热更新会重复执行模块，缓存到 globalThis 避免连接泄漏
  globalForPrisma.prisma = prisma;
}
