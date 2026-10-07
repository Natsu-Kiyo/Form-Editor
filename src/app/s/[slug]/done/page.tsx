import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { CheckCircleIcon } from '@/components/icons/ui-icons';
import { Button } from '@/components/ui/button';
import { getSubmittedResponse } from '@/features/answering/api/public-questionnaire';

export const metadata: Metadata = { title: '提交成功' };

/**
 * 提交结果页（设计稿 W14）。
 *
 * 三条来自设计稿的判断：
 * - **本页是终点**：不给「回到作答页」的入口。浏览器返回键可能回到那个页面，
 *   但那边会显示「你已提交过」—— 这正是我们想要的效果，不必在这里再挡一次。
 * - **不渲染「再填一份」**：设计稿有这个按钮，但它与本项目的「每份问卷每人限填一次」
 *   直接冲突（点下去必然进「你已提交过」）。宁可少一个按钮，也不给一个必然走不通的入口。
 * - 「数据用途」按作答身份如实写：匿名收集就说匿名，登录作答就说明答卷与账号关联 ——
 *   这句话是给作答者看的，写错比不写更糟。
 */
export default async function SubmittedPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ r?: string }>;
}) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const response = query.r ? await getSubmittedResponse(slug, query.r) : null;

  if (!response) notFound();

  return (
    <main className="bg-ink-50 flex min-h-[100dvh] flex-col items-center px-4 py-10">
      <p className="text-ink-400 mb-6 text-[12.5px] font-medium tracking-wide">轻问卷</p>

      <div className="border-ink-200 w-full max-w-[560px] rounded-2xl border bg-white p-7 text-center">
        <span className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
          <CheckCircleIcon className="size-6" />
        </span>

        <h1 className="text-ink-900 text-[22px] leading-8 font-semibold">提交成功</h1>
        <p className="text-ink-500 mt-3 text-[13.5px] leading-6">
          感谢你的参与。你的答卷编号为{' '}
          <span className="text-ink-700 font-mono">#{response.serial}</span>
        </p>

        <dl className="border-ink-200 bg-ink-50/60 mt-6 grid grid-cols-2 gap-x-4 gap-y-3.5 rounded-xl border p-4 text-left">
          <div className="col-span-2 min-w-0">
            <dt className="text-ink-400 mb-1 text-[11.5px]">问卷名称</dt>
            <dd className="text-ink-800 truncate text-[13px] font-medium">{response.title}</dd>
          </div>
          <div className="min-w-0">
            <dt className="text-ink-400 mb-1 text-[11.5px]">提交时间</dt>
            <dd className="text-ink-800 font-mono text-[13px]">{response.submittedAtLabel}</dd>
          </div>
          <div className="min-w-0">
            <dt className="text-ink-400 mb-1 text-[11.5px]">答复方式</dt>
            <dd className="text-ink-800 text-[13px]">
              {/* 三种作答身份各有各的说法。原先只有「匿名 / 否则登录」两路，
                  于是**口令访问的问卷被写成了「登录提交」** —— 那是错的，而且很具体地错：
                  提交者根本没登录 */}
              {response.identityMode === 'ANONYMOUS'
                ? '匿名提交'
                : response.identityMode === 'PASSWORD'
                  ? '口令提交'
                  : '登录提交'}
            </dd>
          </div>
          <div className="col-span-2 min-w-0">
            <dt className="text-ink-400 mb-1 text-[11.5px]">数据用途</dt>
            <dd className="text-ink-800 text-[13px] leading-5">
              {response.identityMode === 'ANONYMOUS'
                ? '本问卷为匿名收集，不会记录你的身份信息。如需撤回，请联系发布者。'
                : response.identityMode === 'PASSWORD'
                  ? // 只说确定的事：口令用于进入填写，它本身不随答卷保存。
                    // 「是否与账号关联」取决于提交时有没有登录，这里不替用户下结论
                    '本问卷用口令控制访问，口令仅用于进入填写、不随答卷保存。如需撤回，请联系发布者。'
                  : '本次作答与你的账号关联。如需撤回或修改，请联系发布者。'}
            </dd>
          </div>
        </dl>

        <Button asChild size="lg" className="mt-8 h-12 w-full">
          <Link href="/">返回首页</Link>
        </Button>

        <p className="text-ink-400 mt-5 text-[11.5px] leading-5">
          提交后本页即为终点，浏览器返回键不会再回到作答页。
        </p>
      </div>
    </main>
  );
}
