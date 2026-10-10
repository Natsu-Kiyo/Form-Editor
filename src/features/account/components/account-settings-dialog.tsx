'use client';

import { useActionState, useState, useTransition } from 'react';

import { LockIcon, MailIcon } from '@/components/icons/ui-icons';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Modal, ModalContent } from '@/components/ui/modal';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { EMPTY_FORM_STATE } from '@/types/form-state';

import { changePasswordAction, updateProfileAction } from '../actions/profile';
import { signOutAllDevicesAction } from '../actions/sessions';

export type AccountSettingsTab = 'profile' | 'security';

const TAB_OPTIONS = [
  { value: 'profile' as const, label: '个人信息' },
  { value: 'security' as const, label: '账号与安全' },
];

export type AccountSettingsDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tab: AccountSettingsTab;
  onTabChange: (tab: AccountSettingsTab) => void;
  userName: string;
  userEmail: string;
  passwordUpdatedAtLabel: string | null;
  activeSessionCount: number;
};

/**
 * 账号设置弹层。两个 Tab：个人信息 / 账号与安全。
 *
 * 相对设计稿有两处**刻意收敛**，都是为了不出现假入口：
 * - 不做「更换头像」：本版本没有对象存储，上传无处可去。头像取姓名首字。
 * - 「绑定邮箱」只读且不给「更换」按钮：换邮箱需要邮件验证，而本项目不接邮件服务。
 * - 设计稿里的「绑定手机号」整行不做：不在 1.0 范围内，且需要短信服务。
 */
export function AccountSettingsDialog({
  open,
  onOpenChange,
  tab,
  onTabChange,
  userName,
  userEmail,
  passwordUpdatedAtLabel,
  activeSessionCount,
}: AccountSettingsDialogProps) {
  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <ModalContent title="账号设置" width="md">
        <SegmentedControl
          stretch
          value={tab}
          onValueChange={onTabChange}
          options={TAB_OPTIONS}
          aria-label="账号设置分类"
          className="mb-5"
        />

        {/* 只在弹层打开时挂载：Radix 关闭会卸载内容，表单状态随之重置 */}
        {open && tab === 'profile' ? (
          <ProfileForm
            userName={userName}
            userEmail={userEmail}
            onCancel={() => onOpenChange(false)}
          />
        ) : null}

        {open && tab === 'security' ? (
          <SecurityTab
            userEmail={userEmail}
            passwordUpdatedAtLabel={passwordUpdatedAtLabel}
            activeSessionCount={activeSessionCount}
          />
        ) : null}
      </ModalContent>
    </Modal>
  );
}

function ProfileForm({
  userName,
  userEmail,
  onCancel,
}: {
  userName: string;
  userEmail: string;
  onCancel: () => void;
}) {
  const [state, formAction, pending] = useActionState(updateProfileAction, EMPTY_FORM_STATE);

  return (
    <form action={formAction} className="space-y-4" noValidate>
      <Avatar name={userName} size="lg" tone="soft" />

      <div>
        <Label htmlFor="profile-name" required>
          姓名
        </Label>
        <Input
          id="profile-name"
          name="name"
          defaultValue={state.values?.name ?? userName}
          invalid={Boolean(state.fieldErrors?.name)}
          required
        />
        {state.fieldErrors?.name ? (
          <p className="text-caption mt-1.5 text-rose-500">{state.fieldErrors.name.join('，')}</p>
        ) : null}
      </div>

      <div>
        <Label>邮箱</Label>
        <div className="text-ink-500 border-ink-200 bg-ink-50 text-body-s flex h-10 items-center rounded-lg border px-3.5">
          {userEmail}
        </div>
      </div>

      {state.success ? <p className="text-caption text-emerald-600">{state.success}</p> : null}
      {state.message ? <p className="text-caption text-rose-500">{state.message}</p> : null}

      <div className="flex gap-2.5 pt-1">
        <Button type="button" variant="outline" className="flex-1" onClick={onCancel}>
          取消
        </Button>
        <Button loading={pending} type="submit" className="flex-1" disabled={pending}>
          {pending ? '保存中…' : '保存'}
        </Button>
      </div>
    </form>
  );
}

