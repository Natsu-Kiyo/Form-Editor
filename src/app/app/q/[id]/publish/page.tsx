import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { getPublishPageData } from '@/features/publish/api/publish';
import { PublishSettings } from '@/features/publish/components/publish-settings';
import { hasAtLeastRole } from '@/lib/auth/permissions';
import { requireQuestionnaireAccess } from '@/lib/auth/questionnaire-access';

export const metadata: Metadata = { title: '发布设置' };

/**
 * 发布设置（W04 / P08-d）。
 *
 * 页面只负责读数据与算权限；设置表单与「发布前检查」都是**活**的 ——
 * 用户改一个时间，清单要立刻跟着变，所以那部分在客户端组件里（规则仍是同一份纯函数）。
 */
export default async function PublishQuestionnairePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [{ role }, data] = await Promise.all([
    requireQuestionnaireAccess(id, 'VIEWER'),
    getPublishPageData(id),
  ]);

  if (!data) notFound();

  // 归档是终点：要改设置先恢复，所以这里直接当只读处理，而不是给一堆点了报错的按钮
  const canEdit = hasAtLeastRole(role, 'EDITOR') && data.status !== 'ARCHIVED';

  return <PublishSettings data={data} canEdit={canEdit} />;
}
