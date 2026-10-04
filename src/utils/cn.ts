import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * 合并 Tailwind 类名：clsx 负责条件拼接，tailwind-merge 负责消解冲突
 * （例如同时传 `px-2` 与 `px-4` 时保留后者）。
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
