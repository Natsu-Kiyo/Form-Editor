'use client';

import { useEffect, useState } from 'react';

import { QuestionnaireTopbar } from '@/components/layout/questionnaire-topbar';
import { CheckIcon, DownloadIcon, LinkIcon, ShareIcon } from '@/components/icons/ui-icons';
import { Button } from '@/components/ui/button';
import {
  COLLECTION_STATE_LABEL,
  SHARE_LINK_HINT,
  type QuestionnaireStatus,
} from '@/config/constants';
import { useIsDesktop } from '@/hooks/use-is-desktop';
import { cn } from '@/utils/cn';

import type { SharePageData } from '../api/share';
import { ChannelsCard } from './channels-card';
import { CollectionControls } from './collection-controls';
import { CopyButton } from './copy-button';

/**
 * 分享与分发（W05 桌面 / P06 移动）。
 *
 * 两端的**内容一致、排布不同**：桌面把二维码放在右侧卡片里与链接并排；
 * 移动端按 P06 把二维码放到最大（线下扫码成功率比页面美观重要），
 * 底部「渠道链接」是**入口而不是内容**（渠道会随用户新建而增长）。
 */
export function SharePanel({ data, canEdit }: { data: SharePageData; canEdit: boolean }) {
  const isDesktop = useIsDesktop();

  const qr = (
    <div className="border-ink-200 rounded-xl border bg-white p-3">
      {/* 用普通的 img 指向二维码路由：这样一来「页面上看到的」和「下载下来的」
          必然是同一张图（同一个 URL、同一份内容） */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={data.qrUrl}
        alt={`「${data.title}」的作答二维码`}
        width={isDesktop ? 152 : 178}
        height={isDesktop ? 152 : 178}
      />
    </div>
  );

  return (
    <>
      <QuestionnaireTopbar
        titleSlot={
          <h1 className="text-ink-900 truncate text-[15px] font-semibold">{data.title}</h1>
        }
      >
        <StatusPill status={data.status} />
        {canEdit && isDesktop ? (
          <CollectionControls questionnaireId={data.id} status={data.status} variant="topbar" />
        ) : null}
      </QuestionnaireTopbar>

      <main className="flex-1 overflow-y-auto p-6 sm:p-7">
        {isDesktop ? (
          <div className="mx-auto max-w-[1020px] space-y-5">
            <LinkCard data={data} qr={qr} />
            <ProgressCard data={data} />
            <ChannelsCard
              questionnaireId={data.id}
              channels={data.channels}
              untaggedCount={data.untaggedCount}
              responseCount={data.responseCount}
            />
          </div>
        ) : (
          <div className="mx-auto flex max-w-[420px] flex-col items-center gap-4">
            <div className="flex flex-col items-center">
              {qr}
              <p className="text-ink-500 mt-3 text-center text-[12.5px]">
                扫码或长按识别二维码填写
              </p>
            </div>

            <div className="flex w-full items-center gap-2">
              <LinkBox label={data.linkLabel} />
              <CopyButton value={data.linkUrl} label="复制" variant="primary" />
            </div>

            <div className="grid w-full grid-cols-3 gap-2.5">
              <MobileAction
                icon={<LinkIcon className="size-[18px]" />}
                label="复制链接"
                value={data.linkUrl}
              />
              <MobileAction
                icon={<DownloadIcon className="size-[18px]" />}
                label="存二维码"
                href={data.qrDownloadUrl}
              />
              <MobileAction
                icon={<ShareIcon className="size-[18px]" />}
                label="系统分享"
                share={{ title: data.title, url: data.linkUrl }}
              />
            </div>

            {canEdit ? (
              <div className="w-full">
                <CollectionControls questionnaireId={data.id} status={data.status} variant="card" />
              </div>
            ) : null}

            <div className="w-full">
              <ChannelsCard
                questionnaireId={data.id}
                channels={data.channels}
                untaggedCount={data.untaggedCount}
                responseCount={data.responseCount}
              />
            </div>

            <div className="w-full">
              <ProgressCard data={data} compact />
            </div>
          </div>
        )}
      </main>
    </>
  );
}

function LinkCard({ data, qr }: { data: SharePageData; qr: React.ReactNode }) {
  return (
    <div className="border-ink-200 rounded-xl border bg-white p-6">
      <div className="flex flex-col gap-8 lg:flex-row">
        <div className="min-w-0 flex-1">
          <h2 className="text-ink-900 mb-1 text-[15px] font-semibold">分享链接</h2>
          <p className="text-ink-500 mb-5 text-[12.5px]">{SHARE_LINK_HINT[data.identityMode]}</p>

          <div className="mb-4 flex items-center gap-2">
            <LinkBox label={data.linkLabel} />
            <CopyButton value={data.linkUrl} label="复制链接" variant="primary" />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" asChild>
              <a href={data.qrDownloadUrl} download>
                <DownloadIcon className="size-3.5" />
                下载二维码
              </a>
            </Button>
          </div>

          <div className="border-ink-100 mt-5 border-t pt-5">
            <div className="text-ink-500 mb-3 text-[11.5px] font-medium">嵌入到网页</div>
            <div className="bg-ink-900 relative rounded-[10px] p-3.5">
              <code className="block pr-14 font-mono text-[11.5px] leading-5 break-all text-white/80">
                {data.embedCode}
              </code>
              <div className="absolute top-2.5 right-2.5">
                <CopyButton
                  value={data.embedCode}
                  label="复制"
                  size="sm"
                  variant="ghost"
                  className="text-white/80 hover:bg-white/20 hover:text-white"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col items-center lg:w-[200px] lg:shrink-0">
          {qr}
          <p className="text-ink-400 mt-3 text-center text-[11.5px] leading-5">
            扫码直接在手机上填写
            <br />
            桌面端可下载后印刷
          </p>
        </div>
      </div>
    </div>
  );
}

function ProgressCard({ data, compact = false }: { data: SharePageData; compact?: boolean }) {
  const ratio =
    data.responseLimit && data.responseLimit > 0
      ? Math.min(1, data.responseCount / data.responseLimit)
      : null;

  return (
    <div className={cn('border-ink-200 rounded-xl border bg-white', compact ? 'p-4' : 'p-6')}>
      <div className="mb-5 flex items-end justify-between gap-4">
        <div>
          <h2 className="text-ink-900 mb-1 text-[15px] font-semibold">回收进度</h2>
          <p className="text-ink-500 text-[12.5px]">
            {data.status === 'CLOSED'
              ? // 已截止是**不可逆**的终点：这里必须给出下一步，
                // 否则用户对着一个失效的链接不知道还能做什么
                '回收已截止，链接已失效。要再来一轮请把它复制为新问卷。'
              : data.daysLeft !== null
                ? data.daysLeft > 0
                  ? `距结束时间还剩 ${data.daysLeft} 天`
                  : '已到结束时间'
                : '长期开放，直到手动截止'}
          </p>
        </div>
        <div className="text-ink-900 font-mono text-[26px] leading-8 font-semibold">
          {data.responseCount}
          {data.responseLimit ? (
            <span className="text-ink-400 text-[15px] font-normal"> / {data.responseLimit}</span>
          ) : null}
        </div>
      </div>

      <div className="bg-ink-100 h-2.5 overflow-hidden rounded-full">
        <div
          className="bg-brand-500 h-full rounded-full"
          style={{ width: `${Math.round((ratio ?? 0) * 100)}%` }}
        />
      </div>

      <div className="text-ink-500 mt-4 flex items-center gap-6 text-[12px]">
        <span>
          今日新增 <b className="text-ink-800 font-mono">{data.todayCount}</b>
        </span>
        <span>
          昨日 <b className="text-ink-800 font-mono">{data.yesterdayCount}</b>
        </span>
        <span>
          日均 <b className="text-ink-800 font-mono">{data.dailyAverage}</b>
        </span>
      </div>
    </div>
  );
}

function LinkBox({ label }: { label: string }) {
  return (
    <div className="bg-ink-50 border-ink-200 flex h-11 min-w-0 flex-1 items-center rounded-[10px] border px-3.5">
      <span className="text-ink-700 truncate font-mono text-[13px]">{label}</span>
    </div>
  );
}

function MobileAction({
  icon,
  label,
  value,
  href,
  share,
}: {
  icon: React.ReactNode;
  label: string;
  value?: string;
  href?: string;
  share?: { title: string; url: string };
}) {
  const className =
    'border-ink-200 flex h-[58px] flex-col items-center justify-center gap-1.5 rounded-[14px] border bg-white text-[11px] text-ink-600';

  /*
   * 回退到剪贴板时的回执（R92 · F3）。
   *
   * 「系统分享」在桌面端**几乎总是**走回退路径（`navigator.share` 只有移动端与安全上下文有），
   * 而原来那条回退是静默的：复制成功没提示、失败也没提示 —— 与同目录的 `CopyButton`
   * （「已复制 / 复制失败」+ 手动复制的提示）两套口径。这里对齐过来。
   */
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle');

  // 与 CopyButton 同一条规矩：定时器在卸载时清掉，别 setState 打在已卸载的组件上
  useEffect(() => {
    if (copyState === 'idle') return;

    const timer = setTimeout(() => setCopyState('idle'), copyState === 'copied' ? 2000 : 3000);
    return () => clearTimeout(timer);
  }, [copyState]);

  /**
   * 复制链接（两条回退路径共用）。
   *
   * 刻意**不用**可选链：`navigator.clipboard` 在不安全上下文里是 `undefined`，
   * `navigator.clipboard?.writeText(...)` 会静默什么都不做；
   * 直接调用则会在 try 里抛 TypeError，正好落进 catch 变成「复制失败」——
   * 用户至少知道要手动复制，而不是点了没反应。
   */
  const copyLink = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopyState('copied');
    } catch {
      setCopyState('failed');
    }
  };

  if (href) {
    return (
      <a href={href} download className={className}>
        {icon}
        {label}
      </a>
    );
  }

  if (share) {
    return (
      <button
        type="button"
        className={className}
        title={copyState === 'failed' ? '浏览器拒绝了剪贴板访问，请手动选中复制' : undefined}
        onClick={() => {
          /*
           * `navigator.share` 只在移动端与安全上下文可用；不可用时退回复制链接，
           * 而不是给一个点了没反应的按钮（也不做「检测到不支持就不渲染」——
           * 服务端渲染时无从判断，客户端再判断会导致布局跳动）。
           *
           * 注意**不能**写成 `navigator.share?.().catch(...)`：可选链会把整条链短路
           *（`navigator.share` 是 undefined 时 `.catch` 根本不会被求值），
           * 结果恰好与意图相反 —— 不支持的浏览器上点了什么都不发生（R91 · S2 修）。
           */
          if (typeof navigator.share === 'function') {
            navigator.share({ title: share.title, url: share.url }).catch((error: unknown) => {
              // 用户在原生分享面板点「取消」会抛 AbortError —— 那不是失败，
              // 别顺手把链接塞进剪贴板（用户没有要求复制）
              if ((error as DOMException | undefined)?.name === 'AbortError') return;

              // 分享本身失败了（而不是取消）：退回复制，并且**说出来**
              void copyLink(share.url);
            });

            return;
          }

          void copyLink(share.url);
        }}
      >
        {copyState === 'copied' ? <CheckIcon className="size-[18px]" /> : icon}
        {copyState === 'copied' ? '已复制' : copyState === 'failed' ? '复制失败' : label}
      </button>
    );
  }

  return (
    <CopyButton
      value={value ?? ''}
      label={label}
      variant="ghost"
      className="border-ink-200 text-ink-600 hover:bg-ink-50 h-[58px] flex-col gap-1.5 rounded-[14px] border bg-white text-[11px]"
    />
  );
}

function StatusPill({ status }: { status: QuestionnaireStatus }) {
  const collecting = status === 'PUBLISHED';
  const paused = status === 'PAUSED';

  return (
    <span
      className={cn(
        'inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3 text-[12px] font-medium',
        collecting
          ? 'bg-emerald-50 text-emerald-700'
          : paused
            ? 'bg-amber-50 text-amber-700'
            : 'bg-ink-100 text-ink-600',
      )}
    >
      <span
        className={cn(
          'size-1.5 rounded-full',
          collecting ? 'bg-emerald-500' : paused ? 'bg-amber-500' : 'bg-ink-400',
        )}
        aria-hidden="true"
      />
      {COLLECTION_STATE_LABEL[status as 'PUBLISHED'] ?? status}
    </span>
  );
}
