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
