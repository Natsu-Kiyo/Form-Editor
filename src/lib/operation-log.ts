import 'server-only';

import { assertModelsForDev, prisma } from '@/lib/db';
import { toJsonColumn } from '@/lib/json';

/**
 * 写一条操作日志。
 *
 * 为什么放 shared 层而不是各 feature 自己写：日志的**字段口径必须一致**
 * —— M10 的操作日志页要按 `type` 分组、按 `targetType` 过滤，
 * 各写一份必然出现「这个 feature 记了 targetName、那个没记」的漂移。
 *
 * 刻意**不向上抛错**：写日志失败不该让主操作失败。用户按了「发布」，
 * 却因为日志表写不进去而发布失败，是比少一条日志严重得多的问题。
 * 失败只落到服务端日志，供排查。
 */
export async function writeOperationLog(input: {
  workspaceId: string;
  actorId: string | null;
  type: string;
  targetType: string;
  targetId: string;
  targetName: string;
  detail?: unknown;
}) {
  // 与版本快照同理：「客户端是旧的」属配置问题，要能在日志里一眼认出来，
  // 而不是被下面的 catch 变成一条语焉不详的写入失败
  assertModelsForDev();

  try {
    await prisma.operationLog.create({
      data: {
        workspaceId: input.workspaceId,
        actorId: input.actorId,
        type: input.type,
        targetType: input.targetType,
        targetId: input.targetId,
        targetName: input.targetName,
        detail: toJsonColumn(input.detail),
      },
    });
  } catch (error) {
    console.error('[operation-log] 写入失败', error);
  }
}
