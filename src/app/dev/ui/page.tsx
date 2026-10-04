import { notFound } from 'next/navigation';

import { Logo } from '@/components/icons/logo';

import { ComponentGallery } from './component-gallery';

/**
 * 设计系统走查页（**仅开发环境**）。
 *
 * 用途：把 Tailwind v4 的 `@theme` token 与 21 个基础组件逐个渲染出来，
 * 与 `d:/code/design/01-设计系统与页面映射.html` 并排比对，确认没有视觉漂移。
 *
 * 生产环境直接 404：它是开发期的度量工具，不是产品的一部分。
 * 之所以保留而不是一次性删掉，是因为后面 M1–M10 还会不断新增组件，
 * 每次都需要同一个尺子。
 *
 * 前 8 节刻意**不引入任何自研组件**，全部用原始 Tailwind 类名书写 ——
 * 这样量到的是 token 本身，而不是组件实现。第 9 节反过来，只量组件。
 */

const BRAND_STEPS: { name: string; className: string; text: string }[] = [
  { name: '50', className: 'bg-brand-50', text: 'text-brand-700' },
  { name: '100', className: 'bg-brand-100', text: 'text-brand-700' },
  { name: '200', className: 'bg-brand-200', text: 'text-brand-700' },
  { name: '300', className: 'bg-brand-300', text: 'text-brand-900' },
  { name: '400', className: 'bg-brand-400', text: 'text-white' },
  { name: '500', className: 'bg-brand-500', text: 'text-white' },
  { name: '600', className: 'bg-brand-600', text: 'text-white' },
  { name: '700', className: 'bg-brand-700', text: 'text-white' },
  { name: '800', className: 'bg-brand-800', text: 'text-white' },
  { name: '900', className: 'bg-brand-900', text: 'text-white' },
];

const INK_STEPS = [
  'bg-ink-50',
  'bg-ink-100',
  'bg-ink-200',
  'bg-ink-300',
  'bg-ink-400',
  'bg-ink-500',
  'bg-ink-600',
  'bg-ink-700',
  'bg-ink-800',
  'bg-ink-900',
];

const CHART_STEPS = [
  'bg-chart-1',
  'bg-chart-2',
  'bg-chart-3',
  'bg-chart-4',
  'bg-chart-5',
  'bg-chart-6',
];

const SEMANTIC = [
  { dot: 'bg-emerald-500', label: '已发布 / 提交成功 / 校验通过', hex: '#10B981' },
  { dot: 'bg-amber-500', label: '已暂停 / 接近回收上限 / 待处理', hex: '#F59E0B' },
  { dot: 'bg-rose-500', label: '删除 / 校验失败 / 已达上限', hex: '#EF4444' },
];

const TYPE_SCALE = [
  {
    name: 'Display',
    cls: 'text-display font-semibold text-ink-900',
    spec: '32 / 40 · 600',
    use: '登录页主标题、引导页',
  },
  {
    name: 'Title L',
    cls: 'text-title-l font-semibold text-ink-900',
    spec: '24 / 32 · 600',
    use: '页面主标题',
  },
  {
    name: 'Title M',
    cls: 'text-title-m font-semibold text-ink-900',
    spec: '18 / 28 · 600',
    use: '卡片标题、弹层标题',
  },
  {
    name: 'Body',
    cls: 'text-body text-ink-700',
    spec: '14 / 22 · 400',
    use: '正文、表格内容、表单值',
  },
  {
    name: 'Body S',
    cls: 'text-body-s text-ink-500',
    spec: '13 / 20 · 400',
    use: '辅助说明、卡片描述',
  },
  {
    name: 'Label',
    cls: 'text-label font-medium text-ink-600',
    spec: '12 / 18 · 500',
    use: '表头、表单标签、标签胶囊',
  },
  {
    name: 'Caption',
    cls: 'text-caption text-ink-400',
    spec: '11 / 16 · 400',
    use: '极小注释、图表刻度',
  },
];

