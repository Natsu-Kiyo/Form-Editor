'use client';

import { useState, useTransition } from 'react';

import { AlertTriangleIcon, MailIcon, UsersIcon } from '@/components/icons/ui-icons';
import { Topbar } from '@/components/layout/topbar';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { FilterSelect } from '@/components/ui/filter-select';
import { Modal, ModalContent } from '@/components/ui/modal';
import { useToast } from '@/components/ui/toast';
import {
  INVITATION_EXPIRES_DAYS,
  INVITATION_STATUS_LABEL,
  ROLE_LABEL,
  type Role,
} from '@/config/constants';
import { cn } from '@/utils/cn';

import { changeMemberRoleAction, removeMemberAction } from '../actions/manage-member';
import { revokeInvitationAction } from '../actions/invite-member';
import type { MembersPageData } from '../api/members';
import { DissolveWorkspaceDialog } from './dissolve-workspace-dialog';
import { InviteMemberDialog } from './invite-dialog';
import { LeaveWorkspaceDialog } from './leave-workspace-dialog';
import { PermissionMatrix } from './permission-matrix';
import { TransferOwnershipDialog } from './transfer-ownership-dialog';

const ASSIGNABLE_ROLES: Role[] = ['ADMIN', 'EDITOR', 'VIEWER'];

/**
 * 成员与权限（W09）。
 *
 * 四处刻意的处理：
 * - **自己那一行的操作是「解散」/「退出」**（R75）：所有者只有「解散」，其他成员有「退出」；
 *   「移除」只出现在**别人**那一行 —— 管理员把自己"移除"掉是个不会多想的误操作，
 *   而「退出」把同一件事说清楚了。
 * - **所有者自己那一行的角色下拉是「转让」的入口**（R76）：选到哪一档，转让完成后
 *   自己就是哪一档（弹窗里再指定继承人），选回「所有者」不触发任何事；
 *   别人那一行的角色下拉才是直接改角色。
 * - 看不到的入口就是没有权限：**查看者进这个页面看不到「邀请成员」「移除」「角色」**
 *   （服务端还会再拒一次，界面不是安全边界）；但**自己那一行的「退出」人人都有** ——
 *   它是"离开"，不是管理。
 * - 移除 / 退出 / 解散都要二次确认：它们都会让某人（或所有人）立刻失去访问权。
 */
