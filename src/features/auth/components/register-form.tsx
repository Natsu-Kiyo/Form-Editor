'use client';

import Link from 'next/link';
import { useActionState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

import { EMPTY_FORM_STATE } from '@/types/form-state';

import { registerAction } from '../actions/register';
import { AuthAlert } from './auth-alert';
import { FieldError } from './field-error';
import { PasswordField } from './password-field';

export function RegisterForm() {
  const [state, formAction, pending] = useActionState(registerAction, EMPTY_FORM_STATE);

  return (
    <div>
      <h2 className="text-title-l text-ink-900 font-semibold">创建账号</h2>
      <p className="text-body-s text-ink-500 mt-1.5 mb-8">注册后会自动为你开一个工作区</p>

      <form action={formAction} className="space-y-4" noValidate>
        <div>
          <Label htmlFor="name">姓名</Label>
          <Input
            id="name"
            name="name"
            autoComplete="name"
            placeholder="例如：林予"
            defaultValue={state.values?.name}
            className="h-11"
            invalid={Boolean(state.fieldErrors?.name)}
            required
          />
          <FieldError messages={state.fieldErrors?.name} />
        </div>

        <div>
          <Label htmlFor="email">邮箱</Label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            defaultValue={state.values?.email}
            className="h-11"
            invalid={Boolean(state.fieldErrors?.email)}
            required
          />
          <FieldError messages={state.fieldErrors?.email} />
        </div>

        <div>
          <PasswordField
            name="password"
            label="设置密码"
            autoComplete="new-password"
            placeholder="至少 8 位，含字母与数字"
            defaultValue={state.values?.password}
            invalid={Boolean(state.fieldErrors?.password)}
            required
          />
          <FieldError messages={state.fieldErrors?.password} />
        </div>

        <div>
          <PasswordField
            name="confirmPassword"
            label="确认密码"
            autoComplete="new-password"
            placeholder="再输入一次"
            defaultValue={state.values?.confirmPassword}
            invalid={Boolean(state.fieldErrors?.confirmPassword)}
            required
          />
          <FieldError messages={state.fieldErrors?.confirmPassword} />
        </div>

        {state.message ? <AuthAlert>{state.message}</AuthAlert> : null}

        <Button loading={pending} type="submit" size="lg" className="w-full" disabled={pending}>
          {pending ? '创建中…' : '创建账号'}
        </Button>
      </form>

      <p className="text-label text-ink-500 mt-5 text-center">
        已有账号？
        <Link href="/login" className="text-brand-500 hover:text-brand-600 font-medium">
          去登录
        </Link>
      </p>
    </div>
  );
}
