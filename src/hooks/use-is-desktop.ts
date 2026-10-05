'use client';

import { useCallback, useSyncExternalStore } from 'react';

/**
 * 视口是否达到桌面宽度。
 *
 * 为什么需要它：设计稿把「复制 / 导入导出 JSON」标为**移动端不做**，
 * 而平台的规则是「窄屏下完全不渲染入口」——用 CSS `hidden` 只是看不见，
 * 元素仍在 DOM 里、仍可被 Tab 聚焦，不算真的不做。
 *
 * 用 `useSyncExternalStore` 而不是「useState + useEffect 里 setState」：
 * 后者在 React 的新规则下会报「在 effect 里同步 setState 会引发级联渲染」，
 * 而 media query 本来就是一份**外部状态**，本来就该用这个 hook 去订阅。
 * 服务端快照固定返回 `true`（服务端无从得知视口），客户端首帧就取真实值，
 * 因此不会出现「先渲染桌面项再纠正」的闪烁。
 */
export function useIsDesktop(query = '(min-width: 768px)') {
  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      const mql = window.matchMedia(query);
      mql.addEventListener('change', onStoreChange);
      return () => mql.removeEventListener('change', onStoreChange);
    },
    [query],
  );

  const getSnapshot = useCallback(() => window.matchMedia(query).matches, [query]);

  return useSyncExternalStore(subscribe, getSnapshot, () => true);
}
