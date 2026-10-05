'use client';

import Link from 'next/link';
import { useTransition } from 'react';

import { BellIcon } from '@/components/icons/ui-icons';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/utils/cn';

import {
  markAllNotificationsReadAction,
  markNotificationReadAction,
} from '../actions/notifications';
import type { NotificationItem } from '../api/notifications';

export type NotificationPanelProps = {
  notifications: NotificationItem[];
  unreadCount: number;
};

/**
 * 通知面板（入口：顶栏铃铛）。
 *
 * 未读与已读**不只靠颜色**：未读有品牌色圆点 + 更深的文字色，已读两项都没有，
 * 而且已读项渲染成不可点的 div —— 点了没有任何效果的按钮本身就是假入口。
 */
export function NotificationPanel({ notifications, unreadCount }: NotificationPanelProps) {
  const [pending, startTransition] = useTransition();

  const markRead = (id: string) => {
    startTransition(async () => {
      await markNotificationReadAction(id);
    });
  };

  const itemBody = (item: NotificationItem) => (
    <>
      <span
        className={cn(
          'mt-2 size-1.5 shrink-0 rounded-full',
          item.read ? 'bg-transparent' : 'bg-brand-500',
        )}
        aria-hidden="true"
      />
      <span className="min-w-0 flex-1">
        <span
          className={cn(
            'block text-[12.5px] leading-5',
            item.read ? 'text-ink-600' : 'text-ink-800',
          )}
        >
          {item.title}
        </span>
        {item.body ? (
          <span className="text-ink-500 mt-0.5 block text-[11.5px] leading-5">{item.body}</span>
        ) : null}
        <span className="text-ink-400 mt-1 block text-[11px]">{item.createdAtLabel}</span>
      </span>
    </>
  );

  const rowClassName = 'flex w-full gap-3 px-5 py-3.5 text-left';

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={unreadCount > 0 ? `通知，${unreadCount} 条未读` : '通知'}
          className="text-ink-500 hover:bg-ink-100 relative flex size-9 items-center justify-center rounded-[10px] transition-colors duration-150"
        >
          <BellIcon className="size-[18px]" />
          {unreadCount > 0 ? (
            <span className="absolute top-2 right-2 size-1.5 rounded-full bg-rose-500 ring-2 ring-white" />
          ) : null}
        </button>
      </PopoverTrigger>

      <PopoverContent align="end" className="w-[360px] p-0">
        <div className="border-ink-100 flex items-center justify-between border-b px-5 py-3.5">
          <span className="text-ink-900 text-[13.5px] font-semibold">通知</span>
          {unreadCount > 0 ? (
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  await markAllNotificationsReadAction();
                })
              }
              className="text-brand-500 hover:text-brand-600 text-[11.5px] font-medium transition-colors duration-150"
            >
              全部已读
            </button>
          ) : null}
        </div>

        {notifications.length === 0 ? (
          <p className="text-ink-400 px-5 py-8 text-center text-[12px]">
            暂时没有通知。问卷回收达标、成员加入时会出现在这里。
          </p>
        ) : (
          <div className="divide-ink-100 max-h-[380px] divide-y overflow-y-auto">
            {notifications.map((item) =>
              item.read ? (
                <div key={item.id} className={cn(rowClassName, 'hover:bg-ink-50/60')}>
                  {itemBody(item)}
                </div>
              ) : item.linkUrl ? (
                <Link
                  key={item.id}
                  href={item.linkUrl}
                  onClick={() => markRead(item.id)}
                  className={cn(rowClassName, 'hover:bg-ink-50/60 transition-colors duration-150')}
                >
                  {itemBody(item)}
                </Link>
              ) : (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => markRead(item.id)}
                  className={cn(rowClassName, 'hover:bg-ink-50/60 transition-colors duration-150')}
                >
                  {itemBody(item)}
                </button>
              ),
            )}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
