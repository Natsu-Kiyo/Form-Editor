import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { getSharePageData } from '@/features/publish/api/share';
import { SharePanel } from '@/features/publish/components/share-panel';
import { requireQuestionnaireAccess } from '@/lib/auth/questionnaire-access';
import { hasAtLeastRole } from '@/lib/auth/permissions';

export const metadata: Metadata = { title: '分享问卷' };

/**
 * 分享与分发（W05 / P06）。
 *
 * 与发布设置页同样只做「读数据 + 算权限」：回收开关与新建渠道都是**活**的
 *（点了要立刻反映到状态徽章上），所以它们在客户端组件里，规则仍取自服务端同一份。
 */
export default async function ShareQuestionnairePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [{ role }, data] = await Promise.all([
    requireQuestionnaireAccess(id, 'VIEWER'),
    getSharePageData(id),
  ]);

  if (!data) notFound();

  // 查看者能看链接与二维码（分享不是敏感操作），但不能改回收状态
  // 发布 / 暂停 / 截止 / 回收开关都属权限矩阵里的「状态变更」= 管理员
  const canEdit = hasAtLeastRole(role, 'ADMIN') && data.status !== 'ARCHIVED';

  /*
   * 新建渠道是**编辑者**的能力（`create-channel.ts` 断的就是 EDITOR），
   * 与「状态变更」（ADMIN）不是同一档 —— 以前渠道卡谁都能看到「新建渠道」，
   * 查看者点了才被服务端拒（审查 #7）。两档权限分别传，不合并成一个布尔。
   */
  const canCreateChannel = hasAtLeastRole(role, 'EDITOR') && data.status !== 'ARCHIVED';

  return <SharePanel data={data} canEdit={canEdit} canCreateChannel={canCreateChannel} />;
}