const RADII = [
  { spec: '6px', cls: 'rounded-md', use: '小控件' },
  { spec: '10px', cls: 'rounded-btn', use: '按钮' },
  { spec: '12px', cls: 'rounded-card', use: '卡片' },
  { spec: '16px', cls: 'rounded-modal', use: '弹层' },
  { spec: 'full', cls: 'rounded-full', use: '标签' },
];

const SHADOWS = [
  { cls: 'shadow-sm', label: 'sm — 输入框聚焦 / 开关滑块 / 分段控件选中块' },
  { cls: 'shadow-card', label: 'card — 卡片默认' },
  { cls: 'shadow-pop', label: 'pop — 弹层 / 下拉 / 抽屉 / 模态' },
  { cls: 'shadow-fab', label: 'fab — 仅移动端悬浮操作按钮' },
];

const STATUS_TAGS = [
  { cls: 'bg-emerald-50 text-emerald-700', dot: 'bg-emerald-500', label: '回收中' },
  { cls: 'bg-amber-50 text-amber-700', dot: 'bg-amber-500', label: '已暂停' },
  { cls: 'bg-ink-100 text-ink-600', dot: 'bg-ink-400', label: '已截止' },
  { cls: 'bg-brand-50 text-brand-600', dot: '', label: '草稿' },
  { cls: 'bg-rose-50 text-rose-600', dot: '', label: '已达上限' },
];

const ROLE_BADGES = [
  { cls: 'bg-brand-500 text-white', label: '所有者' },
  { cls: 'bg-brand-100 text-brand-700', label: '管理员' },
  { cls: 'bg-ink-100 text-ink-700', label: '编辑者' },
  { cls: 'bg-ink-50 text-ink-500 border border-ink-200', label: '查看者' },
];

function Section({
  title,
  note,
  children,
}: {
  title: string;
  note?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-14">
      <h2 className="text-title-l text-ink-900 font-semibold">{title}</h2>
      {note ? <p className="text-body-s text-ink-500 mt-2 max-w-3xl">{note}</p> : null}
      <div className="mt-5">{children}</div>
    </section>
  );
}

