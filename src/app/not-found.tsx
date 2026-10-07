import Link from 'next/link';

/**
 * 全站 404。
 *
 * 之前没有这一页，`notFound()` 会落到 Next 的默认页：一张白底英文的
 * 「404 This page could not be found.」—— 在一个全中文的产品里，那看起来像
 * 「站点坏了」而不是「这个地址不对」。
 *
 * 刻意不做「搜索框」之类的装饰：404 上用户只有两件事想做 —— 确认自己没输错、
 * 以及回到一个能用的地方。所以给一句人话 + 一个真链接。
 */
export default function NotFound() {
  return (
    <div className="bg-ink-50 flex min-h-[100dvh] items-center justify-center p-6">
      <div className="border-ink-200 w-full max-w-[420px] rounded-xl border bg-white p-8 text-center">
        <div className="text-ink-300 font-mono text-[40px] leading-none font-semibold">404</div>
        <h1 className="text-ink-900 mt-4 text-[15px] font-semibold">这个地址打不开</h1>
        <p className="text-ink-500 mt-2 text-[12.5px] leading-5">
          链接可能已经失效、被撤回，或者本来就不属于你这个账号。
          <br />
          如果你是从别人那里拿到的链接，请让发链接的人重新发一次。
        </p>

        <Link
          href="/app"
          className="bg-brand-500 hover:bg-brand-600 mt-6 inline-flex h-9 items-center rounded-[10px] px-4 text-[13px] font-medium text-white transition-colors duration-150"
        >
          回到问卷列表
        </Link>
      </div>
    </div>
  );
}
