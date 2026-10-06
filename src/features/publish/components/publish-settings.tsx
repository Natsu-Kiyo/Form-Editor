'use client';

import { useMemo, useRef, useState, useTransition } from 'react';

import {
  AlertCircleIcon,
  CalendarIcon,
  CheckCircleIcon,
  ClockIcon,
  UserIcon,
} from '@/components/icons/ui-icons';
import { QuestionnaireTopbar } from '@/components/layout/questionnaire-topbar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioCard, RadioCardBadge, RadioGroup } from '@/components/ui/radio-card';
import {
  IDENTITY_MODE_LABEL,
  QUESTIONNAIRE_STATUS_LABEL,
  type IdentityMode,
} from '@/config/constants';
import { parseDateTimeLocal } from '@/utils/format';
import { cn } from '@/utils/cn';

import {
  publishQuestionnaireAction,
  savePublishSettingsAction,
} from '../actions/publish-questionnaire';
import type { PublishPageData } from '../api/publish';
import { runPreflight, type PreflightTone } from '../lib/preflight';

/**
 * 发布设置（W04）。
 *
 * 「发布前检查」在客户端按**同一份纯函数**实时算：用户在左边改一个时间，
 * 右边清单立刻跟着变。服务端发布时用同一份规则再拦一次 ——
 * 界面只是提前把问题显示出来，最终拦截在服务端。
 */
export function PublishSettings({ data, canEdit }: { data: PublishPageData; canEdit: boolean }) {
  const [startsAt, setStartsAt] = useState(data.startsAt);
  const [endsAt, setEndsAt] = useState(data.endsAt);
  const [responseLimit, setResponseLimit] = useState(data.responseLimit);
  const [identityMode, setIdentityMode] = useState<IdentityMode>(data.identityMode);
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const isDraft = data.status === 'DRAFT';

  const preflight = useMemo(
    () =>
      runPreflight({
        questions: data.questions,
        startsAt: parseDateTimeLocal(startsAt),
        endsAt: parseDateTimeLocal(endsAt),
        responseLimit: responseLimit === '' ? null : Number(responseLimit),
        responseCount: data.responseCount,
        identityMode,
        hasPassword: data.hasPassword || password.length > 0,
        now: new Date(),
      }),
    [
      data.questions,
      data.responseCount,
      data.hasPassword,
      startsAt,
      endsAt,
      responseLimit,
      identityMode,
      password,
    ],
  );

  const submit = () => {
    const input = { startsAt, endsAt, responseLimit, identityMode, password };

    startTransition(async () => {
      const result = isDraft
        ? await publishQuestionnaireAction(data.id, input)
        : await savePublishSettingsAction(data.id, input);

      setMessage({ tone: result.ok ? 'ok' : 'error', text: result.message });
      if (result.ok) setPassword('');
    });
  };

  return (
    <>
      <QuestionnaireTopbar
        titleSlot={
          <h1 className="text-ink-900 truncate text-[15px] font-semibold">{data.title}</h1>
        }
      >
        {!isDraft ? <StatusPill data={data} /> : null}

        {canEdit ? (
          <Button
            type="button"
            disabled={pending || (isDraft && !preflight.canPublish)}
            onClick={submit}
          >
            {isDraft ? '保存并发布' : '保存设置'}
          </Button>
        ) : null}
      </QuestionnaireTopbar>

      <main className="flex-1 overflow-y-auto p-7">
        <div className="mx-auto flex max-w-[1020px] items-start gap-6">
          <div className="min-w-0 flex-1 space-y-5">
            {message ? <Alert tone={message.tone} text={message.text} /> : null}

            <SettingCard
              icon={<CalendarIcon className="size-4" />}
              title="回收时间"
              hint="不设置则长期开放，直到你手动截止。"
            >
              <div className="grid grid-cols-2 gap-4">
                <DateTimeField
                  id="starts-at"
                  label="开始时间"
                  value={startsAt}
                  disabled={!canEdit}
                  onChange={setStartsAt}
                />
                <DateTimeField
                  id="ends-at"
                  label="结束时间"
                  value={endsAt}
                  disabled={!canEdit}
                  onChange={setEndsAt}
                />
              </div>

              {/* 设计稿这里是一个勾选框。做成勾选框就得回答「不勾的时候结束时间算什么」，
                  而两种答案都别扭：存了不生效是骗人，清空则丢掉用户刚填的东西。
                  结束时间的后果本来就只有一种，所以改成一句说明。 */}
              <p className="text-ink-500 mt-4 text-[12.5px] leading-5">
                到结束时间会自动截止回收、作答链接失效；两项都留空则长期开放，直到你手动截止。
              </p>
            </SettingCard>

            <SettingCard
              icon={<ClockIcon className="size-4" />}
              title="回收份数上限"
              hint="达到上限后自动截止，避免超收。留空表示不限制。"
            >
              <div className="flex items-center gap-4">
                <div className="flex w-40 items-center">
                  <Input
                    type="number"
                    min={1}
                    aria-label="回收份数上限"
                    placeholder="不限制"
                    value={responseLimit}
                    disabled={!canEdit}
                    onChange={(event) => setResponseLimit(event.target.value)}
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="mb-1.5 flex items-center justify-between text-[11.5px]">
                    <span className="text-ink-500">当前已回收 {data.responseCount} 份</span>
                    <span className="text-ink-500 font-mono">
                      {limitRatio(responseLimit, data.responseCount)}
                    </span>
                  </div>
                  <ProgressBar ratio={limitRatioValue(responseLimit, data.responseCount)} />
                </div>
              </div>
            </SettingCard>

            <SettingCard
              icon={<UserIcon className="size-4" />}
              title="作答身份"
              hint="决定谁能填写、以及是否需要登录。"
            >
              <RadioGroup
                value={identityMode}
                onValueChange={(next) => setIdentityMode(next as IdentityMode)}
                disabled={!canEdit}
                className="space-y-2.5"
                aria-label="作答身份"
              >
                {(Object.keys(IDENTITY_MODE_LABEL) as IdentityMode[]).map((mode) => (
                  <RadioCard
                    key={mode}
                    value={mode}
                    title={IDENTITY_MODE_LABEL[mode].title}
                    description={IDENTITY_MODE_LABEL[mode].description}
                    badge={mode === 'ANONYMOUS' ? <RadioCardBadge>推荐</RadioCardBadge> : undefined}
                  />
                ))}
              </RadioGroup>

              {identityMode === 'PASSWORD' ? (
                <div className="mt-4">
                  <Label htmlFor="access-password">访问口令</Label>
                  <Input
                    id="access-password"
                    type="password"
                    autoComplete="new-password"
                    placeholder={data.hasPassword ? '留空则沿用上次设置的口令' : '至少 4 位'}
                    value={password}
                    disabled={!canEdit}
                    onChange={(event) => setPassword(event.target.value)}
                  />
                </div>
              ) : null}
            </SettingCard>
          </div>

          <aside className="w-[300px] shrink-0 space-y-4">
            <PreflightCard preflight={preflight} />

            <div className="bg-brand-50 border-brand-200 rounded-xl border p-5">
              <div className="text-brand-800 mb-2 text-[12.5px] font-semibold">发布即冻结结构</div>
              <p className="text-brand-700 text-[12px] leading-5">
                发布后题目结构不可再修改，如需调整请复制为新问卷。这是为了保证历史答卷与统计口径的一致性。
              </p>
            </div>
          </aside>
        </div>
      </main>
    </>
  );
}

