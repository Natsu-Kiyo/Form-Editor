/**
 * 数据库连通性自检。
 *
 * 用法：pnpm db:check
 *
 * 刻意走 `@/lib/db` 这条**真实路径**（Prisma 7 + pg driver adapter + 池化连接串 DATABASE_URL），
 * 而不是另起一个 PrismaClient —— 否则测不到真正会出问题的那层配置。
 *
 * 两个容易踩的地方（都已在 package.json 的 db:check 脚本里处理）：
 * 1. `src/lib/db.ts` 首行是 `import 'server-only'`，它的 default 条件会直接抛错，
 *    因此必须带 `--conditions=react-server` 运行。
 * 2. 纯 Node 不会自动读取 `.env`（那是 Next.js 的行为），所以要显式 `--env-file-if-exists=.env`，
 *    否则 zod 校验会以「Invalid environment variables」失败。
 */
import { prisma } from '@/lib/db';

async function main() {
  const rows = await prisma.$queryRaw<{ ok: number }[]>`SELECT 1 AS ok`;

  if (rows[0]?.ok !== 1) {
    throw new Error(`意外的查询结果：${JSON.stringify(rows)}`);
  }

  console.log('[db] 连通正常（Prisma 7 + @prisma/adapter-pg，走 DATABASE_URL 池化连接）');
  await prisma.$disconnect();
}

main().catch(async (error: unknown) => {
  console.error('[db] 连通失败：', error);
  process.exitCode = 1;
});
