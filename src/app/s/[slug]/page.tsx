import type { Metadata } from 'next';
import Link from 'next/link';
import { cookies, headers } from 'next/headers';

import { Button } from '@/components/ui/button';
import { IDENTITY_MODE_LABEL } from '@/config/constants';
import {
  getAccessPasswordHash,
  getPublicQuestionnaire,
  recordQuestionnaireView,
} from '@/features/answering/api/public-questionnaire';
import { LoginRequiredCard, UnlockCard } from '@/features/answering/components/access-cards';
import { AnsweringForm } from '@/features/answering/components/answering-form';
import { UnavailableState } from '@/features/answering/components/unavailable-state';
import { buildFingerprint } from '@/features/answering/lib/fingerprint';
import { isUnlocked } from '@/features/answering/lib/unlock';
import { getCurrentUser } from '@/lib/auth/dal';

export const metadata: Metadata = { title: '填写问卷' };

/**
 * 公开作答页（短链 `/s/{slug}`，设计稿 W12 可作答 / W13 五种不可用态）。
 *
 * 一次渲染决定「能不能填」：公开链接没有身份，判断依据只有三样 ——
 * 问卷自身状态、`?src=` 渠道、以及浏览器身份（Cookie 里的随机 id / 登录态）。
 * 这三样都在服务端算，所以打开链接**第一眼**就是正确的画面，不会先闪一下表单再跳走。
 *
 * 故意不做静态化：同一份问卷对不同访客给出的结果不同（已提交过 / 需登录 / 需口令）。
 */
export const dynamic = 'force-dynamic';

export default async function PublicQuestionnairePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ src?: string; embed?: string }>;
}) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const [cookieStore, requestHeaders, user] = await Promise.all([
    cookies(),
    headers(),
    getCurrentUser(),
  ]);

  const clientId = cookieStore.get('qw_client_id')?.value ?? null;
  const userAgent = requestHeaders.get('user-agent');
  // 与提交时用的是同一个函数：页面判「已提交过」与实际拦截的依据必须一致
  const fingerprint = clientId || userAgent ? buildFingerprint(clientId, userAgent) : null;

  const access = await getAccessPasswordHash(slug);
  const unlocked = access ? await isUnlocked(access.id, access.accessPasswordHash) : false;

  const view = await getPublicQuestionnaire(
    slug,
    { srcToken: query.src ?? null, fingerprint, respondentId: user?.id ?? null },
    unlocked,
  );

  const embedded = query.embed === '1';

  // 可作答：表单自带版式（左侧题目 + 右侧题号导航），不套外层的居中卡片
  if (view.state === 'COLLECTING' && !view.locked && !view.needsLogin) {
    // 记一次打开，作为完成率的分母（只在这里记，理由见该函数说明）
    await recordQuestionnaireView(slug);

    return (
      <main className="bg-ink-50 min-h-[100dvh]">
        <AnsweringForm
          slug={slug}
          title={view.title}
          intro={view.intro}
          questions={view.questions}
          identityLabel={
            view.identityMode === 'ANONYMOUS'
              ? '匿名收集，不记录身份信息'
              : user
                ? `已登录：${user.name}`
                : IDENTITY_MODE_LABEL[view.identityMode].title
          }
          channelName={view.channelName}
          srcToken={query.src ?? null}
        />
      </main>
    );
  }

  return (
    <main className="bg-ink-50 flex min-h-[100dvh] flex-col items-center px-4 py-10">
      {!embedded ? (
        <p className="text-ink-400 mb-6 text-[12.5px] font-medium tracking-wide">轻问卷</p>
      ) : null}

      <div className="border-ink-200 w-full max-w-[560px] rounded-2xl border bg-white p-7">
        {view.state === 'NOT_FOUND' ? (
          <div className="text-center">
            <h1 className="text-ink-900 text-[22px] leading-8 font-semibold">链接无效</h1>
            <p className="text-ink-500 mt-3 text-[13.5px] leading-6">
              这个链接可能已经失效，或者问卷已被删除。请向发给你链接的人确认。
            </p>
            <Button asChild size="lg" className="mt-8 h-12 w-full">
              <Link href="/">返回首页</Link>
            </Button>
          </div>
        ) : view.state === 'UNAVAILABLE' ? (
          <UnavailableState view={view} />
        ) : view.locked ? (
          <UnlockCard slug={slug} title={view.title} />
        ) : (
          <LoginRequiredCard slug={slug} title={view.title} />
        )}
      </div>
    </main>
  );
}
