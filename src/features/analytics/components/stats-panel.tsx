'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

import { DownloadIcon, HelpIcon, InfoIcon } from '@/components/icons/ui-icons';
import { QuestionnaireTopbar } from '@/components/layout/questionnaire-topbar';
import { ExportResponsesDialog } from '@/components/questionnaire/export-responses-dialog';
import { Button } from '@/components/ui/button';
import { FilterSelect } from '@/components/ui/filter-select';
import { Modal, ModalContent } from '@/components/ui/modal';
import {
  METRIC_HINT,
  QUESTION_TYPE_LABEL,
  TREND_GRANULARITY_LABEL,
  UPCOMING_BADGE,
} from '@/config/constants';
import { formatDurationMs } from '@/utils/format';

import type { AnalyticsData, AnalyticsQuestion } from '../api/analytics';
import { DateRangeFilter } from './date-range-filter';

/**
 * 数据统计（设计稿 W06 / P05）。
 *
 * 数字**全部由服务端算好**（`lib/stats.ts` + `api/analytics.ts`）后传进来：
 * 统计的难点在口径而不在渲染，让同一个纯函数同时喂卡片、图表和导出，
 * 才不会出现「卡片说 128、图表加起来 121」。
 *
 * 筛选走 URL（与问卷列表同一条规矩）：每个视图都能分享、能前进后退。
 * 而**趋势粒度不再是筛选条件** —— 它由服务端按区间跨度自动定（见 `lib/stats.ts`），
 * 这里只把结果标出来，让人知道每个点是多久。
 */
