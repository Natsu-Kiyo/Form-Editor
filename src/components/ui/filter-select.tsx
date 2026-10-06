'use client';

/**
 * 筛选行里的下拉。
 *
 * **原生 `<select>` 而不是 Radix 那套**：这里只需要「换一个 URL」，弹层、键盘导航、
 * 高亮项都由浏览器免费提供，而 Radix 版要写触发器 + 内容 + 选项三处。
 * 设计稿里这几个下拉本来也是浏览器原生的样子。
 *
 * 它被统计页与答卷明细页共用，所以放在 `components/ui`：两处的筛选行长得很像，
 * 各写一份迟早会一个高 8px、另一个高 9px。
 */
export function FilterSelect({
  label,
  value,
  options,
  onChange,
  placeholder,
  disabled = false,
}: {
  /** 无障碍名称（「渠道」「时间」…） */
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
  /** 未选中时显示在第一个选项位置上的文案，如「全部渠道」 */
  placeholder?: string;
  /** 提交中禁用（成员角色这类「改了就落库」的下拉要用它） */
  disabled?: boolean;
}) {
  return (
    <select
      aria-label={label}
      value={value}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value)}
      className="border-ink-200 text-ink-600 hover:border-ink-300 h-8 shrink-0 rounded-lg border bg-white px-2.5 text-[12.5px] transition-colors duration-150 outline-none disabled:opacity-45"
    >
      {placeholder ? <option value="">{placeholder}</option> : null}
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}
