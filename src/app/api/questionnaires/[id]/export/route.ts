import { NextResponse } from 'next/server';

import { getQuestionnairePayload } from '@/features/questionnaire/api/questionnaires';
import { requireQuestionnaireAccess } from '@/features/questionnaire/lib/access';
import { payloadFileName } from '@/features/questionnaire/lib/payload';

/**
 * 导出问卷结构 JSON。
 *
 * 用 Route Handler 而不是 Server Action：要触发浏览器下载就得让响应带上
 * `Content-Disposition`，而 Server Action 的返回值始终是给 React 的数据，没法下载文件。
 *
 * 权限按 `VIEWER` 起 —— 能看这份问卷的人就能导出它的结构（结构不是答卷数据）。
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  await requireQuestionnaireAccess(id, 'VIEWER');

  const data = await getQuestionnairePayload(id);
  if (!data) {
    return new NextResponse('问卷不存在', { status: 404 });
  }

  return new NextResponse(`${JSON.stringify(data.payload, null, 2)}\n`, {
    headers: {
      'content-type': 'application/json; charset=utf-8',
      // RFC 5987 的写法：文件名含中文时必须用它，直接写 filename 会变乱码
      'content-disposition': `attachment; filename*=UTF-8''${encodeURIComponent(payloadFileName(data.title))}`,
    },
  });
}
