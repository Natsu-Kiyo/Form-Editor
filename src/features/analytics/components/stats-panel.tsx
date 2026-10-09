'use client';

import { useRef, useState, type PointerEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

import { DownloadIcon, HelpIcon, InfoIcon } from '@/components/icons/ui-icons';
import { QuestionnaireTopbar } from '@/components/layout/questionnaire-topbar';
import { ExportResponsesDialog } from '@/components/questionnaire/export-responses-dialog';
import { Button } from '@/components/ui/button';
import { FilterSelect } from '@/components/ui/filter-select';
import { Modal, ModalContent } from '@/components/ui/modal';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { useIsDesktop } from '@/hooks/use-is-desktop';
import {
  METRIC_HINT,
  QUESTION_TYPE_LABEL,
  TREND_GRANULARITY,
  TREND_GRANULARITY_LABEL,
  type TrendGranularity,
} from '@/config/constants';
import { cn } from '@/utils/cn';
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
/**
 * 原来这里有一个灰显的「分享报告」（只读外链，2.0）。
 * R61 起该项**决定不做**，入口与相关代码一并移除（见 docs/PLAN.md §11.5 B）。
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
  /** 断点写 1024：与 Tailwind 的 `lg` 对齐（`useIsDesktop` 默认 768 会让中间那一档错位） */
  const isDesktop = useIsDesktop('(min-width: 1024px)');
  /** 窄屏横滑到第几张单题卡（只用来点亮底部圆点） */
  const [activeQuestion, setActiveQuestion] = useState(0);

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
  /** 窄屏「筛选」那一行上的角标（几项条件生效中） */
  const filterCount = [channelId, from, to].filter(Boolean).length;

  /**
   * 筛选控件本体。桌面放进常驻筛选栏、窄屏放进「筛选」弹层 ——
   * **同一份 JSX**，所以两端的可筛条件是同一组（不会出现「桌面上能按渠道筛、手机上不能」）。
   */
  const filterControls = (
    <>
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

      <span className="text-ink-400 text-[11.5px] lg:ml-auto">
        数据更新于 {data.updatedAtLabel}
      </span>
    </>
  );

  return (
    <>
      <QuestionnaireTopbar
        titleSlot={
          <h1 className="text-ink-900 truncate text-[15px] font-semibold">{data.title}</h1>
        }
      >
        {/* 桌面把「导出」放在顶栏；窄屏挪到页面底部（P05），这里就不重复渲染 */}
        <div className="hidden items-center gap-3 lg:flex">
          {canExport ? (
            <Button variant="outline" size="sm" onClick={() => setExportOpen(true)}>
              <DownloadIcon className="size-3.5" />
              导出
            </Button>
          ) : null}
        </div>
      </QuestionnaireTopbar>

      {/* 窄屏底部有固定的「导出」条（查看者没有导出、也就没有这一条），内容要留出它的高度 */}
      <main
        className={cn('flex-1 overflow-y-auto p-6 sm:p-7', canExport ? 'pb-32 lg:pb-7' : 'pb-6')}
      >
        <div className="mx-auto max-w-[1020px] space-y-5">
          {/*
            ---- 筛选 ----
            **排在指标卡之上**（R72）：日期与渠道会改变下面每一个数字 ——
            「先筛、再看」才是读这张页面的顺序；把筛选器放在被它改变的数字下面，
            人得先读一遍不对的数字、再回头找条件。
            桌面是一整条常驻筛选栏；窄屏收进「筛选」弹层 —— 375px 上把渠道下拉、
            日期区间、更新时间全摊开，会把趋势图挤到第二屏之外。
            用 `isDesktop` 而不是 CSS 隐藏：隐藏的控件仍在 DOM 里，仍会被 Tab 聚焦、
            仍会被自动化匹配到（这两条都在本项目踩过）。
          */}
          {isDesktop ? (
            <div className="border-ink-200 flex flex-wrap items-center gap-2 rounded-xl border bg-white px-4 py-3">
              <span className="text-ink-500 shrink-0 text-[12px]">筛选</span>
              {filterControls}
            </div>
          ) : (
            <Sheet>
              <SheetTrigger asChild>
                <button
                  type="button"
                  className="border-ink-200 flex w-full items-center gap-2 rounded-xl border bg-white px-4 py-3 text-left"
                >
                  <span className="text-ink-500 text-[12px]">筛选</span>
                  {filterCount > 0 ? (
                    <span className="bg-brand-50 text-brand-600 rounded-full px-2 py-0.5 text-[11px] font-medium">
                      {filterCount} 项
                    </span>
                  ) : (
                    <span className="text-ink-400 text-[12px]">全部时间 · 全部渠道</span>
                  )}
                  <span className="text-ink-300 ml-auto text-[13px]">›</span>
                </button>
              </SheetTrigger>
              <SheetContent title="筛选" description="与桌面端是同一组条件">
                <div className="space-y-4">{filterControls}</div>
              </SheetContent>
            </Sheet>
          )}

          {/* ---- 指标卡（窄屏 2×2：四张竖排会把趋势挤到第二屏之外）---- */}
          <div className="grid grid-cols-2 gap-3 lg:gap-4 xl:grid-cols-4">
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

          {/*
            窄屏用**一条统一口径说明**代替逐卡那个「?」——
            375px 下四张卡各挂一个问号，会把数字本身挤掉（设计稿 P05 的原话）。
            桌面保留逐卡说明：那里有空间，就近解释更省事。
          */}
          <div className="bg-brand-50 border-brand-100 flex items-start gap-2.5 rounded-xl border p-3 lg:hidden">
            <InfoIcon className="text-brand-500 mt-0.5 size-3.5 shrink-0" />
            <p className="text-brand-700 text-[11px] leading-4">
              口径：完成率 = 提交份数 / 打开链接数
              {summary.invalid > 0 ? `；有效答卷已剔除标记无效的 ${summary.invalid} 份` : ''}
              。多选题各项占比之和会大于 100%，分母为作答人数。
            </p>
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

            <TrendChart points={data.trend.points} granularity={data.trend.granularity} />
          </div>

          {/*
            ---- 单题图表 ----
            窄屏**横向滑动**（一次一张卡）：375px 下把四张图竖着排，人会滑到忘记
            第一张长什么样。桌面照旧纵向堆叠 —— 那里一屏能看两张，横滑反而更难比对。
          */}
          <div
            onScroll={(event) => {
              const el = event.currentTarget;
              if (el.children.length < 2) return;
              // 按「滑过了几个卡片宽度」算，不依赖具体像素
              const step = el.scrollWidth / el.children.length;
              setActiveQuestion(
                Math.min(el.children.length - 1, Math.max(0, Math.round(el.scrollLeft / step))),
              );
            }}
            className="-mx-6 flex snap-x snap-mandatory gap-3 overflow-x-auto px-6 pb-1 lg:mx-0 lg:block lg:space-y-5 lg:overflow-visible lg:px-0 lg:pb-0"
          >
            {data.questions.map((question) => (
              <div key={question.id} className="w-[86%] shrink-0 snap-center lg:w-auto">
                <QuestionChartCard
                  question={question}
                  validCount={data.filteredValidCount}
                  onShowAll={() => setOpenQuestion(question)}
                />
              </div>
            ))}
          </div>

          {data.questions.length > 1 ? (
            <div className="flex items-center justify-between lg:hidden">
              <span className="text-ink-400 text-[11px]">
                左右滑动查看全部 {data.questions.length} 题
              </span>
              <div className="flex items-center gap-1">
                {data.questions.map((question, index) => (
                  <span
                    key={question.id}
                    className={
                      index === activeQuestion
                        ? 'bg-brand-500 h-1 w-4 rounded-full'
                        : 'bg-ink-200 h-1 w-1 rounded-full'
                    }
                  />
                ))}
              </div>
            </div>
          ) : null}

          {data.questions.length === 0 ? (
            <div className="border-ink-200 text-ink-400 rounded-xl border border-dashed bg-white px-6 py-10 text-center text-[12.5px]">
              这份问卷还没有题目，先回编辑器加几道题。
            </div>
          ) : null}
        </div>
      </main>

      {/* 窄屏：P05 的底部条（桌面这个动作在顶栏里，见上）。查看者没有导出 → 整条不渲染 */}
      {canExport ? (
        <div className="border-ink-100 fixed inset-x-0 bottom-0 z-30 flex gap-2.5 border-t bg-white px-5 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] lg:hidden">
          <Button
            variant="outline"
            className="h-[46px] flex-1 rounded-[14px]"
            onClick={() => setExportOpen(true)}
          >
            <DownloadIcon className="size-4" />
            导出
          </Button>
        </div>
      ) : null}

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
 *
 * 三条读图约定（R70，对齐所有者给的参考图）：
 * - **两个轴都带刻度**：y 轴按「好看的步长」（1/2/5 × 10ⁿ）铺 4–6 条网格线，
 *   x 轴按「标签间距 ≥ 54（viewBox 单位）」决定每隔几个点标一个 —— 30 个点每 2 天一个，
 *   数字密一点，不用凑近数。
 * - **精确值在 hover 里**：平时折线上不标数字（30 个点会糊成一片），
 *   鼠标横向滑过时取**最近的那天**：竖虚线 + 实心点 + 一张浮层（日期 + 份数）。
 *   浮层锚在数据点上、不跟着鼠标飘 —— 它说的是「这一天」的数。
 * - **触屏同样可用**：pointer 事件天然覆盖触摸；纵向滚动时浏览器接管手势，
 *   浮层自然收起（不抢页面的滚动）。
 * - **浮层说清「这个点覆盖哪一段」**：按周汇总时只写起点（`08-17`）会让人问
 *   「那 08-18 去哪了」—— 不是选不到，是它们被包在这一周里。
 */
function TrendChart({
  points,
  granularity,
}: {
  points: { key: string; label: string; count: number }[];
  granularity: TrendGranularity;
}) {
  const width = 900;
  const height = 220;
  const padding = { top: 18, right: 18, bottom: 30, left: 44 };
  const innerWidth = width - padding.left - padding.right;
  const innerHeight = height - padding.top - padding.bottom;

  const max = Math.max(1, ...points.map((point) => point.count));
  const step = points.length > 1 ? innerWidth / (points.length - 1) : 0;

  const { step: tickStep, upper } = niceScale(max);
  const yTicks: number[] = [];
  for (let value = 0; value <= upper; value += tickStep) yTicks.push(value);

  const coordinates = points.map((point, index) => ({
    x: padding.left + index * step,
    y: padding.top + innerHeight - (point.count / upper) * innerHeight,
    ...point,
  }));

  const line = coordinates.map((point) => `${point.x},${point.y}`).join(' ');
  const area = `${padding.left},${padding.top + innerHeight} ${line} ${
    padding.left + innerWidth
  },${padding.top + innerHeight}`;

  // x 轴标签：相邻至少隔 54（30 个点 → 每 2 个一个；14 个点 → 全标）
  const labelEvery = Math.max(1, Math.ceil(54 / Math.max(1, step)));
  const lastIndex = points.length - 1;
  const labelIndexes: number[] = [];
  for (let index = 0; index <= lastIndex; index += labelEvery) labelIndexes.push(index);
  if (labelIndexes.at(-1) !== lastIndex) {
    // 末尾离上一档**不足一整档**就顶掉上一档（差一格时两串日期会叠字），
    // 留住最后一个 —— 区间末端必须可读
    if (lastIndex - (labelIndexes.at(-1) ?? 0) < labelEvery) labelIndexes.pop();
    labelIndexes.push(lastIndex);
  }

  // ---- hover：按鼠标横向位置取最近的点 ----
  const [active, setActive] = useState<{ index: number; left: number; top: number } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const handleMove = (event: PointerEvent<SVGSVGElement>) => {
    const svg = svgRef.current;
    const matrix = svg?.getScreenCTM();
    if (!svg || !matrix || points.length === 0) return;

    const rect = svg.getBoundingClientRect();
    // 屏幕坐标 → viewBox 坐标：`getScreenCTM` 已经把缩放与居中留白算进去了
    const svgX = (event.clientX - matrix.e) / matrix.a;
    const index = Math.min(lastIndex, Math.max(0, Math.round((svgX - padding.left) / (step || 1))));
    const point = coordinates[index]!;

    // 浮层不越出卡片左右边缘（锚在点上，靠边时允许偏离居中）
    const halfTooltip = 72;
    const left = Math.min(
      Math.max(matrix.e + point.x * matrix.a - rect.left, halfTooltip),
      rect.width - halfTooltip,
    );

    setActive((previous) =>
      previous?.index === index
        ? previous
        : { index, left, top: matrix.f + point.y * matrix.d - rect.top },
    );
  };

  const activePoint = active ? coordinates[active.index]! : null;
  // 点太靠上时浮层翻到点的下方（否则会被卡片上边缘切掉）
  const placeBelow = active ? active.top < 70 : false;

  return (
    <div className="relative">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${width} ${height}`}
        className="h-[220px] w-full"
        role="img"
        aria-label="回收趋势"
        onPointerMove={handleMove}
        onPointerLeave={() => setActive(null)}
      >
        {/* y 轴：每个刻度一条网格线 + 一个数字 */}
        {yTicks.map((value) => {
          const y = padding.top + innerHeight - (value / upper) * innerHeight;

          return (
            <g key={value}>
              <line
                x1={padding.left}
                x2={padding.left + innerWidth}
                y1={y}
                y2={y}
                className="stroke-ink-100"
                strokeWidth="1"
              />
              <text
                x={padding.left - 8}
                y={y + 3.5}
                textAnchor="end"
                className="fill-ink-400 text-[10px]"
              >
                {value}
              </text>
            </g>
          );
        })}

        <polygon points={area} className="fill-brand-500/10" />
        <polyline points={line} fill="none" strokeWidth="2" className="stroke-brand-500" />

        {/* hover：竖虚线 + 实心点（画在折线之上，穿过去也看得清） */}
        {activePoint ? (
          <>
            <line
              x1={activePoint.x}
              x2={activePoint.x}
              y1={padding.top}
              y2={padding.top + innerHeight}
              className="stroke-ink-300"
              strokeWidth="1"
              strokeDasharray="4 4"
            />
            <circle cx={activePoint.x} cy={activePoint.y} r="4.5" className="fill-brand-500" />
          </>
        ) : null}

        {coordinates.map((point, index) =>
          labelIndexes.includes(index) ? (
            <text
              key={point.key}
              x={point.x}
              y={height - 9}
              textAnchor={index === 0 ? 'start' : index === lastIndex ? 'end' : 'middle'}
              className="fill-ink-400 text-[10px]"
            >
              {point.label}
            </text>
          ) : null,
        )}
      </svg>

      {/*
        浮层：`aria-hidden` 是因为它是 hover 的视觉增强（数据本身在图上有 aria-label），
        不加只会让读屏在鼠标滑过时反复念同一件事；`pointer-events-none` 保证它不挡住取点。
      */}
      {activePoint ? (
        <div
          aria-hidden="true"
          /*
           * `w-max` 不能少：绝对定位元素的宽度默认被「left 到容器右缘」的可用空间
           * 挤压（`translateX(-50%)` 是绘制期的变换，不参与布局）—— 靠右 hover 时
           * 浮层会被压成一根竖条。
           */
          className="border-ink-200 pointer-events-none absolute z-10 w-max rounded-[10px] border bg-white px-3 py-2 shadow-sm"
          style={{
            left: active!.left,
            top: active!.top + (placeBelow ? 14 : -14),
            transform: `translateX(-50%)${placeBelow ? '' : ' translateY(-100%)'}`,
          }}
        >
          <div className="text-ink-500 text-[11px]">{tooltipTitle(activePoint, granularity)}</div>
          <div className="mt-1 flex items-center gap-1.5">
            <span className="bg-brand-500 size-1.5 rounded-full" />
            <span className="text-ink-500 text-[11.5px]">回收份数</span>
            <span className="text-ink-900 ml-0.5 font-mono text-[12.5px] font-semibold">
              {activePoint.count}
            </span>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/**
 * 浮层第一行：这个点**覆盖哪一段**。
 *
 * 按周汇总时若只写起点（`08-17`），人会问「08-18 去哪了 —— 是不是 hover 选不到」：
 * 不是选不到，是它们被包在这一周里。写成 `08-17 ~ 08-23` 这个疑问就没了
 * （图表库的「吸附最近点」同样只会给这一周 —— 问题不在画图方式，在文案）。
 * 天与月不用改：`09-24`、`2026-09` 本身就说明了覆盖范围。
 */
function tooltipTitle(point: { key: string; label: string }, granularity: TrendGranularity) {
  if (granularity !== TREND_GRANULARITY.WEEK) return point.label;

  // 周桶的 key 是 `W2026-08-17`（周一）：加 6 天就是周日
  const start = new Date(`${point.key.slice(1)}T00:00:00Z`);
  const end = new Date(start.getTime() + 6 * 24 * 60 * 60 * 1000);
  const mmdd = (date: Date) =>
    `${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;

  return `${mmdd(start)} ~ ${mmdd(end)}`;
}

/**
 * y 轴的「好看的」步长与上界（1 / 2 / 5 × 10ⁿ）：目标是 4–6 条网格线 ——
 * 太稀没有参照，太密数字自己先打起来。步长下限是 1：份数是整数，
 * 出现「0.2」这种刻度就错了。
 */
function niceScale(max: number) {
  const raw = max / 5;
  const magnitude = 10 ** Math.floor(Math.log10(Math.max(1, raw)));
  const normalized = raw / magnitude;
  const factor = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  const step = Math.max(1, factor * magnitude);

  return { step, upper: Math.max(step, Math.ceil(max / step) * step) };
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
            : stats.kind === 'MATRIX'
              ? `有效作答 ${stats.answered} 人 · 每行的分母是该行作答人数`
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

      {stats.kind === 'MATRIX' ? (
        <div className="space-y-6">
          {stats.rows.map((row) => (
            <div key={row.label}>
              <div className="mb-2.5 flex items-center justify-between gap-3 text-[12.5px]">
                <span className="text-ink-700 font-medium">{row.label}</span>
                <span className="text-ink-400 shrink-0 font-mono text-[11.5px]">
                  {row.answered} 人评价
                </span>
              </div>

              <div className="space-y-2">
                {row.cells.map((cell) => (
                  <div key={cell.label} className="flex items-center gap-3">
                    {/* 列名最长 12 字（编辑器侧的上限），放不下时截断、hover 看全文 */}
                    <span
                      title={cell.label}
                      className="text-ink-500 w-16 shrink-0 truncate text-[12px]"
                    >
                      {cell.label}
                    </span>
                    <div className="bg-ink-100 h-2 flex-1 overflow-hidden rounded-full">
                      <div
                        className="bg-brand-500 h-full rounded-full"
                        style={{ width: `${Math.round(cell.percent * 100)}%` }}
                      />
                    </div>
                    <span className="text-ink-500 w-20 shrink-0 text-right font-mono text-[11.5px]">
                      {cell.count} · {formatPercent(cell.percent)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
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
