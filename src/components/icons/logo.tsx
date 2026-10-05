/**
 * 品牌标记。原样取自设计系统稿（01-设计系统与页面映射.html）头部。
 * 这是全站唯一 logo 出处，不要在页面里重复内联这段 SVG。
 *
 * 描边用 `currentColor` —— 颜色由调用方通过文字色决定（深蓝底上给 `text-white`，
 * 白底上给 `text-brand-500`），这样不必为了换配色新增 props。
 */
export function Logo({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      style={style}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M9 11l3 3L22 4" />
      <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
    </svg>
  );
}