/**
 * 日期时间输入。
 *
 * 刻意**不直接把** `<input type="datetime-local">` 交给人填：它的占位与格式由浏览器决定，
 * 中文环境下会显示成 `yyyy/mm/日 --:--` 这种中英混排（实测），与页面其它文案对不上，
 * 而且没法通过 CSS 改写。
 *
 * 所以用文本框显示统一格式（`2026-10-20 23:59`），旁边那个日历按钮再唤起原生选择器 ——
 * 想点选的用户仍然点得到，而看到的东西始终一致。
 */
function DateTimeField({
  id,
  label,
  value,
  disabled,
  onChange,
}: {
  id: string;
  label: string;
  /** 页面里流转的是 `datetime-local` 的写法（`2026-10-20T23:59`），展示时换成空格 */
  value: string;
  disabled: boolean;
  onChange: (next: string) => void;
}) {
  const pickerRef = useRef<HTMLInputElement>(null);

  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Input
          id={id}
          value={value.replace('T', ' ')}
          // 占位是**格式**而不是一个具体日期：写 `2026-10-20 23:59` 会被读成
          // 「已经填好的值，只是灰了」，清空之后尤其容易误判。写成格式就只剩一种理解。
          placeholder="yyyy-mm-dd hh:mm"
          disabled={disabled}
          className="pr-10"
          onChange={(event) => onChange(event.target.value.replace(/\s/, 'T'))}
        />
        <button
          type="button"
          aria-label={`选择${label}`}
          disabled={disabled}
          onClick={() => {
            const picker = pickerRef.current;
            if (!picker) return;

            try {
              picker.showPicker();
            } catch {
              // 浏览器不支持（或要求用户手势）时忽略：文本框照样能手填
            }
          }}
          className="text-ink-400 hover:text-ink-600 absolute top-1/2 right-3 -translate-y-1/2 disabled:opacity-45"
        >
          <CalendarIcon className="size-4" />
        </button>

        {/* 原生输入框只用来提供选择器，自己不显示、也不参与 Tab 顺序 */}
        <input
          ref={pickerRef}
          type="datetime-local"
          value={value}
          tabIndex={-1}
          aria-hidden="true"
          className="sr-only"
          onChange={(event) => onChange(event.target.value)}
        />
      </div>
    </div>
  );
}

