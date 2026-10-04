import { QUESTIONNAIRE_STATUS_LABEL, type QuestionnaireStatus } from '@/config/constants';
import { cn } from '@/utils/cn';

/** 「已达上限」不是独立状态，而是 CLOSED 的截止原因，故与状态并列 */
export type StatusBadgeStatus = QuestionnaireStatus | 'LIMIT_REACHED';

type Tone = 'positive' | 'warning' | 'danger' | 'brand' | 'neutral' | 'muted';

/**
 * 状态标签永远「圆点 + 文字」。
 * 其中草稿/已归档/已达上限在设计稿里就是无圆点的低优先级态 —— 文字本身已承载语义，
 * 颜色只是辅助，色盲用户靠文案一样能分辨。
 */
const TONE: Record<Tone, { wrapper: string; dot: string | null }> = {
  positive: { wrapper: 'bg-emerald-50 text-emerald-700', dot: 'bg-emerald-500' },
  warning: { wrapper: 'bg-amber-50 text-amber-700', dot: 'bg-amber-500' },
  danger: { wrapper: 'bg-rose-50 text-rose-600', dot: null },
  brand: { wrapper: 'bg-brand-50 text-brand-600', dot: null },
  neutral: { wrapper: 'bg-ink-100 text-ink-600', dot: 'bg-ink-400' },
  muted: { wrapper: 'bg-ink-100 text-ink-500', dot: null },
};

const STATUS_TONE: Record<StatusBadgeStatus, Tone> = {
  DRAFT: 'brand',
  PUBLISHED: 'positive',
  PAUSED: 'warning',
  CLOSED: 'neutral',
  ARCHIVED: 'muted',
  LIMIT_REACHED: 'danger',
};

export function StatusBadge({
  status,
  className,
}: {
  status: StatusBadgeStatus;
  className?: string;
}) {
  const tone = TONE[STATUS_TONE[status]];

  return (
    <span
      className={cn(
        'inline-flex h-6 items-center gap-1.5 rounded-full px-2.5 text-[11.5px] font-medium',
        tone.wrapper,
        className,
      )}
    >
      {tone.dot ? (
        <span className={cn('size-1.5 rounded-full', tone.dot)} aria-hidden="true" />
      ) : null}
      {QUESTIONNAIRE_STATUS_LABEL[status]}
    </span>
  );
}
