'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState, useTransition } from 'react';

import { DownloadIcon, FileTextIcon } from '@/components/icons/ui-icons';
import { QuestionnaireTopbar } from '@/components/layout/questionnaire-topbar';
import { ExportResponsesDialog } from '@/components/questionnaire/export-responses-dialog';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { FilterSelect } from '@/components/ui/filter-select';
import { SearchField } from '@/components/ui/search-field';
import { cn } from '@/utils/cn';

import { setResponseValidityAction } from '../actions/invalidate-response';
import type { ResponseDetail, ResponsesPageData } from '../api/responses';
import { ResponseDetailPanel } from './response-detail-panel';

/**
 * 答卷明细（W07）。
 *
 * 三条与别处一致的约定：
 * - **筛选全部走 URL**（搜索 / 渠道 / 是否含无效 / 页码 / 当前选中的答卷），
 *   所以「我正在看第 3 页的哪一份」也能直接分享给别人。
 * - **表格是服务端渲染的**，客户端只负责改 URL 与调 action —— 数字与时间文案都在
 *   服务端按展示时区格式化好了（放客户端会在水合时对不上）。
 * - 详情是**右栏**而不是弹层：看明细时人一直在上下比对本份答卷与列表。
 */
export function ResponsesPanel({
  data,
  detail,
  questionnaireId,
  channelId,
  search,
  includeInvalid,
  canEdit,
  canExport,
}: {
  data: ResponsesPageData;
  detail: ResponseDetail | null;
  questionnaireId: string;
  channelId: string | null;
  search: string | null;
  includeInvalid: boolean;
  /** 能标无效 / 恢复 */
  canEdit: boolean;
  /** 能导出 CSV（与统计页一致：看明细是查看者也有的能力，把全部原始回答打包带走不是） */
  canExport: boolean;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [exportOpen, setExportOpen] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const basePath = `/app/q/${questionnaireId}/responses`;
  const filterActive = Boolean(channelId || search || !includeInvalid);

  /** 改筛选时**把页码收回第 1 页**：否则在第 5 页上换渠道会得到一个空表 */
  const push = (patch: Record<string, string | null>, resetPage = true) => {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(patch)) {
      if (value === null) params.delete(key);
      else params.set(key, value);
    }
    if (resetPage) params.delete('page');

    const queryString = params.toString();
    router.push(queryString ? `${basePath}?${queryString}` : basePath);
  };

  const pageHref = (page: number) => {
    const params = new URLSearchParams(searchParams.toString());
    if (page > 1) params.set('page', String(page));
    else params.delete('page');

    const queryString = params.toString();
    return queryString ? `${basePath}?${queryString}` : basePath;
  };

  const closeHref = (() => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete('selected');
    const queryString = params.toString();
    return queryString ? `${basePath}?${queryString}` : basePath;
  })();

  /** 打开某一份的详情：只是往当前 URL 上加 `selected`，连页码都保持不动 */
  const selectHref = (responseId: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('selected', responseId);

    return `${basePath}?${params.toString()}`;
  };

  const restore = (responseId: string) => {
    setPendingId(responseId);
    startTransition(async () => {
      await setResponseValidityAction({ responseId, invalid: false });
      setPendingId(null);
    });
  };

  return (
    <>
      <QuestionnaireTopbar
        titleSlot={
          <h1 className="text-ink-900 truncate text-[15px] font-semibold">{data.title}</h1>
        }
      >
        {canExport ? (
          <Button variant="outline" size="sm" onClick={() => setExportOpen(true)}>
            <DownloadIcon className="size-3.5" />
            导出
          </Button>
        ) : null}
      </QuestionnaireTopbar>

      <main className="flex-1 overflow-y-auto p-6 sm:p-7">
        <div className="mx-auto max-w-[1180px]">
          {/* ---- 筛选行 ---- */}
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <SearchField
              basePath={basePath}
              initialKeyword={search ?? ''}
              preserveQuery={{ channel: channelId ?? '', invalid: includeInvalid ? '1' : '' }}
              placeholder="搜索答卷内容…"
              label="搜索答卷内容"
            />

            <FilterSelect
              label="渠道"
              placeholder="全部渠道"
              value={channelId ?? ''}
              onChange={(value) => push({ channel: value || null })}
              options={data.channels.map((channel) => ({
                value: channel.id,
                label: `${channel.name}（${channel.count}）`,
              }))}
            />

            {/* 默认**勾上**：刚标完无效的那份还留在表里，人才不会以为它被删了 */}
            <label className="border-ink-200 flex h-9 cursor-pointer items-center gap-2 rounded-[10px] border bg-white px-3.5">
              <input
                type="checkbox"
                checked={includeInvalid}
                onChange={(event) => push({ invalid: event.target.checked ? null : 'hide' })}
                className="accent-brand-500 size-4"
              />
              <span className="text-ink-600 text-[12.5px]">显示无效答卷</span>
            </label>

            <div className="flex-1" />

            <span className="text-ink-400 text-[12px]">
              共 <b className="text-ink-700 font-mono">{data.total}</b> 份 · 有效{' '}
              <b className="text-ink-700 font-mono">{data.validCount}</b> 份
              {filterActive ? (
                <>
                  {' '}
                  · 当前筛选 <b className="text-ink-700 font-mono">{data.filteredCount}</b> 条
                </>
              ) : null}
            </span>
          </div>

          <div className="flex items-start gap-5">
            {/* ---- 表格 ---- */}
            <div className="border-ink-200 min-w-0 flex-1 overflow-hidden rounded-xl border bg-white">
              {data.rows.length === 0 ? (
                <EmptyState
                  icon={<FileTextIcon className="size-6" />}
                  title={filterActive ? '没有匹配的答卷' : '还没有收到答卷'}
                  description={
                    filterActive
                      ? '换个关键词或渠道试试，或者把筛选清掉。'
                      : '问卷发布后有人提交，这里就会出现逐份的明细。'
                  }
                  action={
                    filterActive ? (
                      <Button variant="outline" size="sm" asChild>
                        <Link href={basePath}>清空筛选</Link>
                      </Button>
                    ) : undefined
                  }
                />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-[13px]">
                    <thead className="bg-ink-50 text-ink-600">
                      <tr>
                        <th className="w-16 px-5 py-3 text-left font-medium">#</th>
                        <th className="px-5 py-3 text-left font-medium">提交时间</th>
                        <th className="px-5 py-3 text-left font-medium">用时</th>
                        <th className="px-5 py-3 text-left font-medium">渠道</th>
                        <th className="px-5 py-3 text-left font-medium">状态</th>
                        <th className="w-24 px-5 py-3 text-right font-medium">操作</th>
                      </tr>
                    </thead>

                    <tbody className="divide-ink-100 divide-y">
                      {data.rows.map((row) => {
                        const selected = detail?.id === row.id;

                        return (
                          <tr
                            key={row.id}
                            // 整行可点（设计稿的样子），但键盘用户用的是操作列里那个真按钮，
                            // 所以无障碍不依赖 onClick
                            onClick={() => push({ selected: row.id }, false)}
                            className={cn(
                              'cursor-pointer transition-colors duration-150',
                              selected ? 'bg-brand-50/60' : 'hover:bg-ink-50/60',
                            )}
                          >
                            <td
                              className={cn(
                                'px-5 py-3.5 font-mono',
                                selected ? 'text-brand-600' : 'text-ink-400',
                              )}
                            >
                              {row.serial}
                            </td>
                            <td className="text-ink-800 px-5 py-3.5 font-mono text-[12.5px]">
                              {row.submittedAtLabel}
                            </td>
                            <td className="text-ink-600 px-5 py-3.5 font-mono text-[12.5px]">
                              {row.durationLabel ?? '—'}
                            </td>
                            <td className="px-5 py-3.5">
                              {row.channelName ? (
                                <span className="text-ink-600 inline-flex items-center gap-1.5 text-[12.5px]">
                                  <span
                                    className={cn(
                                      'size-1.5 rounded-full',
                                      row.valid ? 'bg-brand-500' : 'bg-ink-300',
                                    )}
                                  />
                                  {row.channelName}
                                </span>
                              ) : (
                                <span className="text-ink-400 text-[12.5px]">无渠道标记</span>
                              )}
                            </td>
                            <td className="px-5 py-3.5">
                              <span
                                className={cn(
                                  'inline-flex h-6 items-center rounded-full px-2 text-[11px] font-medium',
                                  row.valid
                                    ? 'bg-emerald-50 text-emerald-700'
                                    : 'bg-ink-100 text-ink-500',
                                )}
                              >
                                {row.valid ? '有效' : '已标记无效'}
                              </span>
                            </td>
                            <td className="px-5 py-3.5 text-right">
                              {row.valid ? (
                                <Link
                                  href={selectHref(row.id)}
                                  aria-label={`查看答卷 #${row.serial}`}
                                  className={cn(
                                    'text-[12.5px] font-medium transition-colors duration-150',
                                    selected ? 'text-brand-500' : 'text-ink-500 hover:text-ink-800',
                                  )}
                                >
                                  {selected ? '查看中' : '查看'}
                                </Link>
                              ) : canEdit ? (
                                <button
                                  type="button"
                                  aria-label={`恢复答卷 #${row.serial}`}
                                  disabled={pendingId === row.id}
                                  onClick={(event) => {
                                    // 别让「恢复」顺带把这份答卷的详情开出来
                                    event.stopPropagation();
                                    restore(row.id);
                                  }}
                                  className="text-brand-500 hover:text-brand-600 text-[12.5px] font-medium transition-colors duration-150 disabled:opacity-45"
                                >
                                  {pendingId === row.id ? '恢复中…' : '恢复'}
                                </button>
                              ) : (
                                <span className="text-ink-300 text-[12px]">—</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {data.rows.length > 0 ? (
                <div className="border-ink-100 flex flex-wrap items-center justify-between gap-3 border-t px-5 py-3.5">
                  <span className="text-ink-400 text-[12px]">
                    显示 {(data.page - 1) * data.pageSize + 1}–
                    {(data.page - 1) * data.pageSize + data.rows.length} 条，共 {data.filteredCount}{' '}
                    条
                  </span>

                  {data.pageCount > 1 ? (
                    <div className="flex items-center gap-1">
                      <PageLink
                        href={pageHref(data.page - 1)}
                        disabled={data.page <= 1}
                        aria-label="上一页"
                      >
                        上一页
                      </PageLink>

                      {pageWindow(data.page, data.pageCount).map((item, index) =>
                        item === '…' ? (
                          <span key={`gap-${index}`} className="text-ink-400 px-1 text-[12px]">
                            …
                          </span>
                        ) : (
                          <PageLink
                            key={item}
                            href={pageHref(item)}
                            current={item === data.page}
                            aria-label={`第 ${item} 页`}
                          >
                            {item}
                          </PageLink>
                        ),
                      )}

                      <PageLink
                        href={pageHref(data.page + 1)}
                        disabled={data.page >= data.pageCount}
                        aria-label="下一页"
                      >
                        下一页
                      </PageLink>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>

            {/* ---- 详情 ---- */}
            {detail ? (
              <ResponseDetailPanel detail={detail} closeHref={closeHref} canEdit={canEdit} />
            ) : null}
          </div>
        </div>
      </main>

      <ExportResponsesDialog
        open={exportOpen}
        onOpenChange={setExportOpen}
        questionnaireId={questionnaireId}
        channelId={channelId}
      />
    </>
  );
}

function PageLink({
  href,
  children,
  current = false,
  disabled = false,
  ...props
}: {
  href: string;
  children: React.ReactNode;
  current?: boolean;
  disabled?: boolean;
  'aria-label'?: string;
}) {
  if (disabled) {
    return (
      <span className="text-ink-300 h-7 cursor-not-allowed rounded-md px-2.5 text-[12px] leading-7">
        {children}
      </span>
    );
  }

  return (
    <Link
      href={href}
      aria-current={current ? 'page' : undefined}
      className={cn(
        'flex h-7 items-center rounded-md px-2.5 text-[12px] transition-colors duration-150',
        current ? 'bg-brand-500 font-medium text-white' : 'text-ink-600 hover:bg-ink-100',
      )}
      {...props}
    >
      {children}
    </Link>
  );
}

/** 页码窗口：总是给出「首 / 当前 ±1 / 末」，中间断开处放一个省略号 */
function pageWindow(current: number, total: number): (number | '…')[] {
  if (total <= 7) return Array.from({ length: total }, (_, index) => index + 1);

  const pages = new Set([1, total, current - 1, current, current + 1]);
  const sorted = [...pages].filter((page) => page >= 1 && page <= total).sort((a, b) => a - b);

  const result: (number | '…')[] = [];
  let previous = 0;

  for (const page of sorted) {
    if (previous && page - previous > 1) result.push('…');
    result.push(page);
    previous = page;
  }

  return result;
}
