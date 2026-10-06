import { prisma } from '@/lib/db';

/**
 * 健康检查。用途有二：
 *
 * 1. 部署后确认应用与数据库都活着（返回 503 比「页面打不开」更好排查）。
 * 2. **E2E 开跑前把数据库预热**：Playwright 的 globalSetup 会打这个地址一次。
 *    数据库在境外且会挂起，冷启动要十几秒 —— 那是环境的固有开销，
 *    不该由「一堆用例变红」来表达。
 *
 * 这里直接查 `SELECT 1`，不走任何 feature 的 api：健康检查问的是
 * 「连接能不能用」，与业务数据无关，硬塞进某个 feature 反而是错的归属。
 */
export const dynamic = 'force-dynamic';

export async function GET() {
  const startedAt = Date.now();

  try {
    await prisma.$queryRaw`SELECT 1`;

    return Response.json({ ok: true, elapsedMs: Date.now() - startedAt });
  } catch (error) {
    return Response.json(
      {
        ok: false,
        elapsedMs: Date.now() - startedAt,
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 503 },
    );
  }
}
