import type { QuestionType } from '@/config/constants';

/**
 * 题型图标（8 个）。
 *
 * 形状与线宽逐字取自设计稿——**移动端题型弹层与 Web 左栏共用同一套**，
 * 所以这里的图标一旦改动，两端会同时变，这是刻意的：icon 就是两端的对齐锚点。
 */
type IconProps = React.ComponentProps<'svg'>;

function TypeIcon({ children, ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  );
}

function SingleChoiceIcon(props: IconProps) {
  return (
    <TypeIcon {...props}>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="3.2" fill="currentColor" stroke="none" />
    </TypeIcon>
  );
}

function MultiChoiceIcon(props: IconProps) {
  return (
    <TypeIcon {...props}>
      <rect x="3" y="3" width="18" height="18" rx="3" />
      <path d="M7.5 12l2.5 2.5L16.5 9" />
    </TypeIcon>
  );
}

function ShortTextIcon(props: IconProps) {
  return (
    <TypeIcon {...props}>
      <path d="M4 7h16M4 12h10M4 17h13" />
    </TypeIcon>
  );
}

function LongTextIcon(props: IconProps) {
  return (
    <TypeIcon {...props}>
      <rect x="4" y="4" width="16" height="16" rx="2.5" />
      <path d="M8 9h8M8 13h8M8 17h5" />
    </TypeIcon>
  );
}

function RatingIcon(props: IconProps) {
  return (
    <TypeIcon {...props}>
      <path d="M12 3l2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.3 6.4 20.2l1.1-6.2L3 9.6l6.2-.9z" />
    </TypeIcon>
  );
}

function DropdownIcon(props: IconProps) {
  return (
    <TypeIcon {...props}>
      <rect x="3" y="3" width="18" height="18" rx="3" />
      <path d="M6 9.5l6 6 6-6" />
    </TypeIcon>
  );
}

function DateIcon(props: IconProps) {
  return (
    <TypeIcon {...props}>
      <rect x="3" y="5" width="18" height="16" rx="2.5" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </TypeIcon>
  );
}

function MatrixIcon(props: IconProps) {
  return (
    <TypeIcon {...props}>
      <rect x="3" y="3" width="18" height="18" rx="3" />
      <path d="M9 3v18M15 3v18M3 9h18M3 15h18" />
    </TypeIcon>
  );
}

/** 题型 → 图标。Web 左栏与移动端题型弹层都从这里取，保证两端图标一致 */
export const QUESTION_TYPE_ICON: Record<QuestionType, (props: IconProps) => React.ReactElement> = {
  SINGLE: SingleChoiceIcon,
  MULTI: MultiChoiceIcon,
  SHORT_TEXT: ShortTextIcon,
  LONG_TEXT: LongTextIcon,
  RATING: RatingIcon,
  DROPDOWN: DropdownIcon,
  DATE: DateIcon,
  MATRIX: MatrixIcon,
};
