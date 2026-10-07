'use client';

import { useActionState, useState } from 'react';

import { CopyIcon } from '@/components/icons/ui-icons';
import { Button } from '@/components/ui/button';
import { Modal, ModalContent } from '@/components/ui/modal';
import {
  INVITATION_EXPIRES_DAYS,
  ROLE_INVITE_HINT,
  ROLE_LABEL,
  type Role,
} from '@/config/constants';
import { cn } from '@/utils/cn';

import { inviteMemberAction, type InviteMemberState } from '../actions/invite-member';

const INVITABLE_ROLES: Role[] = ['ADMIN', 'EDITOR', 'VIEWER'];

/**
 * 邀请成员弹层（W09 顶栏那颗按钮）。
 *
 * 生成之后**不关弹层**，而是把链接摆出来让人复制 —— 这个功能的全部意义是
 * 「把链接给到对方」，而此时没有邮件通道（本项目不发邮件，链接靠手动转发）。
 * 换句话说：不给链接就关掉弹层，等于让用户再想办法把那串 token 找回来。
 */
export function InviteMemberDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [state, formAction, pending] = useActionState<InviteMemberState, FormData>(
    inviteMemberAction,
    {},
  );
  const [role, setRole] = useState<Role>('EDITOR');
  const [copied, setCopied] = useState(false);

  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <ModalContent
        title="邀请成员"
        description={`生成一条邀请链接，对方打开即加入工作区（${INVITATION_EXPIRES_DAYS} 天后失效）`}
        width="md"
      >
        <form action={formAction} className="space-y-4">
          <div>
            <label
              htmlFor="invite-email"
              className="text-ink-500 mb-1.5 block text-[11.5px] font-medium"
            >
              邮箱
            </label>
            <input
              id="invite-email"
              name="email"
              type="email"
              required
              defaultValue={state.values?.email}
              placeholder="name@example.com"
              className="border-ink-200 text-ink-700 focus:border-brand-500 h-10 w-full rounded-[10px] border bg-white px-3 text-[13px] outline-none"
            />
            {state.fieldErrors?.email ? (
              <p className="mt-1.5 text-[11.5px] text-rose-600">{state.fieldErrors.email[0]}</p>
            ) : null}
          </div>

          <div>
            <span className="text-ink-500 mb-1.5 block text-[11.5px] font-medium">角色</span>
            <input type="hidden" name="role" value={role} />
            <div className="space-y-2">
              {INVITABLE_ROLES.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setRole(item)}
                  className={cn(
                    'w-full rounded-[10px] border px-3.5 py-2.5 text-left transition-colors duration-150',
                    role === item
                      ? 'border-brand-500 bg-brand-50/60'
                      : 'border-ink-200 hover:border-ink-300 bg-white',
                  )}
                >
                  <span className="text-ink-800 text-[13px] font-medium">{ROLE_LABEL[item]}</span>
                  <span className="text-ink-400 mt-0.5 block text-[11.5px] leading-4">
                    {ROLE_INVITE_HINT[item]}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {state.message ? <p className="text-[12px] text-rose-600">{state.message}</p> : null}

          {state.inviteLink ? (
            <div className="border-brand-200 bg-brand-50/50 rounded-[10px] border p-3">
              <p className="text-brand-700 text-[12px] font-medium">
                {state.invitedEmail} 的邀请链接
              </p>
              <p className="text-ink-500 mt-1 font-mono text-[11.5px] break-all">
                {state.inviteLink}
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-2.5 w-full"
                onClick={() => {
                  void navigator.clipboard.writeText(state.inviteLink ?? '');
                  setCopied(true);
                }}
              >
                <CopyIcon className="size-3.5" />
                {copied ? '已复制' : '复制邀请链接'}
              </Button>
            </div>
          ) : null}

          <div className="flex gap-2.5 pt-1">
            {/* 叫「完成」而不是「关闭」：弹层自带的 × 已经占用「关闭」这个名字，
               两个同名按钮对读屏用户与自动化都是噪音 */}
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => onOpenChange(false)}
            >
              完成
            </Button>
            <Button loading={pending} type="submit" className="flex-1" disabled={pending}>
              {pending ? '生成中…' : '生成邀请链接'}
            </Button>
          </div>
        </form>
      </ModalContent>
    </Modal>
  );
}
