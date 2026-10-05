'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import { SearchIcon } from '@/components/icons/ui-icons';

/**
 * 顶栏搜索框。
 *
 * 输入后**防抖 300ms 再改 URL**：每敲一个字就导航一次会把服务端渲染打满，
 * 而且历史记录会被塞进一串中间态，后退键变得不可用。
 *
 * 与 URL 的反向同步（用户按后退键时输入框跟着回退）用 React 官方的
 * 「渲染期根据 prop 调整 state」写法，而不是放在 effect 里 ——
 * 后者会触发「effect 里同步 setState」的规则，且要多渲染一轮。
 */
export function SearchField({
  basePath,
  initialKeyword,
  preserveQuery,
}: {
  basePath: string;
  initialKeyword: string;
  /** 当前 URL 里要保留的其它参数（状态筛选、排序） */
  preserveQuery: Record<string, string>;
}) {
  const router = useRouter();
  const [keyword, setKeyword] = useState(initialKeyword);
  const [syncedKeyword, setSyncedKeyword] = useState(initialKeyword);

  if (initialKeyword !== syncedKeyword) {
    setSyncedKeyword(initialKeyword);
    setKeyword(initialKeyword);
  }

  // preserveQuery 是每次渲染新建的对象，直接进依赖数组会让定时器反复重建，
  // 所以序列化成字符串再当依赖
  const queryKey = new URLSearchParams(preserveQuery).toString();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (keyword === initialKeyword) return;

    timer.current = setTimeout(() => {
      const query = new URLSearchParams(queryKey);
      if (keyword.trim()) query.set('q', keyword.trim());
      else query.delete('q');

      const queryString = query.toString();
      router.replace(queryString ? `${basePath}?${queryString}` : basePath);
    }, 300);

    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [keyword, initialKeyword, queryKey, basePath, router]);

  return (
    <div className="relative w-40 sm:w-60">
      <SearchIcon className="text-ink-400 pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
      <input
        value={keyword}
        onChange={(event) => setKeyword(event.target.value)}
        placeholder="搜索问卷名称…"
        aria-label="搜索问卷名称"
        className="bg-ink-100 text-body-s text-ink-800 placeholder:text-ink-400 focus:border-brand-500 focus:ring-brand-500/20 h-9 w-full rounded-[10px] border border-transparent pr-3 pl-9 transition-all duration-150 outline-none focus:bg-white focus:ring-[3px]"
      />
    </div>
  );
}
