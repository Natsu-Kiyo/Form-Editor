'use client';

import { useState, useTransition } from 'react';

import { MailIcon, UsersIcon } from '@/components/icons/ui-icons';
import { Topbar } from '@/components/layout/topbar';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { FilterSelect } from '@/components/ui/filter-select';
import { Modal, ModalContent } from '@/components/ui/modal';
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
import { InviteMemberDialog } from './invite-dialog';
import { PermissionMatrix } from './permission-matrix';

const ASSIGNABLE_ROLES: Role[] = ['ADMIN', 'EDITOR', 'VIEWER'];

/**
 * 成员与权限（W09）。
 *
 * 三处刻意的处理：
 * - **所有者的那一行不给控件**：角色不可改、人不可移除（工作区所有权转让属 2.0）。
 *   给一个点了就报错的控件比不给控件糟得多。
 * - 看不到的入口就是没有权限：**查看者进这个页面看不到「邀请成员」「移除」「角色」**
 *   （服务端还会再拒一次，界面不是安全边界）。
 * - 移除成员要二次确认：它会让对方立刻失去这个工作区的全部访问权。
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
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const changeRole = (membershipId: string, role: string) => {
    setPendingId(membershipId);
    startTransition(async () => {
      await changeMemberRoleAction(membershipId, role);
      setPendingId(null);
    });
  };

  const revoke = (invitationId: string) => {
    setPendingId(invitationId);
    startTransition(async () => {
      await revokeInvitationAction(invitationId);
      setPendingId(null);
    });
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
                        {editable ? (
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
              <div className="divide-ink-100 divide-y">
                {data.invitations.map((invitation) => (
                  <div
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
                        <button
                          type="button"
                          disabled={pendingId === invitation.id}
                          onClick={() => revoke(invitation.id)}
                          className="text-ink-500 text-[12.5px] transition-colors duration-150 hover:text-rose-600 disabled:opacity-45"
                        >
                          {pendingId === invitation.id ? '撤回中…' : '撤回'}
                        </button>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ---- 权限说明 ---- */}
          <PermissionMatrix />
        </div>
      </main>

      <InviteMemberDialog open={inviteOpen} onOpenChange={setInviteOpen} />

      <Modal open={removing !== null} onOpenChange={(next) => !next && setRemoving(null)}>
        <ModalContent
          title="移除成员"
          description={`确定把「${removing?.name ?? ''}」移出这个工作区吗？`}
          width="sm"
        >
          <p className="text-ink-500 text-[12.5px] leading-6">
            移出后对方立刻失去这个工作区的全部访问权（问卷、数据、日志）。
            他的账号还在，其他工作区不受影响；之后可以重新邀请。
          </p>

          <div className="mt-5 flex gap-2.5">
            <Button variant="outline" className="flex-1" onClick={() => setRemoving(null)}>
              取消
            </Button>
            <Button
              className="flex-1 bg-rose-600 hover:bg-rose-700"
              disabled={pendingId === removing?.id}
              onClick={() => {
                const target = removing;
                if (!target) return;

                setPendingId(target.id);
                startTransition(async () => {
                  await removeMemberAction(target.id);
                  setPendingId(null);
                  setRemoving(null);
                });
              }}
            >
              确认移除
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
