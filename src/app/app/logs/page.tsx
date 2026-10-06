import type { Metadata } from 'next';

import { getOperationLogs } from '@/features/logs/api/logs';
import { LogsPanel } from '@/features/logs/components/logs-panel';
import { parseLogsQuery } from '@/features/logs/lib/filter';
import { requireActiveWorkspace } from '@/lib/auth/active-workspace';
import { hasAtLeastRole } from '@/lib/auth/permissions';

export const metadata: Metadata = { title: '操作日志' };

/**
 * 操作日志（W10，桌面端专属）。
 *
 * 查看对所有成员开放（「谁改了我的问卷」是每个成员都该能查的），
 * 而**导出要求 ADMIN** —— 把整份审计记录打包带走不是普通成员的日常需求。
 * 与其它页同样的分工：页面只做「读数据 + 算权限」，写入方在各 action 里。
 */
export default async function LogsPage({
  searchParams,
}: {
  searchParams: Promise<{ actor?: string; group?: string; days?: string }>;
}) {
  const [{ workspace }, query] = await Promise.all([
    // 不在工作区里的人根本进不来
    requireActiveWorkspace('VIEWER'),
    searchParams,
  ]);

  const filter = parseLogsQuery(query);
  const data = await getOperationLogs(workspace.id, filter);

  return (
    <LogsPanel
      data={data}
      actorId={filter.actorId}
      group={filter.group}
      days={filter.days}
      canExport={hasAtLeastRole(workspace.role, 'ADMIN')}
    />
  );
}
