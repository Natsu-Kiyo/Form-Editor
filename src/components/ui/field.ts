/**
 * 表单控件共用的外观类名。
 *
 * 单独抽出来是因为 Input / Textarea / Select 的描边、聚焦环、错误态、禁用态
 * 在设计系统里是**同一套**规格（稿 §06 组件规范），分散在三个文件里必然漂移。
 *
 * 聚焦态刻意 `focus:outline-none` —— 不是「裸用 outline:none」，
 * 而是用设计系统规定的 2px 品牌色边框 + 3px 淡色外环去替代全局焦点环。
 */
export const fieldBase = [
  'w-full rounded-lg border bg-white px-3.5 text-body-s text-ink-800',
  'placeholder:text-ink-400',
  'transition-all duration-150 outline-none',
  'focus:border-brand-500 focus:ring-[3px] focus:ring-brand-500/15',
  'disabled:cursor-not-allowed disabled:border-ink-200 disabled:bg-ink-100 disabled:text-ink-400',
].join(' ');

export const fieldBorder = 'border-ink-200';

/** 校验失败：描边转玫红 + 淡玫红底，并配一行说明原因的文案（不要只变红） */
export const fieldErrorBorder =
  'border-rose-400 bg-rose-50/40 focus:border-rose-500 focus:ring-rose-500/15';

/** 桌面 40 / 移动 48 —— 由调用方按场景选，默认桌面高度 */
export const fieldHeight = {
  md: 'h-10',
  lg: 'h-12',
} as const;
