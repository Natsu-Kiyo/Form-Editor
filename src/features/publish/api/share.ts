import 'server-only';

import type { CloseReason, IdentityMode, QuestionnaireStatus } from '@/config/constants';
import { prisma } from '@/lib/db';
import { daysUntil, displayDayStart, formatDateTimeLocal } from '@/utils/format';

import { channelUrl, embedCode, qrImageUrl, questionnaireUrl, shortLinkLabel } from '../lib/links';

export type ShareChannel = {
  id: string;
  name: string;
  srcToken: string;
  /** 展示值：`?src=wechat`（设计稿渠道表第二列） */
  linkLabel: string;
  linkUrl: string;
  responseCount: number;
};

/**
 * 分享页需要的全部数据。
 *
 * **链接在这里就拼好成字符串**，不让客户端组件自己拼：拼链接要用
 * `NEXT_PUBLIC_APP_URL`，而它在 `config/env.ts` 里是**带 DATABASE_URL 一起校验的**
 * —— 客户端组件一 import 就会去校验服务端变量而报错。服务端拼好再传，也顺带
 * 保证「二维码内容 / 复制的链接 / 嵌入代码」三处永远是同一个地址。
 */
export type SharePageData = {
  id: string;
  title: string;
  status: QuestionnaireStatus;
  slug: string;
  linkUrl: string;
  linkLabel: string;
  embedCode: string;
  qrUrl: string;
  qrDownloadUrl: string;
  closeReason: CloseReason | null;
  identityMode: IdentityMode;
  responseCount: number;
  responseLimit: number | null;
  endsAtLabel: string | null;
  daysLeft: number | null;
  publishedAtLabel: string | null;
  todayCount: number;
  yesterdayCount: number;
  dailyAverage: number;
  channels: ShareChannel[];
  /** 没带 `?src=` 的答卷（设计稿渠道表最后那行「无渠道标记」） */
  untaggedCount: number;
};

/** `2026-10-04 10:00`。全站时间文案统一这个写法（等宽字体） */
function stamp(date: Date | null) {
  return date ? formatDateTimeLocal(date).replace('T', ' ') : null;
}

export async function getSharePageData(questionnaireId: string): Promise<SharePageData | null> {
  const row = await prisma.questionnaire.findUnique({
    where: { id: questionnaireId },
    select: {
      id: true,
      title: true,
      status: true,
      slug: true,
      closeReason: true,
      identityMode: true,
      responseLimit: true,
      endsAt: true,
      publishedAt: true,
      channels: {
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          name: true,
          srcToken: true,
          _count: { select: { responses: { where: { status: 'VALID' } } } },
        },
      },
      _count: { select: { responses: { where: { status: 'VALID' } } } },
    },
  });

  if (!row) return null;

  const now = new Date();
  const todayStart = displayDayStart(now);
  const yesterdayStart = new Date(todayStart.getTime() - 24 * 60 * 60 * 1000);

  const valid = { status: 'VALID' as const };

  // 三个计数各自一次查询，并行发出。不「把全部答卷取回来在内存里数」：
  // 那在 1 万份答卷时会拖垮页面，而计数就该由数据库做
  const [todayCount, yesterdayCount, untaggedCount] = await Promise.all([
    prisma.response.count({
      where: { questionnaireId, ...valid, submittedAt: { gte: todayStart } },
    }),
    prisma.response.count({
      where: { questionnaireId, ...valid, submittedAt: { gte: yesterdayStart, lt: todayStart } },
    }),
    prisma.response.count({ where: { questionnaireId, ...valid, channelId: null } }),
  ]);

  const responseCount = row._count.responses;
  const activeDays = row.publishedAt
    ? Math.max(1, Math.ceil((now.getTime() - row.publishedAt.getTime()) / (24 * 60 * 60 * 1000)))
    : 1;

  return {
    id: row.id,
    title: row.title,
    status: row.status as QuestionnaireStatus,
    slug: row.slug,
    linkUrl: questionnaireUrl(row.slug),
    linkLabel: shortLinkLabel(row.slug),
    embedCode: embedCode(row.slug),
    qrUrl: qrImageUrl(row.id),
    qrDownloadUrl: qrImageUrl(row.id, { download: true }),
    closeReason: row.closeReason as CloseReason | null,
    identityMode: row.identityMode as IdentityMode,
    responseCount,
    responseLimit: row.responseLimit,
    endsAtLabel: stamp(row.endsAt),
    daysLeft: row.endsAt ? daysUntil(row.endsAt, now) : null,
    publishedAtLabel: stamp(row.publishedAt),
    todayCount,
    yesterdayCount,
    dailyAverage: Math.round((responseCount / activeDays) * 10) / 10,
    channels: row.channels.map((channel) => ({
      id: channel.id,
      name: channel.name,
      srcToken: channel.srcToken,
      responseCount: channel._count.responses,
      linkLabel: `?src=${channel.srcToken}`,
      linkUrl: channelUrl(row.slug, channel.srcToken),
    })),
    untaggedCount,
  };
}

/** 二维码路由只取这两个字段，不必走上面那次大查询 */
export async function getQuestionnaireLink(questionnaireId: string) {
  return prisma.questionnaire.findUnique({
    where: { id: questionnaireId },
    select: { slug: true, title: true },
  });
}
