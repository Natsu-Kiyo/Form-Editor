import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { AcceptInvitationPanel } from '@/features/members/components/accept-invitation-panel';
import { getInvitationByToken } from '@/features/members/api/members';
import { requireUser } from '@/lib/auth/dal';

export const metadata: Metadata = { title: '加入工作区' };

/**
 * 邀请链接的落点（W09 的「一键复制邀请链接」指向这里）。
 *
 * 这一页存在的理由：**能复制的链接不能是 404**（项目里已经踩过一次 —— 嵌入代码
 * 曾经指向一个不存在的 `/embed`）。链接发出去之后必须真的能用。
 *
 * 未登录会先被 `requireUser` 送去登录（登录后回到这里），登录后按 token 找到邀请。
 */
export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const user = await requireUser();
  const invitation = await getInvitationByToken(token);

  if (!invitation) notFound();

  return (
    <div className="bg-ink-50 flex min-h-[100dvh] items-center justify-center p-6">
      <AcceptInvitationPanel invitation={invitation} token={token} viewerEmail={user.email} />
    </div>
  );
}
