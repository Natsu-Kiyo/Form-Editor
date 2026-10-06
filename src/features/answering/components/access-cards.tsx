'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { LockIcon } from '@/components/icons/ui-icons';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

import { unlockQuestionnaireAction } from '../actions/unlock-questionnaire';

/**
 * 口令卡（设计稿 M5 的「作答身份三态」之一）。
 *
 * 口令只在服务端比对，成功后浏览器里只留一个不可伪造的标记；
 * **口令本身既不入库也不回显** —— 所以这里不提供「显示密码」，那会让站在旁边的人一眼看到。
 */
export function UnlockCard({ slug, title }: { slug: string; title: string }) {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const submit = () => {
    setError(null);
    startTransition(async () => {
      const result = await unlockQuestionnaireAction(slug, password);
      if (!result.ok) {
        setError(result.message);
        return;
      }

      // 解锁标记是 Cookie，刷新一次让服务端带着它重新渲染出作答表单
      router.refresh();
    });
  };

  return (
    <div className="text-center">
      <span className="bg-brand-50 text-brand-600 mx-auto mb-4 flex size-12 items-center justify-center rounded-full">
        <LockIcon className="size-6" />
      </span>

      <h1 className="text-ink-900 text-[22px] leading-8 font-semibold">{title}</h1>
      <p className="text-ink-500 mt-3 text-[13.5px] leading-6">
        这份问卷需要访问口令。请向发布者索取后填入。
      </p>

      <form
        className="mt-6 space-y-3 text-left"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <div>
          <Label htmlFor="access-password">访问口令</Label>
          <Input
            id="access-password"
            type="password"
            autoComplete="off"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </div>

        {error ? (
          <p role="alert" className="text-[12px] text-rose-600">
            {error}
          </p>
        ) : null}

        <Button
          type="submit"
          size="lg"
          className="h-12 w-full"
          disabled={pending || password === ''}
        >
          {pending ? '校验中…' : '进入问卷'}
        </Button>
      </form>
    </div>
  );
}

/**
 * 需要登录的问卷。
 *
 * 与「不可用」不是一回事：这里**有出路**，所以给的是登录入口而不是「返回首页」。
 * 带上 `next` 让登录后回到这份问卷 —— 否则用户登录完还得再点一次发来的链接。
 */
export function LoginRequiredCard({ slug, title }: { slug: string; title: string }) {
  return (
    <div className="text-center">
      <span className="bg-brand-50 text-brand-600 mx-auto mb-4 flex size-12 items-center justify-center rounded-full">
        <LockIcon className="size-6" />
      </span>

      <h1 className="text-ink-900 text-[22px] leading-8 font-semibold">{title}</h1>
      <p className="text-ink-500 mt-3 text-[13.5px] leading-6">
        这份问卷需要登录后才能填写，且每个账号限填一份。
      </p>

      <Button asChild size="lg" className="mt-8 h-12 w-full">
        <Link href={`/login?next=${encodeURIComponent(`/s/${slug}`)}`}>登录后填写</Link>
      </Button>
    </div>
  );
}
