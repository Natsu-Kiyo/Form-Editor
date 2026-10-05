import { clsx, type ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

/**
 * 自定义字号刻度，与 `src/app/globals.css` 的 `--text-*` token 一一对应。
 *
 * **必须显式告诉 tailwind-merge 这些是「字号」而不是「颜色」**：
 * 它默认不认识 `text-body` 这类自定义值，会把它归进 text-color 组，
 * 于是 `cn('text-white', 'text-body')` 里的 `text-white` 会被当成同类冲突而整个删掉。
 *
 * 曾经的症状：主按钮变成「深蓝底 + 深灰字」，几乎看不见 —— 因为三个尺寸
 * （`text-label` / `text-body-s` / `text-body`）都会在 variant 的文字色之后出现。
 * 放大到全站就是：**所有按钮都丢掉了自己的文字色**。
 */
const FONT_SIZE_SCALE = ['display', 'title-l', 'title-m', 'body', 'body-s', 'label', 'caption'];

const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      'font-size': [{ text: FONT_SIZE_SCALE }],
    },
  },
});

/**
 * 合并 Tailwind 类名：clsx 负责条件拼接，tailwind-merge 负责消解冲突
 * （例如同时传 `px-2` 与 `px-4` 时保留后者）。
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
