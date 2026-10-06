'use client';

import Link from 'next/link';
import { useActionState } from 'react';

import { Button } from '@/components/ui/button';
import { INVITATION_STATUS, INVITATION_STATUS_LABEL, ROLE_LABEL } from '@/config/constants';

import { acceptInvitationAction } from '../actions/accept-invitation';
import type { getInvitationByToken } from '../api/members';

type Invitation = NonNullable<Awaited<ReturnType<typeof getInvitationByToken>>>;

/**
 * 接受邀请（/invite/[token]）。
 *
 * 三处刻意的处理：
 * - **先说明「邀请的邮箱是谁」**：链接是 bearer 凭据（本项目不发邮件、靠手动转发），
 *   如果当前登录账号与受邀邮箱不同，用户该在点之前就看出来 —— 而不是加入之后才发现。
 * - 邀请已失效 / 已撤回 / 已接受时**不给按钮**，只说明原因与下一步（找管理员重发）。
 * - 接受成功后给一个「进入工作区」的出口：这个链接的意图就是进那个工作区。
 */
export function AcceptInvitationPanel({
  invitation,
  token,
  viewerEmail,
}: {
  invitation: Invitation;
  token: string;
  viewerEmail: string;
}) {
  const [state, formAction, pending] = useActionState(acceptInvitationAction, {});
  const emailMismatch = viewerEmail.toLowerCase() !== invitation.email.toLowerCase();
  const acceptable = invitation.status === INVITATION_STATUS.PENDING;

  return (
    <div className="border-ink-200 w-full max-w-[460px] rounded-2xl border bg-white p-7">
      <p className="text-ink-400 text-[12px]">{invitation.invitedByName} 邀请你加入</p>
      <h1 className="text-ink-900 mt-1 text-[19px] font-semibold">{invitation.workspaceName}</h1>

      <dl className="mt-5 space-y-2 text-[12.5px]">
        <Row label="受邀邮箱" value={invitation.email} />
        <Row label="角色" value={ROLE_LABEL[invitation.role]} />
        <Row label="链接有效期" value={`至 ${invitation.expiresAtLabel}`} />
        <Row label="当前登录" value={viewerEmail} />
      </dl>

      {emailMismatch && acceptable ? (
        <p className="mt-4 rounded-[10px] bg-amber-50 px-3 py-2.5 text-[11.5px] leading-5 text-amber-700">
          这份邀请是发给 {invitation.email} 的，而你正以 {viewerEmail} 登录。
          本项目不发邮件、链接靠手动转发，所以<b>仍然可以接受</b>
          ；但请先确认这确实是你该加入的工作区。
        </p>
      ) : null}

      {state.message ? <p className="mt-4 text-[12px] text-rose-600">{state.message}</p> : null}

      {state.success ? (
        <div className="border-brand-200 bg-brand-50/60 mt-4 rounded-[10px] border p-3.5">
          <p className="text-brand-700 text-[12.5px] font-medium">{state.success}</p>
          <Button asChild size="sm" className="mt-2.5 w-full">
            <Link href="/app">进入工作区</Link>
          </Button>
        </div>
      ) : null}

      {acceptable && !state.success ? (
        <form action={formAction} className="mt-5">
          <input type="hidden" name="token" value={token} />
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? '加入中…' : `接受邀请，以「${ROLE_LABEL[invitation.role]}」身份加入`}
          </Button>
        </form>
      ) : null}

      {!acceptable && !state.success ? (
        <div className="mt-5">
          <p className="text-ink-500 text-[12.5px]">
            这份邀请的状态是「{INVITATION_STATUS_LABEL[invitation.status]}」，已经不能接受。
            请联系工作区管理员重新邀请。
          </p>
          <Button asChild variant="outline" className="mt-3 w-full">
            <Link href="/app">回到问卷列表</Link>
          </Button>
        </div>
      ) : null}

      <p className="text-ink-300 mt-5 text-[11px] leading-5">
        接受后会成为该工作区的成员，权限由上面那个角色决定（可在「成员与权限」页查看权限矩阵）。
      </p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline gap-3">
      <dt className="text-ink-400 w-20 shrink-0">{label}</dt>
      <dd className="text-ink-700 break-all">{value}</dd>
    </div>
  );
}
