'use client';

import { useRouter, useSearchParams } from 'next/navigation';

import { DownloadIcon } from '@/components/icons/ui-icons';
import { Topbar } from '@/components/layout/topbar';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { FilterSelect } from '@/components/ui/filter-select';
import { LOG_GROUP_OPTIONS, LOG_RANGE_DAYS } from '@/config/constants';

import type { LogsPageData } from '../api/logs';

/**
 * 操作日志（W10）。
 *
 * 三条刻意的处理：
 * - 筛选全走 URL（与其它管理页同一条规矩）：`?actor=&group=&days=`，视图可分享可后退。
 * - 时间线按天分组，**每条的「第二行」是「时间 · 分组 · 补充」**：一眼能分出
 *   「谁在什么时候动过什么」，而不是一串同质化的行。
 * - 「导出日志」直接跳下载接口（CSV 带 BOM，与答卷导出同一套约定）。
 */
export function LogsPanel({
  data,
  actorId,
  group,
  days,
  canExport,
}: {
  data: LogsPageData;
  actorId: string | null;
  group: string | null;
  days: number;
  canExport: boolean;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const basePath = '/app/logs';

  const push = (patch: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(patch)) {
      if (value === null) params.delete(key);
      else params.set(key, value);
    }

    const queryString = params.toString();
    router.push(queryString ? `${basePath}?${queryString}` : basePath);
  };

  const exportHref = (() => {
    const params = new URLSearchParams({ days: String(days) });
    if (actorId) params.set('actor', actorId);
    if (group) params.set('group', group);

    return `/api/logs/export?${params.toString()}`;
  })();

  return (
    <>
      <Topbar
        title="操作日志"
        actions={
          canExport ? (
            <Button variant="outline" size="sm" asChild>
              <a href={exportHref} download>
                <DownloadIcon className="size-3.5" />
                导出日志
              </a>
            </Button>
          ) : null
        }
      />

      <main className="flex-1 overflow-y-auto p-6 sm:p-7">
        <div className="mx-auto max-w-[900px]">
          {/* ---- 筛选 ---- */}
          <div className="mb-5 flex flex-wrap items-center gap-3">
            <FilterSelect
              label="成员"
              placeholder="全部成员"
              value={actorId ?? ''}
              onChange={(value) => push({ actor: value || null })}
              options={data.actors.map((actor) => ({ value: actor.id, label: actor.name }))}
            />

            <FilterSelect
              label="操作类型"
              placeholder="全部操作类型"
              value={group ?? ''}
              onChange={(value) => push({ group: value || null })}
              // 选项来自唯一那份分组清单（`config/constants.ts`）：
              // 这里原本硬编码了同样 5 个值，加一个分组就会有一处忘了跟上
              options={LOG_GROUP_OPTIONS.map((group) => ({ value: group, label: group }))}
            />

            <FilterSelect
              label="时间范围"
              value={String(days)}
              onChange={(value) => push({ days: value === '7' ? null : value })}
              options={LOG_RANGE_DAYS.map((value) => ({
                value: String(value),
                label: `最近 ${value} 天`,
              }))}
            />

            <span className="text-ink-400 ml-auto text-[12px]">共 {data.total} 条</span>
          </div>

          {/* ---- 时间线 ---- */}
          <div className="border-ink-200 rounded-xl border bg-white p-6">
            {data.days.length === 0 ? (
              <EmptyState
                icon={<DownloadIcon className="size-6" />}
                title="这段时间里没有操作记录"
                description="换个时间范围或成员试试；发布、暂停、邀请、导出这类关键动作都会记在这里。"
              />
            ) : (
              data.days.map((day, dayIndex) => (
                <div key={day.key}>
                  <div
                    className={
                      dayIndex === 0
                        ? 'text-ink-400 mb-4 text-[11.5px] font-medium'
                        : 'text-ink-400 border-ink-100 mt-7 mb-4 border-t pt-5 text-[11.5px] font-medium'
                    }
                  >
                    {day.label}
                  </div>

                  <div>
                    {day.rows.map((row, rowIndex) => (
                      <div key={row.id} className="flex gap-4 pb-5">
                        <div className="flex shrink-0 flex-col items-center">
                          <Avatar name={row.actorName} size="md" tone="brand" />
                          {/* 连到下一条的竖线；每组最后一条不画 */}
                          {rowIndex < day.rows.length - 1 ? (
                            <span className="bg-ink-200 mt-2 w-px flex-1" />
                          ) : null}
                        </div>

                        <div className="flex-1 pt-0.5">
                          <div className="text-ink-800 text-[13px] leading-6">
                            <b className="font-medium">{row.actorName}</b> {row.sentence.prefix}{' '}
                            <b className="font-medium">{row.sentence.target}</b>
                            {row.sentence.suffix}
                          </div>
                          <div className="text-ink-400 mt-1 text-[11.5px]">
                            {row.timeLabel} · {row.groupLabel}
                            {row.extra ? ` · ${row.extra}` : ''}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>

          <p className="text-ink-400 mt-4 text-[12px]">
            日志仅记录结构性操作与关键动作，不记录答卷内容。
            {data.truncated ? ` 当前只显示最近 ${data.total} 条，更早的请用「导出日志」。` : ''}
          </p>
        </div>
      </main>
    </>
  );
}
