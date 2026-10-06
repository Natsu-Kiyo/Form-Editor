'use client';

import { useState } from 'react';

import { Sheet, SheetContent } from '@/components/ui/sheet';
import { useIsDesktop } from '@/hooks/use-is-desktop';

import type { ShareChannel } from '../api/share';
import { CopyButton } from './copy-button';
import { NewChannelForm } from './new-channel-form';

/**
 * 渠道链接。
 *
 * 桌面是表格（设计稿 W05），窄屏是「入口 + 弹层」（P06-a/b）——
 * 这里**真不渲染**表格：`useIsDesktop` 而不是 CSS `hidden`，
 * 否则窄屏下那张表还在 DOM 里、还能被 Tab 聚焦，等于没做适配。
 */
export function ChannelsCard({
  questionnaireId,
  channels,
  untaggedCount,
  responseCount,
}: {
  questionnaireId: string;
  channels: ShareChannel[];
  untaggedCount: number;
  responseCount: number;
}) {
  const isDesktop = useIsDesktop();
  const [open, setOpen] = useState(false);

  const createButton = <NewChannelForm questionnaireId={questionnaireId} />;

  if (!isDesktop) {
    return (
      <>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="border-ink-200 flex w-full items-center gap-3 rounded-[14px] border bg-white px-4 py-3.5 text-left"
        >
          <span className="min-w-0 flex-1">
            <span className="text-ink-900 block text-[13px] font-medium">渠道链接</span>
            <span className="text-ink-400 mt-0.5 block text-[11px]">
              {channels.length} 个渠道 · 已回收 {responseCount} 份
            </span>
          </span>
          <span className="text-ink-300 shrink-0">›</span>
        </button>

        {/*
          底部 Sheet 而不是居中弹层（设计稿 P06-b）：渠道数量会随用户新建而增长，
          列表长了就自己内部滚动，且限高 70vh —— 375px 下把二维码挤下去是不行的。
        */}
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetContent
            title="渠道链接"
            description="为不同分发渠道生成专属链接，统计各渠道回收量。点任意一行即复制该渠道链接。"
            className="max-h-[70vh]"
          >
            <div className="border-ink-200 -mx-5 overflow-hidden border-t">
              <ChannelList channels={channels} untaggedCount={untaggedCount} />
            </div>
            <div className="pt-4">{createButton}</div>
          </SheetContent>
        </Sheet>
      </>
    );
  }

  return (
    <div className="border-ink-200 overflow-hidden rounded-xl border bg-white">
      <div className="flex items-start justify-between gap-4 px-6 py-5">
        <div>
          <h2 className="text-ink-900 mb-1 text-[15px] font-semibold">渠道链接</h2>
          <p className="text-ink-500 text-[12.5px]">
            为不同分发渠道生成专属链接，统计各渠道回收量。
          </p>
        </div>
        {createButton}
      </div>

      <ChannelList channels={channels} untaggedCount={untaggedCount} />
    </div>
  );
}

function ChannelList({
  channels,
  untaggedCount,
}: {
  channels: ShareChannel[];
  untaggedCount: number;
}) {
  if (channels.length === 0) {
    return (
      <p className="text-ink-400 border-ink-100 border-t px-6 py-6 text-[12.5px]">
        还没有渠道。新建一个渠道，就能在链接里带上
        <code className="text-ink-500 font-mono">?src=</code>
        参数，从而知道答卷是从哪里来的。
      </p>
    );
  }

  return (
    <table className="w-full text-[13px]">
      <thead className="bg-ink-50 text-ink-600">
        <tr>
          <th className="px-6 py-2.5 text-left font-medium">渠道名称</th>
          <th className="px-6 py-2.5 text-left font-medium">链接参数</th>
          <th className="px-6 py-2.5 text-right font-medium">回收份数</th>
          <th className="w-32 px-6 py-2.5 text-right font-medium">操作</th>
        </tr>
      </thead>
      <tbody className="divide-ink-100 divide-y">
        {channels.map((channel) => (
          <tr key={channel.id} className="hover:bg-ink-50/60">
            <td className="px-6 py-3.5">
              <span className="text-ink-800 font-medium">{channel.name}</span>
            </td>
            <td className="text-ink-500 px-6 py-3.5 font-mono text-[12px]">{channel.linkLabel}</td>
            <td className="text-ink-800 px-6 py-3.5 text-right font-mono">
              {channel.responseCount}
            </td>
            <td className="px-6 py-3.5 text-right">
              <CopyButton size="sm" variant="ghost" label="复制" value={channel.linkUrl} />
            </td>
          </tr>
        ))}
        <tr>
          <td className="text-ink-400 px-6 py-3.5 text-[12px]" colSpan={2}>
            无渠道标记
          </td>
          <td className="text-ink-400 px-6 py-3.5 text-right font-mono">{untaggedCount}</td>
          <td className="px-6 py-3.5" />
        </tr>
      </tbody>
    </table>
  );
}
