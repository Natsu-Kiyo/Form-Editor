import 'dotenv/config';

import { defineConfig } from 'prisma/config';

/**
 * Prisma CLI 配置（Prisma 7 起，连接串从 schema.prisma 移到这里）。
 *
 * 为什么 CLI 用 DIRECT_URL 而不是 DATABASE_URL：
 * - DATABASE_URL 是**运行时**连接串，生产环境指向 Neon 的池化地址（pgbouncer）。
 *   池化连接不支持迁移所需的 schema diff 与 shadow database。
 * - DIRECT_URL 是**直连**地址，专门给 prisma migrate / studio 用。
 * - 应用运行时的连接在 src/lib/db.ts 里由 driver adapter 建立，用的是 DATABASE_URL。
 *
 * 只配了 DATABASE_URL（例如本地单实例 Postgres）时，自动回落到它。
 */
const migrationUrl = process.env.DIRECT_URL || process.env.DATABASE_URL;

if (!migrationUrl) {
  throw new Error(
    '缺少 DIRECT_URL / DATABASE_URL —— Prisma CLI 需要一个直连的 PostgreSQL 连接串。参考 .env.example。',
  );
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    // 两个开关都是必须的：
    // - --conditions=react-server：种子脚本会 import @/lib/db，那里首行是 `import 'server-only'`
    // - --env-file-if-exists=.env：纯 Node 不会自动读 .env（那是 Next.js 的行为）
    seed: 'node --env-file-if-exists=.env --import tsx --conditions=react-server prisma/seed.ts',
  },
  datasource: {
    url: migrationUrl,
  },
});
