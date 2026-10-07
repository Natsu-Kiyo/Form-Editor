import { SkeletonStatic } from '@/components/ui/skeleton';
import { TableSkeleton } from '@/components/ui/table-skeleton';

/**
 * 操作日志页的等待态（L05 表格骨架）。
 *
 * 与成员页的区别：日志的列名这里**不给文字**（它是「时间 / 操作 / 对象 / 操作人」那一类，
 * 具体措辞由页面决定），退化成静态灰块 —— 照样**不扫光**（L05：表头是静态结构，
 * 给它加动画反而暴露「整张表是假的」）。
 *
 * 行数 7：一屏能看到的量，不按分页大小渲染。
 */
export default function LogsLoading() {
  return (
    <>
      <header className="border-ink-200 hidden h-16 shrink-0 items-center justify-between gap-3 border-b bg-white px-4 sm:px-7 lg:flex">
        <SkeletonStatic className="h-5 w-20" />
        <SkeletonStatic className="rounded-btn h-9 w-[132px]" />
      </header>

      <main className="flex-1 overflow-y-auto p-6 sm:p-7">
        <div aria-busy="true" className="qw-fade-up mx-auto max-w-[1020px] space-y-5">
          <span role="status" className="sr-only">
            正在加载操作日志…
          </span>

          {/* 筛选条 */}
          <div className="flex flex-wrap items-center gap-3">
            <SkeletonStatic className="rounded-btn h-10 w-[140px]" />
            <SkeletonStatic className="rounded-btn h-10 w-[140px]" />
            <SkeletonStatic className="rounded-btn ml-auto h-9 w-[104px]" />
          </div>

          <TableSkeleton rows={7} columns={[{}, {}, {}, {}]} />
        </div>
      </main>
    </>
  );
}