function Panel({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-card border-ink-200 shadow-card border bg-white p-6 ${className ?? ''}`}
    >
      {children}
    </div>
  );
}

export default function DesignTokensPage() {
  if (process.env.NODE_ENV === 'production') {
    notFound();
  }

  return (
    <main className="mx-auto w-full max-w-[1180px] px-8 py-14">
      <header className="border-ink-200 mb-10 border-b pb-8">
        <div className="mb-4 flex items-center gap-3">
          <div className="bg-brand-500 flex size-9 items-center justify-center rounded-[10px]">
            <Logo className="size-5" />
          </div>
          <span className="text-title-m text-ink-900 font-semibold tracking-tight">轻问卷</span>
        </div>
        <h1 className="text-display text-ink-900 font-semibold tracking-[-0.02em]">
          M0 · 设计 token 走查
        </h1>
        <p className="text-ink-500 mt-3 max-w-3xl text-[15px] leading-7">
          用来核对 Tailwind v4{' '}
          <code className="bg-ink-100 text-ink-800 rounded px-1.5 py-0.5">@theme</code> 的 token
          是否与设计稿一致。对照物是{' '}
          <code className="bg-ink-100 text-ink-800 rounded px-1.5 py-0.5">
            design/01-设计系统与页面映射.html
          </code>
          。本页只在开发环境可见（生产环境 404）。
        </p>
      </header>

      <Section
        title="01 · 品牌色阶 brand"
        note="500 = #31438C 为品牌指定主色。400（次级填充）与 600（hover）是它唯一的两个交互邻居，其余色阶不得用于按钮。"
      >
        <div className="grid grid-cols-5 gap-2 md:grid-cols-10">
          {BRAND_STEPS.map((step) => (
            <div key={step.name}>
              <div
                className={`flex h-14 items-end rounded-[10px] p-2 text-[11px] font-medium tracking-[0.02em] ${step.className} ${step.text}`}
              >
                {step.name}
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section title="02 · 中性色阶 ink" note="正文不低于 ink-500；ink-400 只用于占位符与禁用态。">
        <div className="grid grid-cols-10 gap-1.5">
          {INK_STEPS.map((cls, index) => (
            <div
              key={cls}
              className={`flex h-10 items-end rounded-[10px] p-1.5 text-[10px] font-medium ${
                index < 4 ? 'text-ink-600' : 'text-white'
              } ${cls}`}
            >
              {index * 100 + 50}
            </div>
          ))}
        </div>
      </Section>

      <Section
        title="03 · 图表色序列 chart"
        note="前三级同色系用于单题多选项；后三级用于跨题对比。绝不叠用超过 6 色。"
      >
        <div className="grid grid-cols-6 gap-2">
          {CHART_STEPS.map((cls) => (
            <div key={cls} className={`h-12 rounded-[10px] ${cls}`} />
          ))}
        </div>
      </Section>

      <Section
        title="04 · 语义色"
        note="仅用于状态，不用于装饰。状态一律「圆点 + 文字」双通道，不靠颜色单独传达。"
      >
        <div className="space-y-2.5">
          {SEMANTIC.map((item) => (
            <div
              key={item.hex}
              className="border-ink-200 flex items-center gap-3 rounded-[10px] border bg-white px-4 py-3"
            >
              <span className={`size-2 shrink-0 rounded-full ${item.dot}`} />
              <span className="text-body-s text-ink-700 flex-1">{item.label}</span>
              <span className="text-caption text-ink-400 font-mono">{item.hex}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section
        title="05 · 排版"
        note="全站只用 400 / 500 / 600 三个字重；英文与数字优先命中 Inter。"
      >
        <Panel>
          <table className="text-body-s w-full">
            <tbody className="divide-ink-100 divide-y">
              {TYPE_SCALE.map((item) => (
                <tr key={item.name}>
                  <td className="text-ink-500 w-32 py-3">{item.name}</td>
                  <td className="text-ink-700 w-40 py-3 font-mono">{item.spec}</td>
                  <td className="text-ink-500 w-56 py-3">{item.use}</td>
                  <td className={`py-3 ${item.cls}`}>共回收 128 份答卷</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      </Section>

      <Section
        title="06 · 圆角与阴影"
        note="阴影只表达浮起层级，色值一律中性灰。按钮一律不加投影。"
      >
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <Panel>
            <h3 className="text-title-m text-ink-900 mb-4 font-semibold">圆角</h3>
            <div className="space-y-3">
              {RADII.map((item) => (
                <div key={item.spec} className="flex items-center gap-3">
                  <span className="text-caption text-ink-400 w-12 shrink-0 font-mono">
                    {item.spec}
                  </span>
                  <div className={`border-brand-200 bg-brand-100 h-8 flex-1 border ${item.cls}`} />
                  <span className="text-caption text-ink-500 w-20 shrink-0">{item.use}</span>
                </div>
              ))}
            </div>
          </Panel>

          <Panel>
            <h3 className="text-title-m text-ink-900 mb-4 font-semibold">阴影</h3>
            <div className="space-y-3.5">
              {SHADOWS.map((item) => (
                <div
                  key={item.cls}
                  className={`border-ink-200 rounded-[10px] border bg-white px-4 py-3 ${item.cls}`}
                >
                  <span className="text-label text-ink-600">{item.label}</span>
                </div>
              ))}
            </div>
          </Panel>
        </div>
      </Section>

      <Section
        title="07 · 组件样张（原始类名版）"
        note="只验证 token 组合效果；M0 下一轮把这些固化成 src/components/ui/ 里的组件。"
      >
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <Panel>
            <h3 className="text-title-m text-ink-900 mb-1 font-semibold">按钮</h3>
            <p className="text-label text-ink-400 mb-5">
              高度 36 紧凑 / 40 标准 / 44 移动端；触控目标不小于 44×44。
              <span className="text-ink-600">按钮不使用投影。</span>
            </p>
            <div className="space-y-5">
              <div>
                <div className="text-ink-400 mb-2.5 text-[11px] font-medium">
                  Primary — 一个页面只允许一个
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <button className="rounded-btn bg-brand-500 text-body-s hover:bg-brand-600 h-10 px-5 font-medium text-white transition-colors duration-150">
                    发布问卷
                  </button>
                  <button className="rounded-btn bg-brand-500 text-body-s h-10 cursor-not-allowed px-5 font-medium text-white opacity-45">
                    发布问卷
                  </button>
                </div>
              </div>
              <div>
                <div className="text-ink-400 mb-2.5 text-[11px] font-medium">Secondary / Ghost</div>
                <div className="flex flex-wrap items-center gap-3">
                  <button className="rounded-btn border-brand-200 bg-brand-50 text-body-s text-brand-600 hover:bg-brand-100 h-10 border px-5 font-medium transition-colors duration-150">
                    保存草稿
                  </button>
                  <button className="rounded-btn border-ink-200 text-body-s text-ink-700 hover:border-ink-300 hover:bg-ink-50 h-10 border bg-white px-5 font-medium transition-colors duration-150">
                    预览
                  </button>
                  <button className="rounded-btn text-body-s text-ink-600 hover:bg-ink-100 h-10 px-4 font-medium transition-colors duration-150">
                    取消
                  </button>
                  <button className="rounded-btn text-body-s h-10 border border-rose-200 bg-rose-50 px-5 font-medium text-rose-600 transition-colors duration-150 hover:bg-rose-100">
                    删除
                  </button>
                </div>
              </div>
              <div>
                <div className="text-ink-400 mb-2.5 text-[11px] font-medium">尺寸</div>
                <div className="flex flex-wrap items-end gap-3">
                  <button className="bg-brand-500 text-label h-8 rounded-lg px-3.5 font-medium text-white">
                    紧凑 32
                  </button>
                  <button className="rounded-btn bg-brand-500 text-body-s h-10 px-5 font-medium text-white">
                    标准 40
                  </button>
                  <button className="rounded-btn bg-brand-500 text-body h-11 px-6 font-medium text-white">
                    移动 44
                  </button>
                </div>
              </div>
            </div>
          </Panel>

          <Panel>
            <h3 className="text-title-m text-ink-900 mb-1 font-semibold">输入框</h3>
            <p className="text-label text-ink-400 mb-5">
              高度 40 桌面 / 48 移动；聚焦用 2px 品牌色描边 + 3px 淡色外环。
            </p>
            <div className="space-y-4">
              <div>
                <label className="text-ink-600 mb-2 block text-[12px] font-medium">问卷名称</label>
                <input
                  className="border-ink-200 text-body-s text-ink-800 placeholder:text-ink-400 focus:border-brand-500 focus:ring-brand-500/15 h-10 w-full rounded-lg border bg-white px-3.5 transition-all duration-150 outline-none focus:ring-[3px]"
                  placeholder="例如：2026 社团活动报名表"
                />
              </div>
              <div>
                <label className="text-ink-600 mb-2 block text-[12px] font-medium">回收上限</label>
                <div className="border-brand-500 ring-brand-500/15 flex h-10 w-full items-center justify-between rounded-lg border-2 bg-white px-3.5 ring-[3px]">
                  <span className="text-body-s text-ink-800">200</span>
                  <span className="text-ink-400 text-[12px]">份</span>
                </div>
                <p className="text-ink-400 mt-1.5 text-[11px]">达到上限后自动截止回收</p>
              </div>
              <div>
                <label className="text-ink-600 mb-2 block text-[12px] font-medium">开始时间</label>
                <div className="flex h-10 w-full items-center justify-between rounded-lg border border-rose-400 bg-rose-50/40 px-3.5">
                  <span className="text-body-s text-ink-800">2026-09-31 10:00</span>
                </div>
                <p className="mt-1.5 text-[11px] text-rose-500">日期不存在，请重新选择</p>
              </div>
              <div>
                <label className="text-ink-400 mb-2 block text-[12px] font-medium">
                  工作区 ID（不可修改）
                </label>
                <input
                  disabled
                  className="border-ink-200 bg-ink-100 text-body-s text-ink-400 h-10 w-full cursor-not-allowed rounded-lg border px-3.5"
                  value="ws_8f3a92c1"
                  readOnly
                />
              </div>
            </div>
          </Panel>

          <Panel>
            <h3 className="text-title-m text-ink-900 mb-4 font-semibold">状态标签</h3>
            <div className="flex flex-wrap gap-2.5">
              {STATUS_TAGS.map((tag) => (
                <span
                  key={tag.label}
                  className={`inline-flex h-6 items-center gap-1.5 rounded-full px-2.5 text-[11.5px] font-medium ${tag.cls}`}
                >
                  {tag.dot ? <span className={`size-1.5 rounded-full ${tag.dot}`} /> : null}
                  {tag.label}
                </span>
              ))}
            </div>
            <p className="text-label text-ink-400 mt-4">
              状态标签永远「圆点 + 文字」，不靠颜色单独传达状态 —— 色盲用户也能分辨。
            </p>
          </Panel>

          <Panel>
            <h3 className="text-title-m text-ink-900 mb-4 font-semibold">角色徽标</h3>
            <div className="flex flex-wrap gap-2.5">
              {ROLE_BADGES.map((badge) => (
                <span
                  key={badge.label}
                  className={`inline-flex h-6 items-center rounded-md px-2.5 text-[11.5px] font-medium ${badge.cls}`}
                >
                  {badge.label}
                </span>
              ))}
            </div>
            <p className="text-label text-ink-400 mt-4">
              权限层级用同一色系的深浅表达 —— 颜色越深权限越高。
            </p>
          </Panel>
        </div>

        <div className="mt-5">
          <Panel>
            <h3 className="text-title-m text-ink-900 mb-4 font-semibold">空状态</h3>
            <div className="rounded-card border-ink-200 max-w-md border border-dashed px-4 py-7 text-center">
              <div className="rounded-card bg-brand-50 mx-auto mb-3 flex size-11 items-center justify-center">
                <svg
                  viewBox="0 0 24 24"
                  className="text-brand-400 size-5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.8}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                  <path d="M14 2v6h6M9 13h6M9 17h4" />
                </svg>
              </div>
              <div className="text-body-s text-ink-800 mb-1 font-medium">还没有问卷</div>
              <p className="text-label text-ink-400">从空白创建，或挑一个模板开始</p>
            </div>
            <p className="text-label text-ink-400 mt-4">
              空状态必须包含「为什么空 + 下一步做什么」的明确出口。
              <span className="text-ink-600">上面这个按钮在 M0 刻意不画</span>
              —— 落点还不存在，等 M2 有「新建问卷」弹层时再补。
            </p>
          </Panel>
        </div>
      </Section>

      <Section
        title="08 · 表面层级"
        note="层级靠 白 → 极浅灰 → 白+阴影 三段推进，不靠深色底。品牌蓝只出现在按钮、链接、图表与选中态这类「点」上，不铺成「面」。"
      >
        <div className="space-y-2">
          {[
            { name: 'L1 侧边栏', cls: 'bg-white border-r border-ink-200', use: '全局导航' },
            { name: 'L1 顶栏', cls: 'bg-white border-b border-ink-200', use: '页面标题、主操作' },
            { name: 'L2 内容区', cls: 'bg-ink-50', use: '页面主体' },
            { name: 'L3 卡片', cls: 'bg-white shadow-card', use: '承载信息的独立单元' },
            { name: 'L4 浮层', cls: 'bg-white shadow-pop', use: '弹窗、下拉、抽屉' },
          ].map((layer) => (
            <div key={layer.name} className={`flex items-center gap-4 px-4 py-3 ${layer.cls}`}>
              <span className="text-caption text-ink-500 w-28 shrink-0 font-mono">
                {layer.name}
              </span>
              <span className="text-label text-ink-600">{layer.use}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section
        title="09 · 基础组件（src/components/ui）"
        note="上一节量 token，这一节只量组件。组件里出现的每个可点元素都要有落点 —— 打不开的都是没做完的，不是「占位」。"
      >
        <ComponentGallery />
      </Section>

      <footer className="border-ink-200 text-label text-ink-400 border-t pt-6 leading-6">
        轻问卷 · 设计系统与基础组件走查（仅开发环境） · 品牌主色 #31438C · Tailwind CSS v4 @theme
      </footer>
    </main>
  );
}
