'use client';

import { useState } from 'react';

import { UsersIcon } from '@/components/icons/ui-icons';
import { Avatar } from '@/components/ui/avatar';
import { Modal, ModalContent } from '@/components/ui/modal';
import { RoleBadge } from '@/components/ui/role-badge';
import type { Role } from '@/config/constants';

import type { MemberRow } from '../api/members';

/**
 * 「成员与角色权限」的**只读**版本（P09「我的」里那一行）。
 *
 * 设计稿的原话是「成员邀请与角色权限在桌面端设置 —— 手机上只读查看，避免误操作」。
 * 所以这一版只有列表：没有邀请、没有改角色、没有移除 —— 一个都不给，
 * 而不是给了再报错。要看能改的版本，去 `/app/members`（桌面端专属）。
 */
export function ReadOnlyMembers({ members }: { members: MemberRow[] }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="hover:bg-ink-50/70 flex w-full items-center gap-3 px-3.5 py-3 text-left transition-colors duration-150"
      >
        <span className="text-ink-500 shrink-0">
          <UsersIcon className="size-[18px]" />
        </span>
        <span className="text-ink-800 flex-1 text-[13px]">成员与角色权限</span>
        <span className="text-ink-400 text-[11.5px]">{members.length} 位</span>
        <svg
          viewBox="0 0 24 24"
          className="text-ink-300 size-4 shrink-0"
          fill="none"
          stroke="currentColor"
          strokeWidth={2.2}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M9 18l6-6-6-6" />
        </svg>
      </button>

      <Modal open={open} onOpenChange={setOpen}>
        <ModalContent
          title="成员与角色权限"
          description="手机上只读查看；邀请与改角色在桌面端的「成员与权限」页"
          width="md"
        >
          <ul className="divide-ink-100 border-ink-200 divide-y overflow-hidden rounded-xl border">
            {members.map((member) => (
              <li key={member.membershipId} className="flex items-center gap-3 px-3.5 py-3">
                <Avatar name={member.name} size="sm" tone="soft" />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="text-ink-800 truncate text-[13px] font-medium">
                      {member.name}
                    </span>
                    <RoleBadge role={member.role as Role} />
                  </span>
                  <span className="text-ink-400 mt-0.5 block truncate text-[11.5px]">
                    {member.email} · {member.joinedAtLabel} 加入
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </ModalContent>
      </Modal>
    </>
  );
}
