import type { Metadata } from 'next';

import { IDENTITY_MODE_LABEL, QUESTION_TYPE_LABEL } from '@/config/constants';
import {
  getPublicQuestionnaire,
  type PublicView,
} from '@/features/answering/api/public-questionnaire';

export const metadata: Metadata = { title: '填写问卷' };

/**
 * 公开作答页（短链 `/s/{slug}`）。
 *
 * **这一轮先交付「门与状态」，作答表单本身属 M5**：链接一旦发出去，
 * 最不能接受的就是点开一个框架自带的 404 —— 那看起来像整站坏了。
 * 所以这里先把五种状态各自说清楚，回收中的问卷则给出题目预览（内容是真的，只是还不能提交），
 * 并**明说**提交功能还没到 —— 一个「填完点提交没反应」的表单比预览糟得多。
 *
 * 为什么没有定时任务也能「到期自动截止」：状态判定放在读取时（`getPublicQuestionnaire`），
 * 发现过了结束时间就落库为已截止。这样列表、分享页、公开页看到的是同一个事实。
 */
export default async function PublicQuestionnairePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ src?: string; embed?: string }>;
}) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const view = await getPublicQuestionnaire(slug, query.src ?? null);

  // 嵌入态（`?embed=1`）不显示品牌栏：它要嵌进别人的网页里
  const embedded = query.embed === '1';

  return (
    <main className="bg-ink-50 flex min-h-[100dvh] flex-col items-center px-4 py-10">
      {!embedded ? (
        <p className="text-ink-400 mb-6 text-[12.5px] font-medium tracking-wide">轻问卷</p>
      ) : null}

      <div className="border-ink-200 w-full max-w-[560px] rounded-2xl border bg-white p-7">
        {view.state === 'COLLECTING' ? <Collecting view={view} /> : <NotCollecting view={view} />}
      </div>
    </main>
  );
}

function NotCollecting({
  view,
}: {
  view: Extract<PublicView, { state: 'NOT_FOUND' | 'DRAFT' | 'NOT_STARTED' | 'PAUSED' | 'CLOSED' }>;
}) {
  const message = describeNotCollecting(view);

  return (
    <div className="text-center">
      <h1 className="text-ink-900 mb-2 text-[17px] font-semibold">
        {view.state === 'NOT_FOUND' ? '链接无效' : view.title}
      </h1>
      <p className="text-ink-500 text-[13px] leading-6">{message}</p>
    </div>
  );
}

function describeNotCollecting(
  view: Extract<PublicView, { state: 'NOT_FOUND' | 'DRAFT' | 'NOT_STARTED' | 'PAUSED' | 'CLOSED' }>,
) {
  switch (view.state) {
    case 'NOT_FOUND':
      return '这个链接可能已经失效，或者问卷已被删除。请向发给你链接的人确认。';
    case 'DRAFT':
      return '创建者还没有发布它，请稍后再来。';
    case 'NOT_STARTED':
      return view.startsAtLabel
        ? `回收还没开始，将于 ${view.startsAtLabel} 开放。`
        : '回收还没开始。';
    case 'PAUSED':
      return '创建者暂时关闭了回收，请稍后再试。';
    case 'CLOSED':
      // 说清「为什么不能填」—— 达到上限与到期是两件不同的事
      if (view.closeReason === 'LIMIT_REACHED') return '这份问卷已达到回收上限，感谢参与。';
      if (view.closeReason === 'SCHEDULED' && view.endsAtLabel) {
        return `这份问卷已于 ${view.endsAtLabel} 到期，回收自动截止。`;
      }
      return '这份问卷已经结束回收，感谢参与。';
  }
}

function Collecting({ view }: { view: Extract<PublicView, { state: 'COLLECTING' }> }) {
  return (
    <div>
      <h1 className="text-ink-900 text-[17px] font-semibold">{view.title}</h1>
      {view.intro ? <p className="text-ink-500 mt-2 text-[13px] leading-6">{view.intro}</p> : null}

      <div className="text-ink-400 mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px]">
        <span>{IDENTITY_MODE_LABEL[view.identityMode].title}</span>
        {view.needsPassword ? <span>需要口令</span> : null}
        {view.channelName ? <span>来自渠道：{view.channelName}</span> : null}
      </div>

      <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-3 text-[12px] leading-5 text-amber-800">
        题目预览：<b>作答与提交</b>将在下一轮交付。现在可以先确认题目与文案 ——
        分享链接与二维码都是真实可用的。
      </div>

      <ol className="mt-6 space-y-5">
        {view.questions.map((question, index) => (
          <li key={question.id}>
            <div className="flex items-start gap-2">
              <span className="text-ink-400 mt-0.5 shrink-0 font-mono text-[12px]">
                {index + 1}
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-ink-900 text-[13.5px] font-medium">
                  {question.title}
                  {question.required ? <span className="ml-1 text-rose-500">*</span> : null}
                </div>
                <div className="text-ink-400 mt-0.5 text-[11.5px]">
                  {QUESTION_TYPE_LABEL[question.type]}
                </div>
                {question.description ? (
                  <p className="text-ink-500 mt-1 text-[12px] leading-5">{question.description}</p>
                ) : null}

                {question.options.length > 0 ? (
                  <ul className="mt-2 space-y-1.5">
                    {question.options.map((option) => (
                      <li
                        key={option}
                        className="border-ink-200 text-ink-600 rounded-lg border px-3 py-2 text-[12.5px]"
                      >
                        {option}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