function limitRatio(limit: string, collected: number) {
  const value = Number(limit);
  if (limit === '' || !Number.isFinite(value) || value <= 0) return '不限制';

  return `${Math.min(100, Math.round((collected / value) * 100))}%`;
}

function limitRatioValue(limit: string, collected: number) {
  const value = Number(limit);
  if (limit === '' || !Number.isFinite(value) || value <= 0) return 0;

  return Math.min(1, collected / value);
}

function ProgressBar({ ratio, tone = 'brand' }: { ratio: number; tone?: 'brand' | 'emerald' }) {
  return (
    <div className="bg-ink-100 h-2 overflow-hidden rounded-full">
      <div
        className={cn('h-full rounded-full', tone === 'brand' ? 'bg-brand-500' : 'bg-emerald-500')}
        style={{ width: `${Math.round(ratio * 100)}%` }}
      />
    </div>
  );
}

function SettingCard({
  icon,
  title,
  hint,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  hint: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border-ink-200 rounded-xl border bg-white p-6">
      <div className="mb-1 flex items-center gap-2">
        <span className="text-brand-500">{icon}</span>
        <h2 className="text-ink-900 text-[15px] font-semibold">{title}</h2>
      </div>
      <p className="text-ink-500 mb-5 text-[12.5px]">{hint}</p>
      {children}
    </div>
  );
}

const TONE_ICON: Record<PreflightTone, React.ReactNode> = {
  ok: <CheckCircleIcon className="size-4 shrink-0 text-emerald-500" />,
  warn: <AlertCircleIcon className="size-4 shrink-0 text-amber-500" />,
  error: <AlertCircleIcon className="size-4 shrink-0 text-rose-500" />,
};

function PreflightCard({ preflight }: { preflight: ReturnType<typeof runPreflight> }) {
  return (
    <div className="border-ink-200 rounded-xl border bg-white p-5">
      <h3 className="text-ink-900 mb-4 text-[13.5px] font-semibold">发布前检查</h3>

      <div className="space-y-3">
        {preflight.checks.map((check) => (
          <div key={check.id} className="flex items-start gap-2.5">
            <span className="mt-0.5">{TONE_ICON[check.tone]}</span>
            <span className="text-ink-600 text-[12.5px] leading-5">{check.text}</span>
          </div>
        ))}
      </div>

      <div className="border-ink-100 mt-5 border-t pt-4">
        <div className="mb-2 flex items-center justify-between text-[12px]">
          <span className="text-ink-500">完整度</span>
          <span
            className={
              preflight.canPublish ? 'font-medium text-emerald-600' : 'font-medium text-amber-600'
            }
          >
            {preflight.canPublish ? '可以发布' : `还有 ${preflight.blockerCount} 项要处理`}
          </span>
        </div>
        <ProgressBar
          ratio={preflight.passedRatio}
          tone={preflight.canPublish ? 'emerald' : 'brand'}
        />
      </div>
    </div>
  );
}

function StatusPill({ data }: { data: PublishPageData }) {
  const closed = data.status === 'CLOSED' || data.status === 'ARCHIVED';

  return (
    <span
      className={cn(
        'inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3 text-[12px] font-medium',
        closed ? 'bg-ink-100 text-ink-600' : 'bg-emerald-50 text-emerald-700',
      )}
    >
      <span
        className={cn('size-1.5 rounded-full', closed ? 'bg-ink-400' : 'bg-emerald-500')}
        aria-hidden="true"
      />
      {QUESTIONNAIRE_STATUS_LABEL[data.status]}
      {data.closedAtLabel ? (
        <span className="text-ink-400 font-normal">{data.closedAtLabel}</span>
      ) : null}
    </span>
  );
}

function Alert({ tone, text }: { tone: 'ok' | 'error'; text: string }) {
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={cn(
        'flex items-start gap-2 rounded-xl border p-3.5 text-[12.5px] leading-5',
        tone === 'error'
          ? 'border-rose-200 bg-rose-50 text-rose-700'
          : 'border-emerald-200 bg-emerald-50 text-emerald-700',
      )}
    >
      {tone === 'error' ? (
        <AlertCircleIcon className="mt-0.5 size-4 shrink-0" />
      ) : (
        <CheckCircleIcon className="mt-0.5 size-4 shrink-0" />
      )}
      {text}
    </div>
  );
}
