import Link from 'next/link';

import {
  AlertCircleIcon,
  CalendarIcon,
  CheckCircleIcon,
  ClockIcon,
  InfoIcon,
  UsersIcon,
} from '@/components/icons/ui-icons';
import { Button } from '@/components/ui/button';

import type { UnavailableKind, PublicView } from '../api/public-questionnaire';

type Unavailable = Extract<PublicView, { state: 'UNAVAILABLE' }>;

/**
 * 不可用态（设计稿 W13）。
 *
 * 设计稿的原话是「同一版式复用其余三种态，仅更换图标、文案与主按钮」——
 * 所以文案与信息卡**在服务端就按 kind 算好**（见 `api/public-questionnaire.ts`），
 * 这里只负责把五行摆出来：图标、标题、说明、信息卡、主按钮。
 *
 * 五态共用一套版式不是省事，是**为了让人一眼认出这是同一类结果**：
 * 「不能填」和「填错了」是两种体验，前者必须看起来就到此为止。
 */
const KIND_ICON: Record<UnavailableKind, React.ReactNode> = {
  DRAFT: <InfoIcon className="size-6" />,
  NOT_STARTED: <CalendarIcon className="size-6" />,
  PAUSED: <ClockIcon className="size-6" />,
  CLOSED: <AlertCircleIcon className="size-6" />,
  LIMIT_REACHED: <UsersIcon className="size-6" />,
  ALREADY_SUBMITTED: <CheckCircleIcon className="size-6" />,
};

/** 「你已提交过」是好事，用绿色；其余都是「不能填」，用中性色 */
const KIND_TONE: Partial<Record<UnavailableKind, 'ok'>> = { ALREADY_SUBMITTED: 'ok' };

export function UnavailableState({ view }: { view: Unavailable }) {
  const ok = KIND_TONE[view.kind] === 'ok';

  return (
    <div className="text-center">
      <span
        className={
          ok
            ? 'mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600'
            : 'bg-ink-100 text-ink-500 mx-auto mb-4 flex size-12 items-center justify-center rounded-full'
        }
      >
        {KIND_ICON[view.kind]}
      </span>

      <h1 className="text-ink-900 text-[22px] leading-8 font-semibold">{view.heading}</h1>
      <p className="text-ink-500 mt-3 text-[13.5px] leading-6">{view.description}</p>

      <dl className="border-ink-200 bg-ink-50/60 mt-6 grid grid-cols-2 gap-x-4 gap-y-3.5 rounded-xl border p-4 text-left">
        {view.infoRows.map((row) => (
          <div key={row.label} className="min-w-0">
            <dt className="text-ink-400 mb-1 text-[11.5px]">{row.label}</dt>
            <dd className="text-ink-800 truncate text-[13px]">{row.value}</dd>
          </div>
        ))}
      </dl>

      {view.note ? (
        <p className="text-brand-700 mt-4 text-left text-[12.5px] leading-6">{view.note}</p>
      ) : null}

      <Button asChild size="lg" className="mt-8 h-12 w-full">
        <Link href={view.primaryAction.href}>{view.primaryAction.label}</Link>
      </Button>
    </div>
  );
}
