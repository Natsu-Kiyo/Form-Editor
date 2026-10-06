'use client';

import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Modal, ModalContent } from '@/components/ui/modal';

/**
 * 导出答卷弹层。
 *
 * 放在 `components/questionnaire/` 而不是某个 feature 里：**统计页与答卷明细页都要用它**
 * （设计稿 W07 的顶栏那颗「导出」就是同一个弹层），而 features 之间禁止互相导入。
 * 与此前的 `layout/questionnaire-topbar` 是同一条理由。
 *
 * 参数名（`channel` / `from` / `to` / `invalid`）与统计页、导出接口完全一致 ——
 * 服务端是同一套解析（`features/analytics/lib/filter.ts`）。
 */
export function ExportResponsesDialog({
  open,
  onOpenChange,
  questionnaireId,
  channelId = null,
  from = null,
  to = null,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  questionnaireId: string;
  channelId?: string | null;
  /** `yyyy-mm-dd`；明细页不筛时间，所以默认不带 */
  from?: string | null;
  to?: string | null;
}) {
  const [includeInvalid, setIncludeInvalid] = useState(false);

  const params = new URLSearchParams();
  if (channelId) params.set('channel', channelId);
  if (from) params.set('from', from);
  if (to) params.set('to', to);
  if (includeInvalid) params.set('invalid', '1');
  const href = `/api/questionnaires/${questionnaireId}/export-responses?${params.toString()}`;

  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <ModalContent title="导出答卷" description="每行一份答卷，列为题目" width="sm">
        <div className="space-y-4">
          <div>
            <div className="text-ink-500 mb-2 text-[11.5px] font-medium">格式</div>
            <div className="border-ink-200 text-ink-700 rounded-xl border bg-white p-3.5 text-[12.5px]">
              CSV（UTF-8 带 BOM）
              <p className="text-ink-400 mt-1 text-[11.5px] leading-5">
                带 BOM 是为了让 Excel 双击打开时中文不乱码 —— 不加 BOM 的 UTF-8 CSV 在中文 Windows
                上会变成乱码。
              </p>
            </div>
          </div>

          <div>
            <div className="text-ink-500 mb-2 text-[11.5px] font-medium">范围</div>
            <label className="text-ink-600 flex items-center gap-2.5 text-[12.5px]">
              <input
                type="checkbox"
                checked={includeInvalid}
                onChange={(event) => setIncludeInvalid(event.target.checked)}
                className="accent-brand-500 size-4"
              />
              包含已标记无效的答卷
            </label>
            <p className="text-ink-400 mt-1.5 text-[11.5px]">
              默认只导出有效答卷；勾上之后会多一列「状态」，说明哪几份是无效的。
            </p>
          </div>

          <div className="flex gap-2.5 pt-1">
            <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
              取消
            </Button>
            <Button asChild className="flex-1">
              <a href={href} download>
                下载 CSV
              </a>
            </Button>
          </div>
        </div>
      </ModalContent>
    </Modal>
  );
}
