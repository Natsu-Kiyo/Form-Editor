'use client';

import { useEffect, useMemo, useRef, useState, useSyncExternalStore, useTransition } from 'react';
import { useRouter } from 'next/navigation';

import { AlertCircleIcon, CheckIcon } from '@/components/icons/ui-icons';
import { Button } from '@/components/ui/button';
import { RATING_SCALE } from '@/config/constants';
import { useIsDesktop } from '@/hooks/use-is-desktop';
import { cn } from '@/utils/cn';

import { submitResponseAction } from '../actions/submit-response';
import type { PublicQuestion } from '../api/public-questionnaire';
import { describeAnswerHint, isAnswered, type AnswerValue } from '../lib/answers';
import {
  clearDraft,
  getDraftServerSnapshot,
  getDraftSnapshot,
  setAnswerValue,
  subscribeDraft,
  wasDraftRestored,
} from '../lib/draft-store';

/**
 * 匿名重复判定用的浏览器标识。
 *
 * 存**Cookie 而不是 localStorage**：判断「你已提交过」发生在**服务端渲染**时
 *（打开链接就要直接看到那个状态页，而不是先渲染表单再跳走），
 * 而 localStorage 在服务端读不到。Cookie 两边都能读，也就只有一份真相。
 */
function ensureClientId() {
  const key = 'qw_client_id';
  const existing = document.cookie
    .split('; ')
    .find((row) => row.startsWith(`${key}=`))
    ?.slice(key.length + 1);

  if (existing) return decodeURIComponent(existing);

  const created = crypto.randomUUID();
  // 一年有效期：它只是「同一台浏览器」的标记，不该在刷新后就换一个
  document.cookie = `${key}=${encodeURIComponent(created)}; path=/; max-age=${365 * 24 * 60 * 60}; samesite=lax`;

  return created;
}

/**
 * 作答表单（设计稿 W12）。
 *
 * 三条关键行为：
 * - **断点续填**：答案随手存进 localStorage（防抖），刷新/关页面回来还在。
 *   存的是本地而不是服务端草稿 —— 公开链接没有身份，服务端存草稿就得先发明一个访客身份，
 *   而那份「未提交的答案」在服务端是纯负担。
 * - **必答校验在客户端先做一遍**（并滚到第一道未答的题），但**服务端会再校验一遍**：
 *   两道防线用的是同一个纯函数（`lib/answers.ts`），不会出现「前端说必答、后端放过去」。
 * - 提交遇到「问卷已不可用」（刚被截止 / 刚被收满 / 已在别处提交过）时，**不报错而是刷新**，
 *   由服务端渲染出对应的状态页 —— 那才是用户该看到的东西。
 */
