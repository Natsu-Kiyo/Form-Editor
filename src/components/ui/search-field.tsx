'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, useTransition } from 'react';

import { SearchIcon } from '@/components/icons/ui-icons';
import { Spinner } from '@/components/ui/spinner';

/**
 * 带防抖的搜索框。
 *
 * 输入后**防抖 300ms 再改 URL**：每敲一个字就导航一次会把服务端渲染打满，
 * 而且历史记录会被塞进一串中间态，后退键变得不可用。
 *
 * 与 URL 的反向同步（用户按后退键时输入框跟着回退）用 React 官方的
 * 「渲染期根据 prop 调整 state」写法，而不是放在 effect 里 ——
 * 后者会触发「effect 里同步 setState」的规则，且要多渲染一轮。
 *
 * **搜索中有等待态**（改 URL 到新结果落地那一段）：放大镜**原位**换成 spinner、
 * `input` 挂 `aria-busy`，另用一句 sr-only 的「正在搜索…」承担状态文字 ——
 * 与 `Button` 的加载态同一条规矩（L00 / L06：spinner 顶掉原图标，图标不被挤走、
 * 文字起点不动；状态不能只靠动画传达）。
 *
 * 它被问卷列表（搜问卷名称）、答卷明细（搜答卷内容）与模板中心（搜模板）共用，
 * 所以放在 `components/ui` 而不是某个 feature 里：三处只在文案上不同。
 */
export function SearchField({
  basePath,
  initialKeyword,
  preserveQuery,
  placeholder,
  label,
}: {
  basePath: string;
  initialKeyword: string;
  /** 当前 URL 里要保留的其它参数（状态筛选、渠道…） */
  preserveQuery: Record<string, string>;
  placeholder: string;
  /** 无障碍名称，通常与 placeholder 一致 */
  label: string;
}) {
  const router = useRouter();
  // 导航放进 transition，`isPending` 才能覆盖「发起 replace → 新结果落地」这整段
  const [isPending, startTransition] = useTransition();
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
      startTransition(() => {
        router.replace(queryString ? `${basePath}?${queryString}` : basePath);
      });
    }, 300);

    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [keyword, initialKeyword, queryKey, basePath, router]);

  return (
    <div className="relative w-40 sm:w-60">
      {/*
        图标位只有一处：搜索中换成 spinner（`Button` 的规矩 —— 加载态顶掉原图标，
        不把它挤走，也不让文字起点移动）。外面这层 span 负责垂直居中：
        spinner 自己转着，`transform` 被动画占着，`-translate-y-1/2` 放它身上会被盖掉。
      */}
      <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2">
        {isPending ? <Spinner /> : <SearchIcon className="text-ink-400 size-4" />}
      </span>

      {/* spinner 是装饰（aria-hidden），状态由这句话承担 */}
      {isPending ? (
        <span role="status" className="sr-only">
          正在搜索…
        </span>
      ) : null}

      <input
        value={keyword}
        onChange={(event) => setKeyword(event.target.value)}
        placeholder={placeholder}
        aria-label={label}
        aria-busy={isPending || undefined}
        className="bg-ink-100 text-body-s text-ink-800 placeholder:text-ink-400 focus:border-brand-500 focus:ring-brand-500/20 h-9 w-full rounded-[10px] border border-transparent pr-3 pl-9 transition-all duration-150 outline-none focus:bg-white focus:ring-[3px]"
      />
    </div>
  );
}
