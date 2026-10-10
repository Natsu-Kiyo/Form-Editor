import { NextResponse } from 'next/server';

import { getOperationLogs } from '@/features/logs/api/logs';
import { parseLogsQuery } from '@/features/logs/lib/filter';
import { requireActiveWorkspace } from '@/lib/auth/active-workspace';
import { toCsv } from '@/lib/csv';

/**
 * 导出操作日志 CSV。
 *
 * 与答卷导出共用 `@/lib/csv`：BOM、引号翻倍与公式注入中和只有一处实现
 * （成员姓名、问卷标题都会进到这张表里）。
 *
 * 权限 **ADMIN**：查看日志对所有成员开放，但把整份审计记录打包带走不是。
 * 筛选解析与页面共用 `parseLogsQuery` —— 页面上筛的是谁，导出的就是谁。
 */
const EXPORT_LIMIT = 2000;

export async function GET(request: Request) {
  const { workspace } = await requireActiveWorkspace('ADMIN');

  const search = new URL(request.url).searchParams;
  const filter = parseLogsQuery({
    actor: search.get('actor') ?? undefined,
    group: search.get('group') ?? undefined,
    days: search.get('days') ?? undefined,
  });

  const data = await getOperationLogs(workspace.id, { ...filter, limit: EXPORT_LIMIT });

  const header = ['时间', '成员', '操作', '类型', '对象', '补充'];
  const rows = data.days.flatMap((day) =>
    day.rows.map((row) => [
      `${day.key} ${row.timeLabel}`,
      row.actorName,
      `${row.sentence.prefix}${row.sentence.target}${row.sentence.suffix}`,
      row.groupLabel,
      row.typeLabel,
      row.extra ?? '',
    ]),
  );

  return new NextResponse(toCsv([header, ...rows]), {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      // RFC 5987：文件名含中文时必须这样写
      'content-disposition': `attachment; filename*=UTF-8''${encodeURIComponent(
        `操作日志-${workspace.name}-最近${filter.days}天.csv`,
      )}`,
    },
  });
}
