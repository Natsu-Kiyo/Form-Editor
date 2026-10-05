import { cn } from '@/utils/cn';

const SIZE = {
  xs: 'size-6 rounded-md text-[11px]',
  sm: 'size-7 rounded-full text-[11.5px]',
  md: 'size-8 rounded-full text-[12px]',
  lg: 'size-14 rounded-full text-[18px]',
} as const;

const TONE = {
  /** 工作区头像：品牌实底 + 白字 */
  brand: 'bg-brand-500 text-white',
  /** 用户头像：品牌浅底 + 品牌深字 */
  soft: 'bg-brand-100 text-brand-600',
} as const;

export type AvatarProps = {
  /** 取首字作为头像内容。中文取第一个字，英文取首字母 */
  name: string;
  size?: keyof typeof SIZE;
  tone?: keyof typeof TONE;
  className?: string;
};

/**
 * 首字头像。
 *
 * 不做图片上传（本版本没有对象存储），所以头像就是名字的首字 ——
 * 好处是永远不会出现「加载失败的空框」，也不需要默认占位图。
 */
export function Avatar({ name, size = 'sm', tone = 'soft', className }: AvatarProps) {
  const initial = name.trim().charAt(0) || '?';

  return (
    <span
      aria-hidden="true"
      className={cn(
        'inline-flex shrink-0 items-center justify-center font-semibold',
        SIZE[size],
        TONE[tone],
        className,
      )}
    >
      {initial}
    </span>
  );
}
