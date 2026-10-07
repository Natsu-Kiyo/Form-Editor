/**
 * 清理已经结束的历史邀请（已过期 / 已撤回 / 已接受）。
 *
 * 用法：`pnpm db:prune-invitations`
 * 排程由外部负责（部署时挂定时任务 / Cron）—— 脚本只做一次清理，不做常驻。
 *
 * 平时不跑也不会无限攒：成员页读取时会顺手清一批（`features/members/api/members.ts`）。
 * 这个脚本是给「没人打开过那个页面」的部署兜底的，以及清掉比保留期更久的历史。
 */
import { INVITATION_RETENTION_DAYS } from '../src/config/constants';
import { pruneInvitations } from '../src/features/members/api/members';
import { prisma } from '../src/lib/db';

async function main() {
  const { deleted, cutoff } = await pruneInvitations();

  console.log(
    `[prune] 保留 ${INVITATION_RETENTION_DAYS} 天：删掉 ${deleted} 条早于 ${cutoff.toISOString()} 发出的历史邀请`,
  );

  await prisma.$disconnect();
}

void main();
