import { ROLE_LABEL } from '@/config/constants';

import { canDo, MATRIX_ROLES, PERMISSION_MATRIX } from '../lib/permissions-matrix';

/**
 * 权限说明（W09 页尾）。
 *
 * **表格按 `PERMISSION_MATRIX` 渲染，不是手写的 HTML**：那张表同时被
 * `docs/VERIFY.md` 的越权走查使用，手抄一份迟早出现「界面说不能、代码里却能」。
 * 每行还标明来历（设计稿矩阵 / 由某行推得 / 代码口径），改规则时知道该跟谁对齐。
 */
export function PermissionMatrix() {
  return (
    <div className="border-ink-200 overflow-hidden rounded-xl border bg-white">
      <div className="border-ink-100 border-b px-6 py-4">
        <h2 className="text-ink-900 mb-1 text-[14.5px] font-semibold">权限说明</h2>
        <p className="text-ink-500 text-[12.5px]">
          颜色越深权限越高。看不到的入口就是没有权限，无需自己判断按钮能不能点。
        </p>
      </div>

      <table className="w-full text-[12.5px]">
        <thead className="bg-ink-50 text-ink-600">
          <tr>
            <th className="px-6 py-2.5 text-left font-medium">权限点</th>
            {MATRIX_ROLES.map((role) => (
              <th key={role} className="px-4 py-2.5 text-center font-medium">
                {ROLE_LABEL[role]}
              </th>
            ))}
          </tr>
        </thead>

        <tbody className="divide-ink-100 divide-y">
          {PERMISSION_MATRIX.map((row) => (
            <tr key={row.point}>
              <td className="text-ink-700 px-6 py-2.5">
                {row.point}
                <span className="text-ink-300 ml-2 text-[11px]">{row.source}</span>
              </td>
              {MATRIX_ROLES.map((role) => (
                <td key={role} className="px-4 py-2.5 text-center">
                  {canDo(row.min, role) ? (
                    <span className="text-brand-500 font-semibold">●</span>
                  ) : (
                    <span className="text-ink-300">—</span>
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