function SecurityTab({
  userEmail,
  passwordUpdatedAtLabel,
  activeSessionCount,
}: {
  userEmail: string;
  passwordUpdatedAtLabel: string | null;
  activeSessionCount: number;
}) {
  const [changing, setChanging] = useState(false);
  const [pending, startTransition] = useTransition();

  return (
    <div className="space-y-2.5">
      <div className="border-ink-200 flex items-center gap-3 rounded-[10px] border p-3.5">
        <LockIcon className="text-ink-500 size-4 shrink-0" />
        <span className="min-w-0 flex-1">
          <span className="text-ink-900 block text-[13px] font-medium">登录密码</span>
          <span className="text-ink-400 mt-0.5 block text-[11px]">
            {passwordUpdatedAtLabel ? `上次修改 ${passwordUpdatedAtLabel}` : '尚未记录修改时间'}
          </span>
        </span>
        <Button size="sm" variant="outline" onClick={() => setChanging((value) => !value)}>
          {changing ? '收起' : '修改'}
        </Button>
      </div>

      {changing ? <ChangePasswordForm /> : null}

      <div className="border-ink-200 flex items-center gap-3 rounded-[10px] border p-3.5">
        <MailIcon className="text-ink-500 size-4 shrink-0" />
        <span className="min-w-0 flex-1">
          <span className="text-ink-900 block text-[13px] font-medium">绑定邮箱</span>
          <span className="text-ink-400 mt-0.5 block text-[11px] break-all">
            {userEmail} · 登录凭据
          </span>
        </span>
      </div>

      <div className="border-ink-100 mt-5 flex items-center justify-between gap-4 border-t pt-4">
        <div>
          <div className="text-ink-800 text-[12.5px] font-medium">登录设备</div>
          <div className="text-ink-400 mt-0.5 text-[11px]">
            当前 {activeSessionCount} 台设备登录中
          </div>
        </div>
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              await signOutAllDevicesAction();
            })
          }
          className="text-[12px] font-medium text-rose-600 transition-colors duration-150 hover:text-rose-700 disabled:opacity-45"
        >
          退出全部设备
        </button>
      </div>
    </div>
  );
}

function ChangePasswordForm() {
  const [state, formAction, pending] = useActionState(changePasswordAction, EMPTY_FORM_STATE);

  return (
    <form
      action={formAction}
      className="bg-ink-50 border-ink-100 space-y-3 rounded-[10px] border p-3.5"
      noValidate
    >
      <div>
        <Label htmlFor="current-password" required>
          当前密码
        </Label>
        <Input
          id="current-password"
          name="currentPassword"
          type="password"
          autoComplete="current-password"
          invalid={Boolean(state.fieldErrors?.currentPassword)}
          required
        />
        {state.fieldErrors?.currentPassword ? (
          <p className="text-caption mt-1.5 text-rose-500">
            {state.fieldErrors.currentPassword.join('，')}
          </p>
        ) : null}
      </div>

      <div>
        <Label htmlFor="new-password" required>
          新密码
        </Label>
        <Input
          id="new-password"
          name="newPassword"
          type="password"
          autoComplete="new-password"
          placeholder="至少 8 位，含字母与数字"
          invalid={Boolean(state.fieldErrors?.newPassword)}
          required
        />
        {state.fieldErrors?.newPassword ? (
          <p className="text-caption mt-1.5 text-rose-500">
            {state.fieldErrors.newPassword.join('，')}
          </p>
        ) : null}
      </div>

      {state.success ? <p className="text-caption text-emerald-600">{state.success}</p> : null}
      {state.message ? <p className="text-caption text-rose-500">{state.message}</p> : null}

      <Button loading={pending} type="submit" size="sm" disabled={pending}>
        {pending ? '提交中…' : '确认修改'}
      </Button>
    </form>
  );
}
