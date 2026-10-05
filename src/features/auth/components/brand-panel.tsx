import { Logo } from '@/components/icons/logo';

/**
 * W01 左侧品牌面板：**整块单一深蓝 + 白字**。
 *
 * 这是全站仅有的两处深色底之一（另一处是产品首页主视觉）。
 * 设计系统的规则是「品牌蓝只出现在按钮、链接这类『点』上，不铺成『面』」——
 * 这里之所以能例外，是因为它整块只有一种蓝、配白字，不存在同色系深浅相叠。
 */
const STATS = [
  { value: '8', label: '内置模板' },
  { value: '8', label: '题型支持' },
  { value: '4', label: '角色权限' },
];

export function BrandPanel() {
  return (
    <aside className="bg-brand-800 relative hidden flex-col justify-between overflow-hidden p-10 lg:flex lg:w-[46%]">
      {/* 装饰层：两团径向渐变 + 两个描边圆环，全部 pointer-events-none 且不承载信息 */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-20"
        style={{
          backgroundImage:
            'radial-gradient(circle at 18% 22%, #6C7DC1 0, transparent 42%), radial-gradient(circle at 82% 72%, #31438C 0, transparent 48%)',
        }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-24 -bottom-24 size-80 rounded-full border border-white/10"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-10 -bottom-40 size-80 rounded-full border border-white/10"
      />

      <div className="relative flex items-center gap-2.5">
        <div className="text-brand-500 flex size-8 items-center justify-center rounded-[9px] bg-white">
          <Logo className="size-[18px]" />
        </div>
        <span className="text-[16px] font-semibold tracking-tight text-white">轻问卷</span>
      </div>

      <div className="relative">
        <h1 className="mb-4 text-[34px] leading-[44px] font-semibold tracking-[-0.02em] text-white">
          让团队协作
          <br />
          完成一份问卷
        </h1>
        <p className="max-w-[320px] text-[14px] leading-6 text-white/55">
          从创建、发放到数据统计，每个人只看到自己该看到的，每一步都留痕。
        </p>

        <div className="mt-8 flex items-center gap-8 border-t border-white/10 pt-8">
          {STATS.map((stat) => (
            <div key={stat.label}>
              <div className="tnum font-mono text-[22px] font-semibold text-white">
                {stat.value}
              </div>
              <div className="mt-0.5 text-[11px] text-white/45">{stat.label}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="relative text-[11px] text-white/35">© 2026 轻问卷 · 个人作品项目</div>
    </aside>
  );
}

/** 窄屏（无品牌面板）时的紧凑头部 */
export function BrandPanelCompact() {
  return (
    <div className="mb-8 flex items-center gap-2.5 lg:hidden">
      <div className="bg-brand-500 flex size-8 items-center justify-center rounded-[9px]">
        <Logo className="size-[18px]" />
      </div>
      <span className="text-ink-900 text-[16px] font-semibold tracking-tight">轻问卷</span>
    </div>
  );
}
