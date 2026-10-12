import { cn } from '@/utils/cn';

/**
 * 字数计数器（R97）。
 *
 * 为什么要有它：输入框按 schema 的上限 `maxLength` 截停，是为了避免「敲得进去、存不上」——
 * 但**静默截停**同样在骗人：用户以为自己写完了，其实最后几个字根本没进去。
 * 所以「快满了」这件事必须在界面上可见：
 *
 * - **平时不占地方**：不到上限 80% 直接不渲染 —— 每个输入框旁边都挂一个 `0/100` 是噪音，
 *   看久了就没人再看它，那才是真正会骗人的界面；
 * - 过 80% 变琥珀色（提醒「快到了」），到顶变玫瑰色并**明说**「已达上限」；
 * - 数字用 `tabular-nums`：跳动时宽度稳定，不会把输入框挤得一抖一抖。
 *
 * 数的是**原始长度**（含空格），与浏览器 `maxLength` 的判据完全一致 ——
 * 也就是说「计数器到顶」等价于「再敲也进不去」。
 * schema 那一侧是 trim 之后再比，只会更宽松：不会出现「计数器说没到、保存却被拒」。
 */
export function CharCount({
  value,
  max,
  className,
}: {
  value: string;
  max: number;
  className?: string;
}) {
  const used = value.length;

  // 阈值以下不渲染：见上面「平时不占地方」那一段
  if (used < max * 0.8) return null;

  const atCap = used >= max;

  return (
    <span
      data-at-cap={atCap || undefined}
      // 覆盖型用法（顶栏标题）下它压在输入框上，不能吃掉点击
      className={cn(
        'pointer-events-none font-mono text-[11px] tabular-nums',
        atCap ? 'text-rose-600' : 'text-amber-600',
        className,
      )}
      title={atCap ? `已达 ${max} 字上限，后面输入的内容不会进去` : `最多 ${max} 字`}
    >
      {used}/{max}
      {atCap ? ' 已达上限' : null}
    </span>
  );
}
