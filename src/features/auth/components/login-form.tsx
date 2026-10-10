'use client';

import Link from 'next/link';
import { useActionState } from 'react';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DEMO_ACCOUNTS } from '@/config/constants';
import { EMPTY_FORM_STATE } from '@/types/form-state';

import { loginAction } from '../actions/login';
import { AuthAlert } from './auth-alert';
import { FieldError } from './field-error';
import { PasswordField } from './password-field';

export function LoginForm({ nextPath }: { nextPath?: string }) {
  const [state, formAction, pending] = useActionState(loginAction, EMPTY_FORM_STATE);

  return (
    <div>
      <h2 className="text-title-l text-ink-900 font-semibold">欢迎回来</h2>
      <p className="text-body-s text-ink-500 mt-1.5 mb-8">登录后继续管理你的问卷与团队</p>

      <form action={formAction} className="space-y-4" noValidate>
        {nextPath ? <input type="hidden" name="next" value={nextPath} /> : null}

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

        {/* 不回填：口令只由用户自己再敲一次（理由见 `login.ts` 里那段注释） */}
        <PasswordField
          name="password"
          label="密码"
          autoComplete="current-password"
          placeholder="请输入密码"
          invalid={Boolean(state.fieldErrors?.password)}
          required
        />
        <FieldError messages={state.fieldErrors?.password} />

        {state.message ? <AuthAlert>{state.message}</AuthAlert> : null}

        <div className="flex items-center pt-1">
          <label htmlFor="rememberMe" className="flex cursor-pointer items-center gap-2">
            <Checkbox id="rememberMe" name="rememberMe" defaultChecked />
            <span className="text-label text-ink-600">记住我</span>
          </label>
        </div>

        <Button loading={pending} type="submit" size="lg" className="w-full" disabled={pending}>
          {pending ? '登录中…' : '登录'}
        </Button>
      </form>

      <p className="text-label text-ink-500 mt-5 text-center">
        还没有账号？
        <Link href="/register" className="text-brand-500 hover:text-brand-600 font-medium">
          立即注册
        </Link>
      </p>

      <div className="border-brand-200 bg-brand-50 mt-8 rounded-[10px] border p-3.5">
        <div className="text-brand-700 text-[11.5px] leading-5">
          <b className="text-brand-800 font-medium">演示账号</b>
          <br />
          {DEMO_ACCOUNTS.owner.email} / {DEMO_ACCOUNTS.owner.password}
        </div>
      </div>
    </div>
  );
}
