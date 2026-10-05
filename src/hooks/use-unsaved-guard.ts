'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';

/** 跳出编辑器时退到哪儿。编辑器在信息架构里的上一级就是问卷列表 */
const FALLBACK_PATH = '/app';

/** 浏览器「返回」不是一次点击、没有可跳转的 href，用哨兵值把它和普通链接区分开 */
const BACK_SENTINEL = '__back__';

/**
 * 有未保存修改时拦住离开。
 *
 * **三种退出方式走的是三套完全不同的机制**，必须分别处理，少一种就漏一条路：
 *
 * 1. **硬导航**（关标签页 / 刷新 / 地址栏直接输别的网址）→ `beforeunload`。
 *    注意：这时浏览器只允许弹**它自己的**通用提示（「离开此网站？」），
 *    不允许我们自定义文案 —— 这是规范限制，不是没做。
 * 2. **站内链接**（侧栏、返回按钮、以后的任何入口）→ 在**捕获阶段**拦下 `<a>` 的点击。
 *    拦的是「点了锚点」这件事本身，所以侧栏以后多几个入口也一并覆盖。
 * 3. **浏览器返回**（Alt+← / 后退键）→ 它不是点击，`beforeunload` 也不会触发（SPA 不卸载文档），
 *    只能靠 history 兜：往栈里塞一条**同 URL 的哨兵记录**，用户按返回时先落到哨兵上 ——
 *    路径没变，路由不会真的换页，我们才有机会问一句。
 *
 * 哨兵会**残留**（保存后、刷新页面、离开又回来都会留下几条），所以这里**不靠「记住自己压了几条」
 * 去回收**（那条路要处理「刷新后旧哨兵还在」这种跨挂载的情况，很容易算错）。
 * 改成常驻监听：**没改动时遇到同 URL 的空返回，就替用户再退一步**，一路跳过残留哨兵
 * 直到真正跨页。残留多少条都不会让用户觉得「返回键失灵」。
 */
export function useUnsavedGuard(dirty: boolean) {
  const router = useRouter();
  const [pendingTarget, setPendingTarget] = useState<string | null>(null);

  const bypassRef = useRef(false);
  const dirtyRef = useRef(dirty);
  /**
   * 由**我们自己**发起的 history 跳转有几跳还在路上。
   *
   * 用它而不是「设一个标志再 setTimeout 清掉」：`history.go(-1)` 派发的 popstate
   * 与本轮的 setTimeout 谁先执行是不确定的，用定时器会出现「跳过一跳后链子断掉」——
   * 表现正是「返回键按了没反应」。用计数就不依赖任何时序假设。
   */
  const selfNavRef = useRef(0);
  /** 编辑器自己的路径。同 URL 的 popstate 就说明「踩在哨兵上」，而不是真的跨页了 */
  const editorPathRef = useRef<string | null>(null);

  useEffect(() => {
    dirtyRef.current = dirty;
  }, [dirty]);

  useEffect(() => {
    editorPathRef.current = window.location.pathname;
  }, []);

  // ---- 1. 硬导航 ----
  useEffect(() => {
    if (!dirty) return;

    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      // 老浏览器只认 returnValue；新浏览器认 preventDefault。两个都写才稳
      event.returnValue = '';
    };

    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [dirty]);

  // ---- 2. 站内链接 ----
  useEffect(() => {
    if (!dirty) return;

    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || bypassRef.current) return;

      const anchor = (event.target as HTMLElement | null)?.closest('a[href]');
      if (!anchor) return;

      const href = anchor.getAttribute('href');
      const target = anchor.getAttribute('target');

      // 外链、页内锚点、新窗口打开都不该被拦
      if (!href || href.startsWith('http') || href.startsWith('#') || target === '_blank') return;

      event.preventDefault();
      event.stopPropagation();
      setPendingTarget(href);
    };

    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, [dirty]);

  // ---- 3. 浏览器返回 ----
  // 常驻监听（不依赖 dirty）：没改动时也要负责把残留的哨兵跳过去
  useEffect(() => {
    const onPopState = () => {
      if (bypassRef.current) return;

      // 这一跳是不是我自己发起的？（跳过哨兵时会连发好几跳）
      const selfInitiated = selfNavRef.current > 0;
      if (selfInitiated) selfNavRef.current -= 1;

      const onSentinel = window.location.pathname === editorPathRef.current;

      if (!dirtyRef.current) {
        // 没改动：踩在残留哨兵上就替用户再退一步，一路跳到真正跨页为止
        if (onSentinel) {
          selfNavRef.current += 1;
          window.history.go(-1);
        }
        return;
      }

      // 有改动：只拦**用户自己按的那一次**（绕过自己发起的跳，否则会连环弹）
      if (onSentinel && !selfInitiated) setPendingTarget(BACK_SENTINEL);
    };

    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  // 一有改动就先压一条哨兵，这样按返回时才有个「同 URL」的落点可以拦
  useEffect(() => {
    if (!dirty) return;

    window.history.pushState(null, '', window.location.href);
  }, [dirty]);

  const cancelLeave = useCallback(() => {
    // 补一条哨兵：否则下一次返回会直接跨页，再也没机会拦。
    // 每次「留在本页」多留一条是划算的 —— 没改动时它们会被自动跳过
    window.history.pushState(null, '', window.location.href);
    setPendingTarget(null);
  }, []);

  const leave = useCallback(() => {
    const target = pendingTarget;
    setPendingTarget(null);
    bypassRef.current = true;

    // 返回键的语义是「离开编辑器」，落到列表即可。
    // 刻意**不在 history 里逐条后退**：栈里有多少残留哨兵不受我们掌控，
    // 逐条退会退到一个说不清的地方；而 push 的目标是确定的
    if (!target || target === BACK_SENTINEL) {
      router.push(FALLBACK_PATH);
      return;
    }

    router.push(target);
  }, [pendingTarget, router]);

  return {
    isLeaving: pendingTarget !== null,
    /** 是为「浏览器返回」弹的，还是为某条链接弹的（文案与去向都不同） */
    isBackNavigation: pendingTarget === BACK_SENTINEL,
    cancelLeave,
    leave,
  };
}
