/** 全站展示用的固定时区。服务器是 UTC，而访客与所有者都在国内 —— 一律按东八区显示 */
const DISPLAY_TIME_ZONE = 'Asia/Shanghai';

const timeFormatter = new Intl.DateTimeFormat('zh-CN', {
  timeZone: DISPLAY_TIME_ZONE,
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

// 刻意用 en-CA 取「10-03」这种连字符格式：zh-CN 会给成「10/03」，
// 而设计稿里的日期一律用连字符，混用会让同一页出现两种日期写法
const dateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: DISPLAY_TIME_ZONE,
  month: '2-digit',
  day: '2-digit',
});

/** 某个时刻在东八区属于哪一天，形如 `2026-10-05` */
function dayKey(date: Date) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: DISPLAY_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

/**
 * 通知时间的展示文案：今天 `13:38`、昨天 `昨天 18:20`、更早 `10-03`。
 *
 * **刻意在服务端调用**（`api/notifications.ts` 里格式化好再传给客户端组件）：
 * 若放到客户端格式化，服务端渲染的是 UTC、浏览器渲染的是本地时区，
 * 两边字符串不一致会触发 hydration 报错。
 */
export function formatNotificationTime(createdAt: Date, now = new Date()): string {
  const createdKey = dayKey(createdAt);
  const nowKey = dayKey(now);

  if (createdKey === nowKey) {
    return timeFormatter.format(createdAt);
  }

  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  if (createdKey === dayKey(yesterday)) {
    return `昨天 ${timeFormatter.format(createdAt)}`;
  }

  return dateFormatter.format(createdAt);
}

/** 形如 `2026-08-12`。账号与安全里的「上次修改」用它 */
export function formatDisplayDate(date: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: DISPLAY_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

const dateTimePartsFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: DISPLAY_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  // h23 而不是 hour12:false：后者在某些 ICU 版本下会把午夜给成 24
  hourCycle: 'h23',
});

function zoneOffsetMinutes(date: Date) {
  const parts = dateTimePartsFormatter.formatToParts(date);
  const pick = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value ?? 0);

  const asIfUtc = Date.UTC(
    pick('year'),
    pick('month') - 1,
    pick('day'),
    pick('hour'),
    pick('minute'),
    pick('second'),
  );

  return (asIfUtc - date.getTime()) / 60_000;
}

/**
 * 转成 `<input type="datetime-local">` 需要的值（`2026-10-04T10:00`）。
 *
 * 一律按**展示时区**换算，而不是服务器的本地时区：服务端跑在 UTC，
 * 按它换算会让同一条时间在不同机器上显示成不同的小时。
 */
export function formatDateTimeLocal(date: Date): string {
  const parts = dateTimePartsFormatter.formatToParts(date);
  const pick = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? '00';

  return `${pick('year')}-${pick('month')}-${pick('day')}T${pick('hour')}:${pick('minute')}`;
}

/**
 * 解析 `<input type="datetime-local">` 的值，与 `formatDateTimeLocal` 成对。
 *
 * 做法是「先当 UTC 猜一个，再按该时刻在展示时区的偏移量校正」。
 * 展示时区（Asia/Shanghai）没有夏令时，所以一次校正就够；
 * 若将来换成有夏令时的时区，这里需要再迭代一次。
 */
export function parseDateTimeLocal(value: string): Date | null {
  // 同时接受 `2026-10-04T10:00`（原生输入框的值）与 `2026-10-04 10:00`（人写的）：
  // 界面上给用户看的是后者，而页面里流转的是前者，两处都要认
  const match = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;

  const [, year, month, day, hour, minute] = match.map(Number) as unknown as number[];
  const guess = Date.UTC(year, month - 1, day, hour, minute);

  return new Date(guess - zoneOffsetMinutes(new Date(guess)) * 60_000);
}

/** 距某个时刻还有几天（不足一天按 0 算，已过去返回负数）。分享页的「还剩 16 天」用它 */
export function daysUntil(target: Date, now = new Date()): number {
  return Math.ceil((target.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
}

/**
 * 展示时区里「今天 00:00」对应的时刻。
 *
 * 统计「今日新增 / 昨日」必须用它，不能用服务器本地时区：服务器跑在 UTC，
 * 用它切天会让北京时间上午 8 点之前提交的答卷被算进「昨天」。
 */
export function displayDayStart(date = new Date()): Date {
  const dayMs = 24 * 60 * 60 * 1000;
  const offsetMinutes = zoneOffsetMinutes(date);
  const shifted = date.getTime() + offsetMinutes * 60 * 1000;

  return new Date(Math.floor(shifted / dayMs) * dayMs - offsetMinutes * 60 * 1000);
}
