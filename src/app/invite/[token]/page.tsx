import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { AcceptInvitationPanel } from '@/features/members/components/accept-invitation-panel';
import { getInvitationByToken } from '@/features/members/api/members';
import { isInvitationFor } from '@/features/members/lib/invitation';
import { requireUser } from '@/lib/auth/dal';

export const metadata: Metadata = { title: '加入工作区' };

/**
 * 邀请链接的落点（W09 的「一键复制邀请链接」指向这里）。
 *
 * 这一页存在的理由：**能复制的链接不能是 404**（项目里已经踩过一次 —— 嵌入代码
 * 曾经指向一个不存在的 `/embed`）。链接发出去之后必须真的能用。
 *
 * 未登录会先被 `requireUser` 送去登录（登录后回到这里），登录后按 token 找到邀请。
 *
 * **邮箱不符直接 404**（G6）：原先的做法是照常渲染邀请、只在按钮上方提示一句
 * 「仍然可以接受」—— 那句话既与 action 的新行为相反，又把**受邀邮箱**展示给任何
 * 拿到链接的人（一处实打实的隐私泄露）。这里改成一视同仁地当作「没有这份邀请」：
 * 不透露它存在、也不透露它发给了谁。
 */
export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const user = await requireUser();
  const invitation = await getInvitationByToken(token);

  if (!invitation) notFound();
  if (!isInvitationFor(user.email, invitation.email)) notFound();

  return (
    <div className="bg-ink-50 flex min-h-[100dvh] items-center justify-center p-6">
      <AcceptInvitationPanel invitation={invitation} token={token} />
    </div>
  );
}
