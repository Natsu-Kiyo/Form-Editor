import { NextResponse } from 'next/server';

import { getResponsesForExport } from '@/features/analytics/api/analytics';
import { parseAnalyticsFilter } from '@/features/analytics/lib/filter';
import { OPERATION_TYPE } from '@/config/constants';
import { requireQuestionnaireAccess } from '@/lib/auth/questionnaire-access';
import { writeOperationLog } from '@/lib/operation-log';
import { formatDateTimeLocal } from '@/utils/format';

/**
 * 导出答卷 CSV。
 *
 * 两个刻意的细节：
 * - **带 UTF-8 BOM**：不加 BOM 的 UTF-8 CSV 在中文 Windows 上双击打开会变成乱码，
 *   而「导出后双击就能看」正是这个功能的全部意义。
 * - 每个单元格都加引号并把内部引号翻倍：题目文案、填空答案里出现逗号与换行是常态，
 *   不加引号会把一行拆成好几列。
 *
 * 权限要求 `EDITOR`：统计页本身对查看者开放，但把全部原始回答打包带走不是。
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const { user, questionnaire: access } = await requireQuestionnaireAccess(id, 'EDITOR');

  const search = new URL(request.url).searchParams;
  // 与统计页共用同一套解析：参数名、白名单、区间边界（含结束日当天）都只有一处实现
  const filter = parseAnalyticsFilter({
    channel: search.get('channel') ?? undefined,
    from: search.get('from') ?? undefined,
    to: search.get('to') ?? undefined,
  });
  const includeInvalid = search.get('invalid') === '1';

  const { questionnaire, responses } = await getResponsesForExport(id, filter);
  if (!questionnaire) return new NextResponse('问卷不存在', { status: 404 });

  const rows = includeInvalid
    ? responses
    : responses.filter((response) => response.status === 'VALID');

  /*
   * 记一条日志：导出会带走全部原始回答，属关键动作。
   * 放在「取完数据之后、拼 CSV 之前」—— 这样记下的份数是**这次真正导出的份数**。
   */
  await writeOperationLog({
    workspaceId: access.workspaceId,
    actorId: user.id,
    type: OPERATION_TYPE.EXPORT,
    targetType: 'QUESTIONNAIRE',
    targetId: id,
    targetName: questionnaire.title,
    detail: { rows: rows.length, invalid: includeInvalid },
  });

  const header = [
    '提交时间',
    ...(includeInvalid ? ['状态'] : []),
    '渠道',
    '用时(秒)',
    ...questionnaire.questions.map((question) => question.title),
  ];

  const body = rows.map((response) => {
    const answers = new Map(response.answers.map((answer) => [answer.questionId, answer.value]));

    return [
      formatDateTimeLocal(response.submittedAt).replace('T', ' '),
      ...(includeInvalid ? [response.status === 'VALID' ? '有效' : '无效'] : []),
      response.channel?.name ?? '无渠道标记',
      response.durationMs ? String(Math.round(response.durationMs / 1000)) : '',
      ...questionnaire.questions.map((question) => formatCell(answers.get(question.id))),
    ];
  });

  const csv = [header, ...body].map((row) => row.map(escapeCell).join(',')).join('\r\n');

  return new NextResponse(`\uFEFF${csv}\r\n`, {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      // RFC 5987：文件名含中文时必须这样写，直接写 filename 会乱码
      'content-disposition': `attachment; filename*=UTF-8''${encodeURIComponent(
        `${questionnaire.title}-答卷.csv`,
      )}`,
    },
  });
}

/** 作答值 → 单元格文本。多选按顿号连接，数字与日期原样 */
function formatCell(value: unknown) {
  if (value === null || value === undefined) return '';
  if (Array.isArray(value)) return value.join('、');

  return String(value);
}

function escapeCell(value: string) {
  return `"${value.replace(/"/g, '""')}"`;
}
