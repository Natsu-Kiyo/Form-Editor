import { env } from '@/config/env';

/**
 * 公开链接的拼装。
 *
 * 单独一个文件是因为**四处都要用它**：分享页展示、二维码内容、嵌入代码、渠道链接 ——
 * 少一处手拼就会出现「二维码扫出来和复制到的不是同一个地址」。
 *
 * `/s/{slug}` 这条路由由 M5 的作答端接管；这里只负责把地址拼对。
 */
export function questionnaireUrl(slug: string) {
  return `${env.NEXT_PUBLIC_APP_URL.replace(/\/+$/, '')}/s/${slug}`;
}

/** 展示用的短链文案：去掉协议头（设计稿里显示的是 `qingwj.cn/s/a7Xk29`） */
export function shortLinkLabel(slug: string) {
  return questionnaireUrl(slug).replace(/^https?:\/\//, '');
}

/** 渠道链接：短链 + `?src=` */
export function channelUrl(slug: string, srcToken: string) {
  return `${questionnaireUrl(slug)}?src=${encodeURIComponent(srcToken)}`;
}

/**
 * 嵌入代码（设计稿 W05 的「嵌入到网页」）。
 *
 * 指向 `?embed=1` 而不是 `/embed` 子路由：**能复制的代码里不能有 404 的地址**。
 * 嵌入态（去掉页头页脚）由作答端按这个参数自己处理。
 */
export function embedCode(slug: string) {
  return `<iframe src="${questionnaireUrl(slug)}?embed=1" width="100%" height="640"></iframe>`;
}

/** 二维码图片地址。`download=1` 时响应带 `Content-Disposition`，点一下直接落盘 */
export function qrImageUrl(questionnaireId: string, options: { download?: boolean } = {}) {
  return `/api/questionnaires/${questionnaireId}/qr${options.download ? '?download=1' : ''}`;
}
