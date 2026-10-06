/**
 * 清理过期操作日志（G4）。
 *
 * 用法：`pnpm db:prune-logs`
 * 排程由外部负责（部署时挂定时任务 / Cron）—— 脚本只做一次清理，不做常驻。
 */
import { LOG_RETENTION_DAYS } from '../src/config/constants';
import { pruneOperationLogs } from '../src/features/logs/api/logs';
import { prisma } from '../src/lib/db';

async function main() {
  const { deleted, cutoff } = await pruneOperationLogs();

  console.log(
    `[prune] 保留 ${LOG_RETENTION_DAYS} 天：删掉 ${deleted} 条早于 ${cutoff.toISOString()} 的操作日志`,
  );

  await prisma.$disconnect();
}

void main();