export function AnsweringForm({
  slug,
  title,
  intro,
  questions,
  identityLabel,
  channelName,
  srcToken,
}: {
  slug: string;
  title: string;
  intro: string | null;
  questions: PublicQuestion[];
  identityLabel: string;
  channelName: string | null;
  srcToken: string | null;
}) {
  const router = useRouter();
  const isDesktop = useIsDesktop();

  // 草稿走 store（见 `lib/draft-store.ts`）：服务端渲染一个空快照、客户端挂载后自动切到真实值，
  // 既不必在 effect 里 setState，也不会有 hydration 不一致
  const answers = useSyncExternalStore(
    subscribeDraft,
    () => getDraftSnapshot(slug),
    getDraftServerSnapshot,
  );
  const restored = wasDraftRestored(slug);
  const hasDraft = Object.keys(answers).length > 0;

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [activeId, setActiveId] = useState<string | null>(questions[0]?.id ?? null);
  const startedAt = useRef(0);

  const sections = useMemo(() => groupBySection(questions), [questions]);
  const answeredCount = questions.filter((question) => isAnswered(answers[question.id])).length;

  // 首次访问就把浏览器标识种下：**服务端渲染时要读它**判断「你已提交过」，
  // 而那时客户端 JS 还没跑，所以必须尽早写。
  // 顺便记下开始作答的时刻 —— 统计页的「平均用时」就是「这一刻到点提交」。
  // 口径刻意写成「从打开作答页算起」（而不是从第一次答题算起），因为它简单且可解释：
  // 用户能自己复现这个数（再次打开、填完、看用了多久）。
  useEffect(() => {
    ensureClientId();
    startedAt.current = Date.now();
  }, []);

  // ---- 当前题高亮（题号导航用）----
  useEffect(() => {
    const elements = questions
      .map((question) => document.getElementById(`q-${question.id}`))
      .filter((element): element is HTMLElement => element !== null);

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.find((entry) => entry.isIntersecting);
        if (visible?.target.id) setActiveId(visible.target.id.replace('q-', ''));
      },
      { rootMargin: '-96px 0px -70% 0px' },
    );

    elements.forEach((element) => observer.observe(element));

    return () => observer.disconnect();
  }, [questions]);

  const setAnswer = (questionId: string, value: AnswerValue) => {
    setAnswerValue(slug, questionId, value);
    setErrors((previous) => {
      if (!(questionId in previous)) return previous;
      const next = { ...previous };
      delete next[questionId];

      return next;
    });
  };

  const scrollToQuestion = (questionId: string) => {
    document
      .getElementById(`q-${questionId}`)
      ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const submit = () => {
    setNotice(null);

    const missing = questions.filter(
      (question) => question.required && !isAnswered(answers[question.id]),
    );

    if (missing.length > 0) {
      setErrors(Object.fromEntries(missing.map((question) => [question.id, '这是必答题'])));
      setNotice(`还有 ${missing.length} 道必答题没填，已跳转到第一道`);
      scrollToQuestion(missing[0]!.id);

      return;
    }

    startTransition(async () => {
      // 浏览器标识不随请求带上：服务端自己从 Cookie 读，
      // 免得「客户端传的值」与「页面判定用的值」出现两份可能不一致的来源
      const result = await submitResponseAction({
        slug,
        answers,
        srcToken,
        durationMs: startedAt.current > 0 ? Date.now() - startedAt.current : null,
      });

      if (result.ok) {
        // 提交成功就清掉草稿：留着它只会让下一次打开时误报「已为你恢复」
        clearDraft(slug);
        router.push(`/s/${slug}/done?r=${result.responseId}`);

        return;
      }

      if (result.kind === 'VALIDATION') {
        setErrors(result.fieldErrors);
        const first = Object.keys(result.fieldErrors)[0];
        if (first) scrollToQuestion(first);
        setNotice('还有题目需要修改');

        return;
      }

      if (result.kind === 'UNAVAILABLE') {
        // 问卷刚被截止 / 收满 / 已在别处提交过：刷新让服务端渲染对应状态页，
        // 在这里弹一句「已截止」用户是不知道该怎么办的
        router.refresh();

        return;
      }

      setNotice(result.message);
    });
  };

  return (
    <div className="pb-24 sm:pb-0">
      {/* 窄屏：顶部进度条 + 底部固定提交；题号导航只给桌面（长问卷在手机上靠滚） */}
      {!isDesktop ? (
        <div className="border-ink-200 sticky top-0 z-10 border-b bg-white/95 backdrop-blur">
          <div className="flex items-center justify-between px-4 py-2.5 text-[12px]">
            <span className="text-ink-500 truncate">{title}</span>
            <span className="text-ink-500 shrink-0 font-mono">
              已答 {answeredCount} / {questions.length}
            </span>
          </div>
          <div className="bg-ink-100 h-1">
            <div
              className="bg-brand-500 h-full transition-all duration-300"
              style={{
                width: `${questions.length ? (answeredCount / questions.length) * 100 : 0}%`,
              }}
            />
          </div>
        </div>
      ) : null}

      <div className="mx-auto flex w-full max-w-[1080px] items-start gap-8 px-5 py-8 sm:px-6">
        <div className="min-w-0 flex-1">
          <header className="border-ink-200 mb-3 rounded-2xl border bg-white p-7">
            <h1 className="text-ink-900 text-[24px] leading-9 font-semibold tracking-[-0.01em]">
              {title}
            </h1>
            {intro ? <p className="text-ink-500 mt-2.5 text-[13.5px] leading-6">{intro}</p> : null}

            <div className="text-ink-500 mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[12px]">
              <span>
                共 {questions.length} 题，
                <span className="text-rose-500">*</span> 为必答
              </span>
              <span>{identityLabel}</span>
              {channelName ? <span>来自渠道：{channelName}</span> : null}
              {isDesktop && hasDraft ? <span>草稿已自动保存</span> : null}
            </div>
          </header>

          {restored ? (
            <div className="border-brand-200 bg-brand-50 text-brand-700 mb-3 rounded-xl border px-4 py-3 text-[12.5px] leading-5">
              检测到上次未提交的内容，已为你恢复（断点续填）。关闭页面不影响已填写的内容。
            </div>
          ) : null}

          {notice ? (
            <div
              role="alert"
              className="mb-3 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[12.5px] leading-5 text-amber-800"
            >
              <AlertCircleIcon className="mt-0.5 size-4 shrink-0" />
              {notice}
            </div>
          ) : null}

          {sections.map((section) => (
            <section key={section.title} className="mb-3">
              <div className="flex items-center gap-2.5 px-1 py-3">
                <span className="text-brand-600 shrink-0 text-[13px] font-semibold">
                  {section.title}
                </span>
                <span className="bg-ink-100 h-px flex-1" />
              </div>

              <div className="space-y-3">
                {section.questions.map((question) => (
                  <QuestionBlock
                    key={question.id}
                    question={question}
                    value={answers[question.id]}
                    error={errors[question.id]}
                    index={questions.indexOf(question) + 1}
                    onChange={(value) => setAnswer(question.id, value)}
                  />
                ))}
              </div>
            </section>
          ))}

          <div className="mt-6 flex flex-col items-center gap-3">
            <Button
              size="lg"
              className="h-12 w-full px-8 sm:w-auto"
              disabled={pending}
              onClick={submit}
            >
              {pending ? '提交中…' : '提交答卷'}
            </Button>
            <p className="text-ink-400 text-center text-[11.5px] leading-5">
              提交后不可修改。必答题未答时，会自动滚动到第一道未答题并高亮提示。
            </p>
          </div>
        </div>

        {isDesktop ? (
          <aside className="sticky top-8 w-[240px] shrink-0 space-y-4">
            <div className="border-ink-200 rounded-xl border bg-white p-4">
              <div className="text-ink-400 mb-3 px-1 text-[11px] font-semibold tracking-wide">
                题目导航
              </div>
              <ol className="space-y-0.5">
                {questions.map((question, index) => {
                  const answered = isAnswered(answers[question.id]);
                  const active = activeId === question.id;

                  return (
                    <li key={question.id}>
                      <button
                        type="button"
                        onClick={() => scrollToQuestion(question.id)}
                        className={cn(
                          'flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition-colors duration-150',
                          active ? 'bg-brand-50' : 'hover:bg-ink-50',
                        )}
                      >
                        <span
                          className={cn(
                            'flex size-5 shrink-0 items-center justify-center rounded-md font-mono text-[11px]',
                            answered
                              ? 'bg-brand-500 text-white'
                              : active
                                ? 'bg-brand-100 text-brand-700'
                                : 'bg-ink-100 text-ink-500',
                          )}
                        >
                          {answered ? <CheckIcon className="size-3" /> : index + 1}
                        </span>
                        <span
                          className={cn(
                            'truncate text-[12px]',
                            answered
                              ? 'text-brand-600 font-medium'
                              : active
                                ? 'text-ink-700'
                                : 'text-ink-500',
                          )}
                        >
                          {question.title}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ol>
              <p className="text-ink-400 mt-3 px-1 text-[11px] leading-4">
                答完的题号会变成对勾。点击题号直接跳到该题——长问卷里比一路滚到底快得多。
              </p>
            </div>

            <div className="border-ink-200 rounded-xl border bg-white p-4">
              <div className="text-ink-400 mb-2.5 px-1 text-[11px] font-semibold tracking-wide">
                完成度
              </div>
              <div className="flex items-center gap-4">
                <ProgressRing value={answeredCount} total={questions.length} />
                <div>
                  <div className="text-ink-900 font-mono text-[20px] leading-6 font-semibold">
                    {questions.length ? Math.round((answeredCount / questions.length) * 100) : 0}%
                  </div>
                  <div className="text-ink-400 mt-0.5 text-[11px]">
                    已答 {answeredCount} / {questions.length}
                  </div>
                </div>
              </div>
              <p className="text-ink-400 mt-2.5 px-1 text-[11px] leading-4">
                提交时若必答题为空，会先跳到第一道未答题。
              </p>
            </div>

            <p className="text-ink-400 px-1 text-[11.5px] leading-4">
              本页为公开链接；同一浏览器重复打开会恢复草稿。
            </p>
          </aside>
        ) : null}
      </div>

      {/* 窄屏：提交固定在底部，翻到哪都能点 */}
      {!isDesktop ? (
        <div className="border-ink-200 fixed inset-x-0 bottom-0 border-t bg-white/95 p-3 backdrop-blur">
          <Button size="lg" className="h-12 w-full" disabled={pending} onClick={submit}>
            {pending ? '提交中…' : `提交答卷（已答 ${answeredCount}/${questions.length}）`}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function ProgressRing({ value, total }: { value: number; total: number }) {
  const radius = 20;
  const circumference = 2 * Math.PI * radius;
  const ratio = total ? value / total : 0;

  return (
    <svg
      width="52"
      height="52"
      viewBox="0 0 52 52"
      role="img"
      aria-label={`完成度 ${Math.round(ratio * 100)}%`}
    >
      <circle cx="26" cy="26" r={radius} fill="none" strokeWidth="5" className="stroke-ink-100" />
      <circle
        cx="26"
        cy="26"
        r={radius}
        fill="none"
        strokeWidth="5"
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={circumference * (1 - ratio)}
        transform="rotate(-90 26 26)"
        className="stroke-brand-500 transition-all duration-300"
      />
    </svg>
  );
}

/** 按分页（`pageIndex`）切「第一部分 / 第二部分」，与设计稿的分节标题对应 */
function groupBySection(questions: PublicQuestion[]) {
  const map = new Map<number, PublicQuestion[]>();

  for (const question of questions) {
    const list = map.get(question.pageIndex) ?? [];
    list.push(question);
    map.set(question.pageIndex, list);
  }

  return [...map.entries()]
    .sort(([a], [b]) => a - b)
    .map(([pageIndex, list], index) => ({
      title: `第${['一', '二', '三', '四', '五', '六', '七', '八', '九', '十'][index] ?? index + 1}部分${index === 0 ? ' · 基本信息' : ''}`,
      pageIndex,
      questions: list,
    }));
}

function QuestionBlock({
  question,
  value,
  error,
  index,
  onChange,
}: {
  question: PublicQuestion;
  value: AnswerValue | undefined;
  error: string | undefined;
  index: number;
  onChange: (value: AnswerValue) => void;
}) {
  return (
    <div
      id={`q-${question.id}`}
      className={cn(
        'scroll-mt-24 rounded-2xl border bg-white p-5',
        error ? 'border-rose-300' : 'border-ink-200',
      )}
    >
      <h2 className="text-ink-900 text-[15.5px] leading-6 font-semibold">
        <span className="text-ink-400 mr-1.5 font-mono text-[13px]">{index}.</span>
        {question.title}
        {question.required ? <span className="ml-1 text-rose-500">*</span> : null}
      </h2>
      <p className="text-ink-400 mt-1 text-[12px]">{describeAnswerHint(question)}</p>
      {question.description ? (
        <p className="text-ink-500 mt-1.5 text-[12.5px] leading-5">{question.description}</p>
      ) : null}

      <div className="mt-3.5">
        <AnswerControl question={question} value={value} onChange={onChange} />
      </div>

      {error ? (
        <p role="alert" className="mt-2 text-[12px] text-rose-600">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function AnswerControl({
  question,
  value,
  onChange,
}: {
  question: PublicQuestion;
  value: AnswerValue | undefined;
  onChange: (value: AnswerValue) => void;
}) {
  switch (question.type) {
    case 'SINGLE':
    case 'MULTI': {
      const multi = question.type === 'MULTI';
      const picked = multi ? (Array.isArray(value) ? value : []) : [];
      const selected = multi ? picked : typeof value === 'string' ? [value] : [];

      return (
        <div className="space-y-2">
          {question.options.map((option) => {
            const isOn = selected.includes(option);

            return (
              <button
                key={option}
                type="button"
                aria-pressed={isOn}
                onClick={() =>
                  multi
                    ? onChange(
                        isOn ? picked.filter((item) => item !== option) : [...picked, option],
                      )
                    : onChange(option)
                }
                className={cn(
                  'flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left transition-colors duration-150',
                  isOn
                    ? 'border-brand-500 bg-brand-50/60 border-2'
                    : 'border-ink-200 hover:border-brand-300',
                )}
              >
                <span
                  className={cn(
                    'flex size-4 shrink-0 items-center justify-center border-[1.5px] transition-colors duration-150',
                    multi ? 'rounded-[5px]' : 'rounded-full',
                    isOn ? 'border-brand-500 bg-brand-500' : 'border-ink-300',
                  )}
                >
                  {isOn ? <CheckIcon className="size-2.5 text-white" /> : null}
                </span>
                <span
                  className={cn(
                    'text-[14px]',
                    isOn ? 'text-brand-700 font-medium' : 'text-ink-700',
                  )}
                >
                  {option}
                </span>
              </button>
            );
          })}
        </div>
      );
    }

    case 'DROPDOWN':
      return (
        <select
          value={typeof value === 'string' ? value : ''}
          aria-label={question.title}
          onChange={(event) => onChange(event.target.value)}
          className="border-ink-200 text-ink-800 focus:border-brand-500 h-11 w-full rounded-xl border bg-white px-3.5 text-[13.5px] outline-none"
        >
          <option value="">请选择</option>
          {question.options.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      );

    case 'RATING': {
      const min = question.min ?? RATING_SCALE.MIN;
      const max = Math.min(question.max ?? 5, RATING_SCALE.MAX);
      const scores = Array.from({ length: Math.max(0, max - min + 1) }, (_, i) => min + i);

      return (
        <div>
          <div
            className="grid gap-2"
            style={{
              width: `calc(${RATING_SCALE.PER_ROW} * 2.75rem + ${RATING_SCALE.PER_ROW - 1} * 0.5rem)`,
              gridTemplateColumns: `repeat(${RATING_SCALE.PER_ROW}, 2.75rem)`,
            }}
          >
            {scores.map((score) => {
              const isOn = value === score;

              return (
                <button
                  key={score}
                  type="button"
                  aria-pressed={isOn}
                  onClick={() => onChange(score)}
                  className={cn(
                    'flex h-11 items-center justify-center rounded-xl border font-mono text-[15px] transition-colors duration-150',
                    isOn
                      ? 'border-brand-500 bg-brand-500 border-2 text-white'
                      : 'border-ink-200 text-ink-600 hover:border-brand-300',
                  )}
                >
                  {score}
                </button>
              );
            })}
          </div>
          <span className="text-ink-400 mt-2 ml-1.5 block text-[11.5px]">
            {min} = 很不满意，{max} = 非常满意
          </span>
        </div>
      );
    }

    case 'SHORT_TEXT':
      return (
        <input
          value={typeof value === 'string' ? value : ''}
          aria-label={question.title}
          maxLength={question.maxLength ?? undefined}
          placeholder="请输入"
          onChange={(event) => onChange(event.target.value)}
          className="border-ink-200 text-ink-800 focus:border-brand-500 h-11 w-full rounded-xl border px-3.5 text-[13.5px] outline-none"
        />
      );

    case 'LONG_TEXT': {
      const text = typeof value === 'string' ? value : '';

      return (
        <div>
          <textarea
            value={text}
            aria-label={question.title}
            maxLength={question.maxLength ?? undefined}
            placeholder="写点什么…"
            rows={4}
            onChange={(event) => onChange(event.target.value)}
            className="border-ink-200 text-ink-800 focus:border-brand-500 w-full resize-y rounded-xl border p-3.5 text-[13.5px] leading-6 outline-none"
          />
          {question.maxLength ? (
            <p className="text-ink-400 mt-1.5 text-right text-[11px]">
              {text.length} / {question.maxLength}
            </p>
          ) : null}
        </div>
      );
    }

    case 'DATE':
      return (
        <input
          type="date"
          value={typeof value === 'string' ? value : ''}
          aria-label={question.title}
          onChange={(event) => onChange(event.target.value)}
          className="border-ink-200 text-ink-800 focus:border-brand-500 h-11 rounded-xl border px-3.5 text-[13.5px] outline-none"
        />
      );

    default:
      return null;
  }
}
