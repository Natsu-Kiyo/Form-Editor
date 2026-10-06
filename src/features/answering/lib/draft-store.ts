'use client';

import type { AnswerValue } from './answers';

/**
 * 作答草稿（断点续填）。
 *
 * 为什么是**模块级 store + `useSyncExternalStore`**，而不是组件里的 `useState` + `useEffect`：
 *
 * - `localStorage` 是浏览器专有的，服务端渲染时读不到。用 effect 去读再 `setState`，
 *   会先渲染一帧空表单再刷一遍（ESLint 的 react 规则直接把这种写法报成错误）。
 * - `useSyncExternalStore` 天生就是为这件事准备的：服务端给一个**空快照**、
 *   客户端挂载后自动切到真实值，两边不会不一致，也不用写任何 effect。
 *   （与 `hooks/use-is-desktop.ts` 是同一套机制。）
 *
 * 每次改动**立刻**写进 localStorage，不做防抖：一份问卷的答案是几百字节，
 * 而防抖会引入定时器与竞态，换来的只是省下一次微不足道的序列化。
 */

export type Answers = Record<string, AnswerValue>;

let cache: { slug: string; answers: Answers } | null = null;
const listeners = new Set<() => void>();
const restoredSlugs = new Set<string>();
const EMPTY: Answers = {};

function storageKey(slug: string) {
  return `qw_draft_${slug}`;
}

function read(slug: string): Answers {
  if (typeof window === 'undefined') return EMPTY;

  // 缓存是必须的：`getSnapshot` 每次返回新对象会让 React 认为外部数据一直在变，
  // 从而陷入无限重渲染
  if (cache?.slug === slug) return cache.answers;

  let answers: Answers = EMPTY;

  try {
    const raw = window.localStorage.getItem(storageKey(slug));
    if (raw) {
      const parsed = JSON.parse(raw) as Answers;
      if (parsed && typeof parsed === 'object' && Object.keys(parsed).length > 0) {
        answers = parsed;
        restoredSlugs.add(slug);
      }
    }
  } catch {
    // 存坏了就当没有：一份读不出来的草稿不值得拦住用户
    window.localStorage.removeItem(storageKey(slug));
  }

  cache = { slug, answers };

  return answers;
}

export function subscribeDraft(listener: () => void) {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}

export function getDraftSnapshot(slug: string) {
  return read(slug);
}

export function getDraftServerSnapshot() {
  return EMPTY;
}

/** 这份草稿是从 localStorage 里恢复出来的吗（只在挂载后第一次读时为真） */
export function wasDraftRestored(slug: string) {
  return restoredSlugs.has(slug);
}

function emit() {
  listeners.forEach((listener) => listener());
}

export function setAnswerValue(slug: string, questionId: string, value: AnswerValue) {
  const next = { ...read(slug), [questionId]: value };
  cache = { slug, answers: next };

  try {
    window.localStorage.setItem(storageKey(slug), JSON.stringify(next));
  } catch {
    // 无痕模式等场景下写不进去：作答本身不该因此失败
  }

  emit();
}

export function clearDraft(slug: string) {
  cache = { slug, answers: EMPTY };

  try {
    window.localStorage.removeItem(storageKey(slug));
  } catch {
    // 同上
  }

  restoredSlugs.delete(slug);
  emit();
}
