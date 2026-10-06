import Link from 'next/link';

import { ArrowLeftIcon } from '@/components/icons/ui-icons';

/**
 * 问卷内页面的顶栏外壳（W03 / W04 / W05 的顶栏结构一致）。
 *
 * 为什么放 `components/layout` 而不是某个 feature：编辑器与发布是两个 feature，
 * 而它俩的顶栏只差右侧那几个按钮 —— 复制两份必然出现「一边改了另一边没改」。
 *
 * `titleSlot` 是插槽而不是字符串：编辑器里标题是**绑定草稿的输入框**，
 * 发布页里是纯文本，两者没法用同一个 prop 表达。
 */
export function QuestionnaireTopbar({
  titleSlot,
  children,
}: {
  titleSlot: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <header className="border-ink-200 flex h-16 shrink-0 items-center gap-3 border-b bg-white px-6">
      <Link
        href="/app"
        aria-label="返回问卷列表"
        className="text-ink-500 hover:bg-ink-100 flex size-8 shrink-0 items-center justify-center rounded-lg transition-colors duration-150"
      >
        <ArrowLeftIcon className="size-4" />
      </Link>

      <div className="bg-ink-200 h-5 w-px shrink-0" />

      {titleSlot}

      {children ? <div className="ml-auto flex shrink-0 items-center gap-3">{children}</div> : null}
    </header>
  );
}
