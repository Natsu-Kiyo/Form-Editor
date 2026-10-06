import 'server-only';

import {
  LOG_RANGE_DAYS,
  OPERATION_TYPE_GROUP,
  OPERATION_TYPE_GROUP_OF,
  type OperationType,
  type OperationTypeGroup,
} from '@/config/constants';
import { prisma } from '@/lib/db';
import { formatDisplayDate, formatTimeOfDay } from '@/utils/format';

import { describeOperation, UNKNOWN_ACTOR, type OperationSentence } from '../lib/describe';

/**
 * 操作日志（W10）的读取层。
 *
 * 三条刻意的处理：
 * - **一次只取 200 条**（按时间倒序最早截断）：日志是只增不减的表，翻旧账的需求远小于
 *   「看看最近发生了什么」。真要查更早的，用「导出日志」拿 CSV。
 * - 按**展示时区**分组到「今天 / 昨天 / 日期」：服务器跑在 UTC，按它分组会让
 *   北京时间上午 8 点前的操作落到前一天（与统计页同一条口径）。
 * - 操作人被移除后 `actorId` 会置空（`onDelete: SetNull`），文案要有占位而不是空白。
 */
export type LogRangeDays = (typeof LOG_RANGE_DAYS)[number];

const MAX_ROWS = 200;
const DAY_MS = 24 * 60 * 60 * 1000;

export type LogRow = {
  id: string;
  actorName: string;
  sentence: OperationSentence;
  extra: string | null;
  typeLabel: string;
  groupLabel: string;
  timeLabel: string;
};

export type LogDayGroup = { key: string; label: string; rows: LogRow[] };

export type LogsPageData = {
  days: LogDayGroup[];
  /** 筛选「全部成员」用；只看**当前工作区的成员**，不是全站用户 */
  actors: { id: string; name: string }[];
  total: number;
  truncated: boolean;
};

export type LogsQuery = {
  actorId: string | null;
  group: OperationTypeGroup | null;
  days: LogRangeDays;
  /** 导出时放宽上限（页面上只显示最近 200 条） */
  limit?: number;
};

export async function getOperationLogs(
  workspaceId: string,
  query: LogsQuery,
): Promise<LogsPageData> {
  const since = new Date(Date.now() - query.days * DAY_MS);

  // 分组筛选要落到具体的 type 上：库里存的是字符串（类型随里程碑增长），分组只是展示概念
  const typesOfGroup = query.group
    ? (Object.keys(OPERATION_TYPE_GROUP_OF) as OperationType[]).filter(
        (type) => OPERATION_TYPE_GROUP_OF[type] === query.group,
      )
    : null;

  const [logs, memberships] = await Promise.all([
    prisma.operationLog.findMany({
      where: {
        workspaceId,
        createdAt: { gte: since },
        ...(query.actorId ? { actorId: query.actorId } : {}),
        ...(typesOfGroup ? { type: { in: typesOfGroup } } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: (query.limit ?? MAX_ROWS) + 1,
      select: {
        id: true,
        type: true,
        targetName: true,
        detail: true,
        createdAt: true,
        actor: { select: { name: true } },
      },
    }),
    prisma.membership.findMany({
      where: { workspaceId },
      orderBy: { createdAt: 'asc' },
      select: { user: { select: { id: true, name: true } } },
    }),
  ]);

  const limit = query.limit ?? MAX_ROWS;
  const truncated = logs.length > limit;
  const rows = truncated ? logs.slice(0, limit) : logs;

  const todayKey = formatDisplayDate(new Date());
  const yesterdayKey = formatDisplayDate(new Date(Date.now() - DAY_MS));
  const groups = new Map<string, LogDayGroup>();

  for (const log of rows) {
    const key = formatDisplayDate(log.createdAt);
    const described = describeOperation({
      type: log.type,
      targetName: log.targetName,
      detail: log.detail,
    });

    const group = groups.get(key) ?? {
      key,
      label: key === todayKey ? `今天 · ${key}` : key === yesterdayKey ? `昨天 · ${key}` : key,
      rows: [],
    };

    group.rows.push({
      id: log.id,
      actorName: log.actor?.name ?? UNKNOWN_ACTOR,
      sentence: described.sentence,
      extra: described.extra,
      typeLabel: described.typeLabel,
      groupLabel: described.group,
      timeLabel: formatTimeOfDay(log.createdAt),
    });

    groups.set(key, group);
  }

  return {
    days: [...groups.values()],
    actors: memberships.map((membership) => membership.user),
    total: rows.length,
    truncated,
  };
}

/** 「全部操作类型」下拉的选项：先「全部」，再按分组 */
export const LOG_GROUP_OPTIONS = [
  OPERATION_TYPE_GROUP.QUESTIONNAIRE,
  OPERATION_TYPE_GROUP.STATUS,
  OPERATION_TYPE_GROUP.DATA,
  OPERATION_TYPE_GROUP.DISTRIBUTION,
  OPERATION_TYPE_GROUP.MEMBER,
];