export function StatsPanel({
  data,
  channelId,
  from,
  to,
  canExport,
}: {
  data: AnalyticsData;
  channelId: string | null;
  /** `yyyy-mm-dd`，null = 不限 */
  from: string | null;
  to: string | null;
  canExport: boolean;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [exportOpen, setExportOpen] = useState(false);
  const [openQuestion, setOpenQuestion] = useState<AnalyticsQuestion | null>(null);

  const push = (patch: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(patch)) {
      if (value === null) params.delete(key);
      else params.set(key, value);
    }
    router.push(`?${params.toString()}`);
  };

  const { summary } = data;
  const filterActive = Boolean(channelId || from || to);

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

        {/* 分享报告属 2.0：灰显而不是不给，因为它在计划里、用户会问 */}
        <button
          type="button"
          disabled
          title={`分享报告属 ${UPCOMING_BADGE.V20} 规划，本版本不开放`}
          className="bg-brand-500/45 flex h-8 shrink-0 cursor-not-allowed items-center gap-1.5 rounded-lg px-3.5 text-[13px] font-medium text-white"
        >
          分享报告
          <span className="rounded bg-white/25 px-1 text-[10px]">{UPCOMING_BADGE.V20}</span>
        </button>
      </QuestionnaireTopbar>

      <main className="flex-1 overflow-y-auto p-6 sm:p-7">
        <div className="mx-auto max-w-[1020px] space-y-5">
          {/* ---- 指标卡 ---- */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              label="回收份数"
              value={String(summary.received)}
              hint={METRIC_HINT.RECEIVED}
              note={summary.invalid > 0 ? `含 ${summary.invalid} 份已标记无效` : '暂无无效答卷'}
            />
            <MetricCard
              label="有效答卷"
              value={String(summary.valid)}
              hint={METRIC_HINT.VALID}
              note="统计图仅含有效答卷"
            />
            <MetricCard
              label="完成率"
              value={summary.completionRate === null ? '—' : formatPercent(summary.completionRate)}
              hint={METRIC_HINT.COMPLETION}
              note={
                summary.completionRate === null
                  ? '还没有打开记录'
                  : // 打开次数是按问卷累计的、**不受时间筛选影响**（我们没按天记录打开）。
                    // 因此筛了区间之后，这个比率的分子被筛过、分母没有 —— 说出来比让人自己发现好
                    `${summary.views} 次打开，${summary.received} 次提交${
                      filterActive ? '（打开次数为全部时间）' : ''
                    }`
              }
            />
            <MetricCard
              label="平均用时"
              value={
                summary.averageDurationMs === null
                  ? '—'
                  : formatDurationMs(summary.averageDurationMs)
              }
              hint={METRIC_HINT.DURATION}
              note={
                summary.medianDurationMs === null
                  ? '还没有耗时记录'
                  : `中位数 ${formatDurationMs(summary.medianDurationMs)}`
              }
            />
          </div>

          {/* ---- 筛选栏 ---- */}
          <div className="border-ink-200 flex flex-wrap items-center gap-2 rounded-xl border bg-white px-4 py-3">
            <span className="text-ink-500 shrink-0 text-[12px]">筛选</span>

            <FilterSelect
              label="渠道"
              value={channelId ?? ''}
              onChange={(value) => push({ channel: value || null })}
              options={[
                { value: '', label: '全部渠道' },
                ...data.channels.map((channel) => ({
                  value: channel.id,
                  label: `${channel.name}（${channel.count}）`,
                })),
              ]}
            />

            <DateRangeFilter
              from={from}
              to={to}
              onChange={(next) => push({ from: next.from, to: next.to })}
            />

            <button
              type="button"
              disabled
              title={`交叉分析属 ${UPCOMING_BADGE.V11} 规划，本版本不开放`}
              className="border-ink-300 text-ink-400 flex h-8 cursor-not-allowed items-center gap-1.5 rounded-lg border border-dashed px-3 text-[12.5px]"
            >
              交叉分析
              <span className="bg-ink-100 text-ink-400 rounded px-1 text-[10px]">
                {UPCOMING_BADGE.V11}
              </span>
            </button>

            <span className="text-ink-400 ml-auto text-[11.5px]">
              数据更新于 {data.updatedAtLabel}
            </span>
          </div>

          {/* ---- 回收趋势 ---- */}
          <div className="border-ink-200 rounded-xl border bg-white p-6">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-ink-900 text-[15px] font-semibold">回收趋势</h2>
              {/* 粒度不再是可选项而是**结果**：把结果写出来，人才知道每个点是一天还是一周 */}
              <span className="text-ink-400 text-[11.5px]">
                按{TREND_GRANULARITY_LABEL[data.trend.granularity]}汇总 · 横轴为筛选区间
              </span>
            </div>

            <TrendChart points={data.trend.points} />
          </div>

          {/* ---- 单题图表 ---- */}
          {data.questions.map((question) => (
            <QuestionChartCard
              key={question.id}
              question={question}
              validCount={data.filteredValidCount}
              onShowAll={() => setOpenQuestion(question)}
            />
          ))}

          {data.questions.length === 0 ? (
            <div className="border-ink-200 text-ink-400 rounded-xl border border-dashed bg-white px-6 py-10 text-center text-[12.5px]">
              这份问卷还没有题目，先回编辑器加几道题。
            </div>
          ) : null}
        </div>
      </main>

      <AnswersDialog question={openQuestion} onClose={() => setOpenQuestion(null)} />

      <ExportResponsesDialog
        open={exportOpen}
        onOpenChange={setExportOpen}
        questionnaireId={data.id}
        channelId={channelId}
        from={from}
        to={to}
      />
    </>
  );
}

