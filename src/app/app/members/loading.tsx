import { Skeleton, SkeletonStatic } from '@/components/ui/skeleton';
import { TableSkeleton } from '@/components/ui/table-skeleton';

/**
 * 成员与权限页的等待态（L05 表格骨架）。
 *
 * 表头写的是**真实列名**（成员 / 角色 / 加入时间 / 操作）：它是这一页自己的结构、
 * 不是假数据，而且文字宽度天然与真实表头一致 —— 列宽对不上是 L05 最忌的事。
 * 角色那一列用胶囊形状（`pillColumn={1}`），因为真实表格里它就是个选择器。
 */
export default function MembersLoading() {
  return (
    <>
      <header className="border-ink-200 hidden h-16 shrink-0 items-center justify-between gap-3 border-b bg-white px-4 sm:px-7 lg:flex">
        <SkeletonStatic className="h-5 w-24" />
        <SkeletonStatic className="rounded-btn h-9 w-[104px]" />
      </header>

      <main className="flex-1 overflow-y-auto p-6 sm:p-7">
        <div aria-busy="true" className="qw-fade-up mx-auto max-w-[1020px] space-y-6">
          <span role="status" className="sr-only">
            正在加载成员与权限…
          </span>

          {/* 三张数字卡 */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {[0, 1, 2].map((index) => (
              <div key={index} className="border-ink-200 rounded-xl border bg-white p-5">
                <SkeletonStatic className="h-3.5 w-20" />
                <Skeleton className="mt-3 h-7 w-12" />
              </div>
            ))}
          </div>

          <TableSkeleton
            rows={7}
            pillColumn={1}
            columns={[
              { header: '成员' },
              { header: '角色', widthClassName: 'w-56' },
              { header: '加入时间' },
              { header: '操作', widthClassName: 'w-24' },
            ]}
          />
        </div>
      </main>
    </>
  );
}
