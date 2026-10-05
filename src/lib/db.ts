import 'server-only';

import { PrismaPg } from '@prisma/adapter-pg';

import { env } from '@/config/env';
import { PrismaClient } from '@/generated/prisma/client';
import { withVerifiedTls } from '@/lib/database-url';

/**
 * 全应用唯一的数据库访问出口。
 *
 * 规则（见 AGENTS.md）：
 * - 组件与 Server Action 都不得自行 `new PrismaClient()`。
 * - 所有查询写在 `src/features/<name>/api/*.ts`，并在文件首行 `import 'server-only'`。
 *
 * Prisma 7 起 SQL 客户端不再带 Rust 引擎，必须显式传入 driver adapter。
 * 连接数故意压到 1：Serverless 每个实例只需一条连接；真正的池化由 Neon 的
 * **池化主机名**（`...-pooler...`）承担，而不是连接串参数。
 *
 * 连接串过一道 `withVerifiedTls`：生产环境的 DATABASE_URL 由平台注入、
 * 值不受我们控制，TLS 强度要在我们自己的代码里钉死（见该文件顶部说明）。
 */
function createPrismaClient() {
  const adapter = new PrismaPg({
    connectionString: withVerifiedTls(env.DATABASE_URL),
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