export function MembersPanel({
  data,
  viewerId,
  canManage,
}: {
  data: MembersPageData;
  viewerId: string;
  canManage: boolean;
}) {
  const [inviteOpen, setInviteOpen] = useState(false);
  const [removing, setRemoving] = useState<{ id: string; name: string } | null>(null);
  // 待撤回的邀请。与 `removing` 同形：**先记下目标、弹层确认后才动它**
  const [revoking, setRevoking] = useState<{ id: string; email: string } | null>(null);
  /** 解散工作区（入口只在所有者自己那一行）。不用记目标：能解散的只有当前这一个 */
  const [dissolving, setDissolving] = useState(false);
  /** 退出工作区（入口在自己那一行，非所有者） */
  const [leaving, setLeaving] = useState(false);
  /** 转让所有权：值 = 自己降级成哪一档（就是角色下拉里选的那个值）；null = 弹窗关着 */
  const [transferring, setTransferring] = useState<Role | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const { toast } = useToast();

  /*
   * 失败必须**复位转圈 + 说出来**：这三处动作的失败都在预期内（别人刚把他移出、
   * 两个管理员同时点移除、邀请已被接受/撤回），留着转圈等于把「没改成」伪装成「还在改」。
   */
  const changeRole = (membershipId: string, role: string) => {
    setPendingId(membershipId);
    startTransition(async () => {
      const result = await changeMemberRoleAction(membershipId, role);
      setPendingId(null);

      if (!result.ok) {
        toast({ title: '没能修改角色', description: result.message, variant: 'error' });
      }
    });
  };

  /**
   * 复制某条邀请的链接。
   *
   * 用 `window.location.origin` 而不是 `NEXT_PUBLIC_APP_URL`：后者只在服务端可读
   * （见 AGENTS.md），而管理员此刻就在这个站点上 —— 他复制的理应是他正打开的这个地址。
   * token 本来就在页面数据里（`InvitationRow.token`），所以这一步不必再问一次服务端。
   */
  const copyInviteLink = async (invitation: { token: string; email: string }) => {
    const link = `${window.location.origin}/invite/${invitation.token}`;

    try {
      await navigator.clipboard.writeText(link);
      toast({ title: '邀请链接已复制', description: invitation.email, variant: 'success' });
    } catch {
      /*
       * 剪贴板只在安全上下文（https / localhost）可用，失败**必须说出来** ——
       * 静默无反应的按钮和假入口没有区别（与 `CopyButton` 同一条理由）。
       */
      toast({
        title: '复制失败',
        description: '浏览器拒绝了剪贴板访问，请手动选中复制',
        variant: 'error',
      });
    }
  };

  return (
    <>
      <Topbar
        title="成员与权限"
        actions={
          canManage ? (
            <Button size="sm" onClick={() => setInviteOpen(true)}>
              <UsersIcon className="size-3.5" />
              邀请成员
            </Button>
          ) : null
        }
      />

      <main className="flex-1 overflow-y-auto p-6 sm:p-7">
        <div className="mx-auto max-w-[1020px] space-y-6">
          {/* ---- 三张数字卡 ---- */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <StatCard label="工作区成员" value={data.memberCount} />
            <StatCard
              label={canManage ? '可编辑问卷' : '可查看问卷'}
              value={data.questionnaireCount}
            />
            <StatCard label="待接受邀请" value={data.pendingCount} tone="amber" />
          </div>

          {/* ---- 成员列表 ---- */}
          <div className="border-ink-200 overflow-hidden rounded-xl border bg-white">
            <div className="border-ink-100 border-b px-6 py-4">
              <h2 className="text-ink-900 text-[14.5px] font-semibold">成员列表</h2>
            </div>

            <table className="w-full text-[13px]">
              <thead className="bg-ink-50 text-ink-600">
                <tr>
                  <th className="px-6 py-2.5 text-left font-medium">成员</th>
                  <th className="w-56 px-6 py-2.5 text-left font-medium">角色</th>
                  <th className="px-6 py-2.5 text-left font-medium">加入时间</th>
                  <th className="w-24 px-6 py-2.5 text-right font-medium">操作</th>
                </tr>
              </thead>

              <tbody className="divide-ink-100 divide-y">
                {data.members.map((member) => {
                  const isOwner = member.role === 'OWNER';
                  const isSelf = member.userId === viewerId;
                  const editable = canManage && !isOwner;

                  return (
                    <tr key={member.membershipId} className="hover:bg-ink-50/60">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <Avatar name={member.name} size="md" />
                          <div className="min-w-0">
                            <div className="text-ink-900 flex items-center gap-2 text-[13.5px] font-medium">
                              {member.name}
                              {member.userId === viewerId ? (
                                <span className="bg-brand-50 text-brand-600 rounded px-1.5 py-0.5 text-[10px] font-medium">
                                  你
                                </span>
                              ) : null}
                            </div>
                            <div className="text-ink-400 truncate text-[11.5px]">
                              {member.email}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="px-6 py-4">
                        {editable ? (
                          <FilterSelect
                            label={`${member.name}的角色`}
                            value={member.role}
                            disabled={pendingId === member.membershipId}
                            onChange={(role) => changeRole(member.membershipId, role)}
                            options={ASSIGNABLE_ROLES.map((role) => ({
                              value: role,
                              label: ROLE_LABEL[role],
                            }))}
                          />
                        ) : isSelf && isOwner ? (
                          /*
                           * 所有者自己那一行的下拉（R76）：**它是"转让"的入口**，不直接改角色 ——
                           * 工作区必须始终有所有者，所以"把自己改成管理员"这件事只能连同
                           * 「指定继承人」一起做。选到哪一档，转让完成后自己就是哪一档；
                           * 选回「所有者」（当前值）不触发（原生 select 也不会为相同的值触发 change）。
                           */
                          <FilterSelect
                            label={`${member.name}的角色`}
                            value="OWNER"
                            options={[
                              { value: 'OWNER', label: ROLE_LABEL.OWNER },
                              ...ASSIGNABLE_ROLES.map((role) => ({
                                value: role,
                                label: ROLE_LABEL[role],
                              })),
                            ]}
                            onChange={(role) => {
                              if (role !== 'OWNER') setTransferring(role as Role);
                            }}
                          />
                        ) : (
                          <span
                            className={cn(
                              'border-ink-200 bg-ink-50 text-ink-700 inline-flex h-8 items-center gap-2 rounded-lg border px-3 text-[12.5px]',
                              isOwner && 'opacity-60',
                            )}
                          >
                            <RoleDot role={member.role} />
                            {ROLE_LABEL[member.role]}
                          </span>
                        )}
                      </td>

                      <td className="text-ink-500 px-6 py-4 font-mono text-[12px]">
                        {member.joinedAtLabel}
                      </td>

                      <td className="px-6 py-4 text-right">
                        {isSelf ? (
                          // 自己那一行：所有者只有「解散」（转让在角色列那个下拉里），
                          // 其他人是「退出」。两者都**不经过** `editable` —— 退出不是管理动作
                          isOwner ? (
                            <button
                              type="button"
                              onClick={() => setDissolving(true)}
                              className="text-[12.5px] font-semibold text-rose-600 transition-colors duration-150 hover:text-rose-700"
                            >
                              解散
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setLeaving(true)}
                              className="text-ink-500 text-[12.5px] transition-colors duration-150 hover:text-rose-600"
                            >
                              退出
                            </button>
                          )
                        ) : editable ? (
                          <button
                            type="button"
                            onClick={() =>
                              setRemoving({ id: member.membershipId, name: member.name })
                            }
                            className="text-ink-500 text-[12.5px] transition-colors duration-150 hover:text-rose-600"
                          >
                            移除
                          </button>
                        ) : (
                          <span className="text-ink-300 text-[12px]">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* ---- 待接受的邀请 ---- */}
          <div className="border-ink-200 overflow-hidden rounded-xl border bg-white">
            <div className="border-ink-100 flex items-center justify-between border-b px-6 py-4">
              <h2 className="text-ink-900 text-[14.5px] font-semibold">待接受的邀请</h2>
              <span className="text-ink-400 text-[12px]">
                邀请链接 {INVITATION_EXPIRES_DAYS} 天后失效
              </span>
            </div>

            {data.invitations.length === 0 ? (
              <p className="text-ink-400 px-6 py-6 text-[12.5px]">没有等待接受的邀请。</p>
            ) : (
              <ul role="list" className="divide-ink-100 divide-y">
                {/*
                  用 `<ul>` / `<li>`：邀请本来就是一份列表，也让「一条邀请」可按角色定位。
                  `role="list"` 不能省：Tailwind 的 preflight 把 `ul` 的 list-style 去掉了，
                  而 Chrome / Safari 遇到 `list-style: none` 会**连列表语义一起丢掉**
                  （读屏与 `getByRole('listitem')` 都会看不到它）。
                */}
                {data.invitations.map((invitation) => (
                  <li
                    key={invitation.id}
                    className="flex flex-wrap items-center justify-between gap-3 px-6 py-4"
                  >
                    <div className="flex items-center gap-3">
                      <span className="bg-ink-100 text-ink-400 flex size-8 shrink-0 items-center justify-center rounded-full">
                        <MailIcon className="size-4" />
                      </span>
                      <div>
                        <div className="text-ink-800 text-[13px]">{invitation.email}</div>
                        <div className="text-ink-400 text-[11.5px]">
                          {invitation.summary} · {invitation.expiresAtLabel} 失效
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="inline-flex h-6 items-center rounded-full bg-amber-50 px-2 text-[11px] font-medium text-amber-700">
                        {INVITATION_STATUS_LABEL.PENDING}
                      </span>
                      {canManage ? (
                        <>
                          {/*
                            复制链接：与「撤回」同级、同字号，用品牌色把它标成可点的动作。
                            链接要能随时再拿一次 —— 邀请发出去之后对方很可能找不到消息了。
                          */}
                          <button
                            type="button"
                            onClick={() => void copyInviteLink(invitation)}
                            className="text-brand-500 hover:text-brand-600 text-[12.5px] transition-colors duration-150"
                          >
                            复制链接
                          </button>
                          <button
                            type="button"
                            disabled={pendingId === invitation.id}
                            // 撤回也不再有直接动作：先记下目标，弹层确认后才真的撤回
                            onClick={() =>
                              setRevoking({ id: invitation.id, email: invitation.email })
                            }
                            className="text-ink-500 text-[12.5px] transition-colors duration-150 hover:text-rose-600 disabled:opacity-45"
                          >
                            {pendingId === invitation.id ? '撤回中…' : '撤回'}
                          </button>
                        </>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* ---- 权限说明 ---- */}
          <PermissionMatrix />
        </div>
      </main>

      <InviteMemberDialog open={inviteOpen} onOpenChange={setInviteOpen} />

      {/* 自己那一行的两个动作（R75）：所有者「解散」、其他成员「退出」 */}
      <DissolveWorkspaceDialog
        open={dissolving}
        onOpenChange={setDissolving}
        workspaceName={data.workspaceName}
      />
      <LeaveWorkspaceDialog
        open={leaving}
        onOpenChange={setLeaving}
        workspaceName={data.workspaceName}
      />

      {/* 转让所有权（R76）：入口在所有者自己那一行的角色下拉 */}
      <TransferOwnershipDialog
        open={transferring !== null}
        onOpenChange={(next) => {
          if (!next) setTransferring(null);
        }}
        workspaceName={data.workspaceName}
        selfRole={transferring ?? 'ADMIN'}
        candidates={data.members
          .filter((member) => member.userId !== viewerId)
          .map((member) => ({
            userId: member.userId,
            name: member.name,
            email: member.email,
            role: member.role,
          }))}
      />

      {/* 危险确认走设计稿那一套卡（三角告警 + 标题 + 说明 + 浅灰提示块 + 两枚等宽按钮） */}
      <Modal open={removing !== null} onOpenChange={(next) => !next && setRemoving(null)}>
        <ModalContent title="确定移除这位成员？" hideTitle width="sm" className="p-6">
          <div className="mb-4 flex size-11 items-center justify-center rounded-xl bg-rose-50">
            <AlertTriangleIcon className="size-5 text-rose-500" />
          </div>

          <h3 className="text-ink-900 mb-2 text-[16px] font-semibold">确定移除这位成员？</h3>
          <p className="text-ink-500 mb-5 text-[12.5px] leading-5">
            把「{removing?.name ?? ''}」移出这个工作区，此操作不可撤销。
          </p>

          <div className="bg-ink-50 border-ink-100 mb-5 rounded-[10px] border p-3">
            <div className="text-ink-500 text-[11.5px] leading-5">
              移出后对方立刻失去这个工作区的全部访问权（问卷、数据、日志）。
              他的账号还在，其他工作区不受影响；之后可以重新邀请。
            </div>
          </div>

          <div className="flex gap-2.5">
            <Button variant="outline" className="flex-1" onClick={() => setRemoving(null)}>
              取消
            </Button>
            <Button
              variant="danger"
              className="flex-1"
              disabled={pendingId === removing?.id}
              onClick={() => {
                const target = removing;
                if (!target) return;

                setPendingId(target.id);
                startTransition(async () => {
                  const result = await removeMemberAction(target.id);
                  setPendingId(null);

                  if (!result.ok) {
                    // 弹层**留着**：这多半是「这位成员已经不在列表里了」，
                    // 关掉它只会让用户以为自己点成功了
                    toast({ title: '没能移除成员', description: result.message, variant: 'error' });
                    return;
                  }

                  setRemoving(null);
                });
              }}
            >
              确认移除
            </Button>
          </div>
        </ModalContent>
      </Modal>

      {/*
        撤回邀请也走危险确认那一套卡（设计稿把「撤回邀请」与删除 / 移除归在同一组）。
        加这一层的理由与移除成员相同：它**立刻作废对方手里那条链接**，而发出去的链接
        可能已经在微信群里传过几手了 —— 那不是点错一次就能撤回的事。
      */}
      <Modal open={revoking !== null} onOpenChange={(next) => !next && setRevoking(null)}>
        <ModalContent title="确定撤回这个邀请？" hideTitle width="sm" className="p-6">
          <div className="mb-4 flex size-11 items-center justify-center rounded-xl bg-rose-50">
            <AlertTriangleIcon className="size-5 text-rose-500" />
          </div>

          <h3 className="text-ink-900 mb-2 text-[16px] font-semibold">确定撤回这个邀请？</h3>
          <p className="text-ink-500 mb-5 text-[12.5px] leading-5">
            发给「{revoking?.email ?? ''}」的那条邀请链接会立刻失效，此操作不可撤销。
          </p>

          <div className="bg-ink-50 border-ink-100 mb-5 rounded-[10px] border p-3">
            <div className="text-ink-500 text-[11.5px] leading-5">
              对方再点原来的链接，会看到这份邀请「已撤回、不能接受」，并提示联系管理员重新邀请。
              需要时重新生成一条发给对方即可 —— 同一个邮箱可以再次邀请。
            </div>
          </div>

          <div className="flex gap-2.5">
            <Button variant="outline" className="flex-1" onClick={() => setRevoking(null)}>
              取消
            </Button>
            <Button
              variant="danger"
              className="flex-1"
              disabled={pendingId === revoking?.id}
              onClick={() => {
                const target = revoking;
                if (!target) return;

                setPendingId(target.id);
                startTransition(async () => {
                  const result = await revokeInvitationAction(target.id);
                  setPendingId(null);

                  if (!result.ok) {
                    toast({ title: '没能撤回邀请', description: result.message, variant: 'error' });
                    return;
                  }

                  setRevoking(null);
                });
              }}
            >
              {pendingId === revoking?.id ? '撤回中…' : '确认撤回'}
            </Button>
          </div>
        </ModalContent>
      </Modal>
    </>
  );
}

function StatCard({
  label,
  value,
  tone = 'ink',
}: {
  label: string;
  value: number;
  tone?: 'ink' | 'amber';
}) {
  return (
    <div className="border-ink-200 rounded-xl border bg-white p-4">
      <div className="text-ink-500 mb-1.5 text-[12px]">{label}</div>
      <div
        className={cn(
          'font-mono text-[26px] leading-8 font-semibold',
          tone === 'amber' ? 'text-amber-500' : 'text-ink-900',
        )}
      >
        {value}
      </div>
    </div>
  );
}

function RoleDot({ role }: { role: Role }) {
  return (
    <span
      className={cn(
        'size-1.5 rounded-full',
        role === 'OWNER'
          ? 'bg-brand-500'
          : role === 'ADMIN'
            ? 'bg-brand-400'
            : role === 'EDITOR'
              ? 'bg-ink-400'
              : 'bg-ink-300',
      )}
    />
  );
}
