import { LOG_RANGE_DAYS, OPERATION_TYPE_GROUP, type OperationTypeGroup } from '@/config/constants';

import type { LogRangeDays, LogsQuery } from '../api/logs';

/**
 * 日志筛选的解析（页面与「导出日志」接口共用）。
 *
 * 与统计页同一条理由：**参数解析只写一份**。两处各写一份白名单，迟早出现
 * 「页面上筛的是成员 A，导出的却是全部」这种谁也没写错、但两边对不上的结果。
 */
const GROUPS: string[] = Object.values(OPERATION_TYPE_GROUP);

export function parseLogsQuery(query: {
  actor?: string;
  group?: string;
  days?: string;
}): LogsQuery {
  const days = Number(query.days);
  const range = (LOG_RANGE_DAYS as readonly number[]).includes(days) ? (days as LogRangeDays) : 7;

  return {
    // 成员 id 是 cuid，40 上限只是为了让手改的参数进不了查询
    actorId: query.actor && query.actor.length <= 40 ? query.actor : null,
    group: query.group && GROUPS.includes(query.group) ? (query.group as OperationTypeGroup) : null,
    days: range,
  };
}
