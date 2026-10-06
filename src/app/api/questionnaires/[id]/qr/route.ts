import { NextResponse } from 'next/server';
import QRCode from 'qrcode';

import { getQuestionnaireLink } from '@/features/publish/api/share';
import { questionnaireUrl } from '@/features/publish/lib/links';
import { requireQuestionnaireAccess } from '@/lib/auth/questionnaire-access';

/**
 * 问卷二维码（PNG）。
 *
 * 用 Route Handler 而不是 Server Action：要触发下载就得让响应带上
 * `Content-Disposition`，而 Server Action 的返回值始终是给 React 的数据。
 *
 * **用 PNG 而不是 SVG**：二维码是要被转发、贴进聊天窗口、印在纸上的东西，
 * 而很多场景（微信、部分图片查看器、办公软件）打不开 SVG —— 拿到一个「下载了却看不了」
 * 的文件比糊一点糟糕得多。512px 的 PNG 在手机上看与印刷都够了。
 *
 * 权限按 `VIEWER` 起 —— 能看这份问卷的人就能分享它。
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  await requireQuestionnaireAccess(id, 'VIEWER');

  const questionnaire = await getQuestionnaireLink(id);
  if (!questionnaire) {
    return new NextResponse('问卷不存在', { status: 404 });
  }

  const png = await QRCode.toBuffer(questionnaireUrl(questionnaire.slug), {
    type: 'png',
    margin: 1,
    width: 512,
    errorCorrectionLevel: 'M',
  });

  const download = new URL(request.url).searchParams.get('download') === '1';

  return new NextResponse(new Uint8Array(png), {
    headers: {
      'content-type': 'image/png',
      // 短链一旦重新生成，旧二维码就该失效，所以不缓存
      'cache-control': 'no-store',
      ...(download
        ? {
            // RFC 5987：文件名含中文时必须这样写，直接写 filename 会乱码
            'content-disposition': `attachment; filename*=UTF-8''${encodeURIComponent(
              `二维码-${questionnaire.title}.png`,
            )}`,
          }
        : {}),
    },
  });
}
