'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';

/**
 * 路由切换的顶部进度条（设计稿 `补充.html` L02）。
 *
 * 三条来自设计稿的要求，都体现在下面：
 * - **只占 2px、贴在视口最顶**（`fixed`，不随滚动）：不遮内容、不占布局，是页间跳转最轻的方案。
 * - **不跑到 100% 就等**：爬到 ~90% 停住，拿到新页面再补完并淡出。
 *   「一个跑到 100% 还在等的进度条，是在骗用户。」
 * - **100ms 内不加指示**（L00 的时长分级）：闪现一下就消失的进度条只会造成视觉抖动，
 *   所以它先等 `APPEAR_DELAY_MS` —— 快跳转根本不会看见它。
 *
 * 实现方式是「捕获站内链接的点击」而不是给每个 `<Link>` 包一层：这个项目的跳转入口
 * 分散在侧栏、底部导航、卡片动作、问卷内 Tab 等十几处，逐个包必然漏。
 * 结束时靠 `usePathname()` 变化 —— 那是「新页面真的到了」的唯一可靠信号。
 */
const APPEAR_DELAY_MS = 120;
/** 爬升档位：停在 90，不跑满 */
const CLIMB = [8, 22, 38, 52, 64, 74, 82, 88, 90] as const;
const CLIMB_INTERVAL_MS = 220;

export function NavigationProgress() {
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);
  const [value, setValue] = useState(0);

  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const running = useRef(false);

  const clearTimers = useCallback(() => {
    timers.current.forEach((id) => clearTimeout(id));
    timers.current = [];
  }, []);

  const start = useCallback(() => {
    if (running.current) return;

    running.current = true;
    clearTimers();

    timers.current.push(
      setTimeout(() => {
        setVisible(true);
        setValue(CLIMB[0]);

        CLIMB.slice(1).forEach((step, index) => {
          timers.current.push(setTimeout(() => setValue(step), CLIMB_INTERVAL_MS * (index + 1)));
        });
      }, APPEAR_DELAY_MS),
    );
  }, [clearTimers]);

  // ---- 捕获站内链接的点击 ----
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      // 新标签页、下载、修饰键、右键：都不是「本次页内跳转」
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

      const anchor = (event.target as Element | null)?.closest?.('a');
      if (!anchor) return;

      const href = anchor.getAttribute('href');
      if (!href || !href.startsWith('/')) return;
      if (anchor.hasAttribute('download') || anchor.getAttribute('target') === '_blank') return;
      // 同路径只换查询串 = 筛选，不是跳转（那种「局部刷新」由 L09 处理，不该出现顶部条）
      if (href.split('?')[0] === window.location.pathname) return;

      start();
    };

    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, [start]);

  // ---- 路径变了 = 新页面到了：补完、淡出 ----
  useEffect(() => {
    if (!running.current) return;

    running.current = false;
    clearTimers();
    setValue(100);

    timers.current.push(
      setTimeout(() => {
        setVisible(false);
        setValue(0);
      }, 200),
    );
  }, [pathname, clearTimers]);

  useEffect(() => clearTimers, [clearTimers]);

  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none fixed inset-x-0 top-0 z-[60] h-0.5 transition-opacity duration-150 ${
        visible ? 'opacity-100' : 'opacity-0'
      }`}
    >
      <div className="qw-progress-bar bg-brand-500 h-full" style={{ width: `${value}%` }} />
    </div>
  );
}