function MetricCard({
  label,
  value,
  hint,
  note,
}: {
  label: string;
  value: string;
  hint: string;
  note: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border-ink-200 rounded-xl border bg-white p-5">
      <div className="flex items-start justify-between gap-2">
        <span className="text-ink-500 text-[12.5px]">{label}</span>
        {/* 口径说明不是装饰：它是让人能核对数字的唯一入口 */}
        <button
          type="button"
          aria-label={`${label}的口径说明`}
          aria-expanded={open}
          onClick={() => setOpen((previous) => !previous)}
          className="text-ink-300 hover:text-ink-500 -mt-0.5 shrink-0"
        >
          <HelpIcon className="size-4" />
        </button>
      </div>

      <div className="text-ink-900 mt-1.5 font-mono text-[26px] leading-8 font-semibold">
        {value}
      </div>
      <div className="text-ink-400 mt-1 text-[11.5px]">{note}</div>

      {open ? (
        <p className="text-ink-500 border-ink-100 mt-3 border-t pt-3 text-[11.5px] leading-5">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

/**
 * 回收趋势折线图（手写 SVG）。
 *
 * 不引图表库：这里只需要一条折线加一条面积，而一个图表库会带来
 * 主题、字体、SSR 三套需要对齐的东西 —— 代价比收益大。
 * 空桶也画出来（`lib/stats.ts` 保证），否则「那天是 0」看起来像「那天不存在」。
 */
function TrendChart({ points }: { points: { key: string; label: string; count: number }[] }) {
  const width = 900;
  const height = 220;
  const padding = { top: 16, right: 16, bottom: 28, left: 36 };
  const innerWidth = width - padding.left - padding.right;
  const innerHeight = height - padding.top - padding.bottom;

  const max = Math.max(1, ...points.map((point) => point.count));
  const step = points.length > 1 ? innerWidth / (points.length - 1) : 0;

  const coordinates = points.map((point, index) => ({
    x: padding.left + index * step,
    y: padding.top + innerHeight - (point.count / max) * innerHeight,
    ...point,
  }));

  const line = coordinates.map((point) => `${point.x},${point.y}`).join(' ');
  const area = `${padding.left},${padding.top + innerHeight} ${line} ${
    padding.left + innerWidth
  },${padding.top + innerHeight}`;

  // x 轴只标首、中、尾：14 个标签挤在一起谁也读不出来
  const labelIndexes = new Set([0, Math.floor((points.length - 1) / 2), points.length - 1]);

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="h-[220px] w-full"
      role="img"
      aria-label="回收趋势"
    >
      {[0, 0.5, 1].map((ratio) => (
        <line
          key={ratio}
          x1={padding.left}
          x2={padding.left + innerWidth}
          y1={padding.top + innerHeight * ratio}
          y2={padding.top + innerHeight * ratio}
          className="stroke-ink-100"
          strokeWidth="1"
        />
      ))}

      <text x={4} y={padding.top + 4} className="fill-ink-400 text-[10px]">
        {max}
      </text>
      <text x={4} y={padding.top + innerHeight} className="fill-ink-400 text-[10px]">
        0
      </text>

      <polygon points={area} className="fill-brand-500/10" />
      <polyline points={line} fill="none" strokeWidth="2" className="stroke-brand-500" />

      {coordinates.map((point, index) => (
        <g key={point.key}>
          <circle
            cx={point.x}
            cy={point.y}
            r="3.5"
            className="stroke-brand-500 fill-white"
            strokeWidth="2"
          />
          {point.count > 0 ? (
            <text
              x={point.x}
              y={point.y - 9}
              textAnchor="middle"
              className="fill-ink-500 text-[10px]"
            >
              {point.count}
            </text>
          ) : null}
          {labelIndexes.has(index) ? (
            <text
              x={point.x}
              y={height - 8}
              textAnchor={index === 0 ? 'start' : index === points.length - 1 ? 'end' : 'middle'}
              className="fill-ink-400 text-[10px]"
            >
              {point.label}
            </text>
          ) : null}
        </g>
      ))}
    </svg>
  );
}

function QuestionChartCard({
  question,
  validCount,
  onShowAll,
}: {
  question: AnalyticsQuestion;
  validCount: number;
  onShowAll: () => void;
}) {
  const { stats } = question;

  return (
    <div className="border-ink-200 rounded-xl border bg-white p-6">
      <div className="mb-1 flex items-start gap-2">
        <h3 className="text-ink-900 text-[14px] font-semibold">{question.title}</h3>
        <span className="bg-ink-100 text-ink-500 mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-[10px]">
          {QUESTION_TYPE_LABEL[question.type]}
        </span>
      </div>

      <p className="text-ink-400 mb-5 text-[11.5px]">
        {stats.kind === 'CHOICE'
          ? `有效作答 ${stats.answered} 人 · 占比分母为作答人数`
          : stats.kind === 'RATING'
            ? `有效作答 ${stats.answered} 人 · 保留一位小数`
            : `有效作答 ${stats.answered} 人 · ${
                question.required ? '必答题' : '选填题'
              }${stats.answerRate === null ? '' : `，作答率 ${formatPercent(stats.answerRate)}`}`}
      </p>

      {stats.kind === 'CHOICE' ? (
        <div className="space-y-3">
          {stats.multi ? (
            <p className="text-ink-500 bg-ink-50 flex items-center gap-1.5 rounded-lg px-3 py-2 text-[11.5px]">
              <InfoIcon className="size-3.5 shrink-0" />
              多选题：各选项占比之和大于 100%
            </p>
          ) : null}

          {stats.rows.map((row) => (
            <div key={row.label}>
              <div className="mb-1.5 flex items-center justify-between text-[12.5px]">
                <span className="text-ink-700">{row.label}</span>
                <span className="text-ink-500 font-mono">
                  {row.count} · {formatPercent(row.percent)}
                </span>
              </div>
              <div className="bg-ink-100 h-2 overflow-hidden rounded-full">
                <div
                  className="bg-brand-500 h-full rounded-full"
                  style={{ width: `${Math.round(row.percent * 100)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {stats.kind === 'RATING' ? (
        <div className="flex flex-wrap items-end gap-8">
          <div>
            <div className="text-ink-900 font-mono text-[30px] leading-9 font-semibold">
              {stats.average === null ? '—' : stats.average.toFixed(1)}
            </div>
            <div className="text-ink-400 mt-1 text-[12px]">平均分 / {stats.max} 分</div>
          </div>

          <div className="flex min-w-[240px] flex-1 items-end gap-1.5">
            {stats.rows.map((row) => {
              const height = Math.max(4, Math.round(row.percent * 96));

              return (
                <div key={row.score} className="flex flex-1 flex-col items-center gap-1">
                  <span className="text-ink-400 font-mono text-[10px]">{row.count}</span>
                  <div className="bg-brand-500/85 w-full rounded-t" style={{ height }} />
                  <span className="text-ink-400 font-mono text-[10px]">{row.score}</span>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      {stats.kind === 'TEXT' ? (
        <div>
          {stats.samples.length === 0 ? (
            <p className="text-ink-400 text-[12.5px]">还没有人填写这道题。</p>
          ) : (
            <div className="space-y-2">
              {stats.samples.map((sample, index) => (
                <div key={index} className="bg-ink-50 border-ink-100 rounded-[10px] border p-3">
                  <p className="text-ink-700 text-[12.5px] leading-5">{sample}</p>
                </div>
              ))}
            </div>
          )}

          {stats.answered > stats.samples.length ? (
            <Button
              variant="ghost"
              size="sm"
              className="text-brand-500 mt-3 w-full"
              onClick={onShowAll}
            >
              查看全部 {stats.answered} 条回答
            </Button>
          ) : null}
        </div>
      ) : null}

      <p className="text-ink-300 mt-4 text-[11px]">
        {validCount > 0
          ? `本次筛选范围内有 ${validCount} 份有效答卷`
          : '本次筛选范围内还没有有效答卷'}
      </p>
    </div>
  );
}

function AnswersDialog({
  question,
  onClose,
}: {
  question: AnalyticsQuestion | null;
  onClose: () => void;
}) {
  if (!question || question.stats.kind !== 'TEXT') return null;

  return (
    <Modal open onOpenChange={onClose}>
      <ModalContent
        title="全部回答"
        description={`${question.title} · 共 ${question.stats.answered} 条`}
        width="md"
      >
        <div className="max-h-[60vh] space-y-2 overflow-y-auto">
          {question.stats.all.map((answer, index) => (
            <div key={index} className="bg-ink-50 border-ink-100 rounded-[10px] border p-3">
              <p className="text-ink-700 text-[12.5px] leading-5">{answer}</p>
            </div>
          ))}
        </div>
      </ModalContent>
    </Modal>
  );
}

function formatPercent(ratio: number) {
  return `${(ratio * 100).toFixed(1)}%`;
}
