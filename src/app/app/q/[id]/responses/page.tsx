import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { getResponseDetail, getResponsesPage } from '@/features/responses/api/responses';
import { ResponsesPanel } from '@/features/responses/components/responses-panel';
import { hasAtLeastRole } from '@/lib/auth/permissions';
import { requireQuestionnaireAccess } from '@/lib/auth/questionnaire-access';

export const metadata: Metadata = { title: '答卷明细' };

/**
 * 答卷明细（W07，桌面端专属）。
 *
 * 与统计页同样只做「读数据 + 算权限」：筛选都在 URL 里（搜索 / 渠道 / 是否含无效 /
 * 页码 / 当前选中的答卷），非法值一律静默回落 —— 手改的 `?page=999` 收敛到最后一页，
 * `?selected=` 指向不属于这份问卷的答卷时当作没选。
 */
export default async function ResponsesPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    q?: string;
    channel?: string;
    invalid?: string;
    page?: string;
    selected?: string;
  }>;
}) {
  const [{ id }, query] = await Promise.all([params, searchParams]);

  const channelId = query.channel && query.channel.length <= 40 ? query.channel : null;
  const search = query.q && query.q.trim() ? query.q.trim().slice(0, 60) : null;
  // 默认**显示**无效答卷（勾选框默认勾上）：刚标完无效的那份还留在表里，
  // 人才不会以为它被删了。`?invalid=hide` 才收起它们
  const includeInvalid = query.invalid !== 'hide';
  const page = Math.max(1, Number.parseInt(query.page ?? '1', 10) || 1);

  const [{ role }, data, detail] = await Promise.all([
    requireQuestionnaireAccess(id, 'VIEWER'),
    getResponsesPage(id, { channelId, search, includeInvalid, page }),
    getResponseDetail(id, query.selected ?? ''),
  ]);

  if (!data) notFound();

  return (
    <ResponsesPanel
      data={data}
      detail={detail}
      questionnaireId={id}
      channelId={channelId}
      search={search}
      includeInvalid={includeInvalid}
      canExport={hasAtLeastRole(role, 'EDITOR')}
      canEdit={hasAtLeastRole(role, 'EDITOR')}
    />
  );
}
