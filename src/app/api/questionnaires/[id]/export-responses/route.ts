import { NextResponse } from 'next/server';

import { getResponsesForExport } from '@/features/analytics/api/analytics';
import { parseAnalyticsFilter } from '@/features/analytics/lib/filter';
import { OPERATION_TYPE } from '@/config/constants';
import { requireQuestionnaireAccess } from '@/lib/auth/questionnaire-access';
import { toCsv } from '@/lib/csv';
import { writeOperationLog } from '@/lib/operation-log';
import { formatDateTimeLocal } from '@/utils/format';

/**
 * 导出答卷 CSV。
 *
 * 转义全在 `@/lib/csv`：BOM、引号翻倍、**公式注入中和**共用同一份实现
 * ——这里是唯一能让答题人的填空内容进到发起人 Excel 里的出口。
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

  /*
   * 表头与内容共用一份「展开规则」：**矩阵题按行摊成多列**（`题目标题 - 行名`），
   * 其余题型一列。两处各写一遍的话，表头与数据会错位 —— 那种表格比没有还糟。
   */
  const exportColumns = questionnaire.questions.flatMap((question) => {
    if (question.type === 'MATRIX') {
      return question.options.map((option) => ({
        title: `${question.title} - ${option.label}`,
        read: (answers: Map<string, unknown>) => {
          const picked = answers.get(question.id);
          if (typeof picked !== 'object' || picked === null || Array.isArray(picked)) return '';

          const cell = (picked as Record<string, unknown>)[option.label];

          return typeof cell === 'string' ? cell : '';
        },
      }));
    }

    return [
      {
        title: question.title,
        read: (answers: Map<string, unknown>) => formatCell(answers.get(question.id)),
      },
    ];
  });

  const header = [
    '提交时间',
    ...(includeInvalid ? ['状态'] : []),
    '渠道',
    '用时(秒)',
    ...exportColumns.map((column) => column.title),
  ];

  const body = rows.map((response) => {
    const answers = new Map(response.answers.map((answer) => [answer.questionId, answer.value]));

    return [
      formatDateTimeLocal(response.submittedAt).replace('T', ' '),
      ...(includeInvalid ? [response.status === 'VALID' ? '有效' : '无效'] : []),
      response.channel?.name ?? '无渠道标记',
      response.durationMs ? String(Math.round(response.durationMs / 1000)) : '',
      ...exportColumns.map((column) => column.read(answers)),
    ];
  });

  return new NextResponse(toCsv([header, ...body]), {
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
  // 对象只会是矩阵值（正常路径在上面已按行摊成多列）——兜底成「行：列」，
  // 不写这条会得到 `[object Object]`
  if (typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>)
      .map(([row, column]) => `${row}：${String(column)}`)
      .join('；');
  }

  return String(value);
}
