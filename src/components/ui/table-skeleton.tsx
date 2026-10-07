import { Skeleton, SkeletonStatic } from './skeleton';

/**
 * 表格骨架（设计稿 `补充.html` L05）。
 *
 * 比卡片骨架更严的三条（都写在设计稿里）：
 * 1. **列宽必须与真实表头一致** —— 列宽一错，数据出现时整张表会重排。
 *    所以列宽由调用方按真实表头给（`columns`），这里不自己发明。
 * 2. **行数给 6–8 行**：一屏能看到的量，不必按分页大小渲染。
 * 3. **表头不扫光**：表头是静态结构、从一开始就存在，给它加动画反而暴露「整张表是假的」。
 *
 * 表头有两种给法：
 * - `headers`：直接写真实列名（**推荐**）。它是页面自己的结构，不是假数据，
 *   而且文字宽度天然与真实表头一致。
 * - 不给：退化成静态灰块（同样不扫光）。
 *
 * 状态列（角色 / 状态这类）用**胶囊**形状：那一列的视觉重量与别处不同，
 * 形状对了才对得上 —— 用 `pillColumn` 指出来。
 */
export type TableSkeletonColumn = {
  /** 列宽类名，例如 `w-56`；不给就是自适应 */
  widthClassName?: string;
  /** 表头文字；不给则渲染静态灰块 */
  header?: string;
};

export function TableSkeleton({
  columns,
  rows = 7,
  pillColumn,
  className,
}: {
  columns: TableSkeletonColumn[];
  rows?: number;
  /** 第几列用胶囊形状（0 起） */
  pillColumn?: number;
  className?: string;
}) {
  return (
    <div
      aria-busy="true"
      className={`border-ink-200 overflow-hidden rounded-xl border bg-white ${className ?? ''}`}
    >
      <span role="status" className="sr-only">
        正在加载表格…
      </span>

      <table className="w-full text-[13px]">
        <thead className="bg-ink-50 text-ink-600">
          <tr>
            {columns.map((column, index) => (
              <th
                key={index}
                className={`px-6 py-2.5 text-left font-medium ${column.widthClassName ?? ''}`}
              >
                {column.header ? column.header : <SkeletonStatic className="h-3.5 w-16" />}
              </th>
            ))}
          </tr>
        </thead>

        <tbody className="divide-ink-100 divide-y">
          {Array.from({ length: rows }, (_, rowIndex) => (
            <tr key={rowIndex}>
              {columns.map((_, columnIndex) => (
                <td key={columnIndex} className="px-6 py-4">
                  {columnIndex === pillColumn ? (
                    <SkeletonStatic className="h-6 w-[76px] rounded-full" />
                  ) : (
                    <Skeleton className="h-3.5 w-full max-w-[160px]" />
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
