'use client';

import { useActionState, useEffect, useState, useTransition } from 'react';

import { DotsIcon, TrashIcon } from '@/components/icons/ui-icons';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Modal, ModalContent } from '@/components/ui/modal';
import { UPCOMING_BADGE } from '@/config/constants';

import { deleteTemplateAction, renameTemplateAction } from '../actions/manage-template';

/**
 * 「我的模板」卡右上角的「⋯」。
 *
 * 两个 A 级动作（重命名 / 删除）+ 两个 B 级灰显（设为公开 / 收藏）。
 *
 * 灰显按规范做：**`disabled` + 角标，不留 hover 假反馈** —— 灰显项不算假入口，
 * 但「看起来能点、点了没反应」算。删除是硬删，所以二次确认里写清
 * 「用过它的问卷不受影响」（用户真正担心的是这个，不是模板本身）。
 */
export function TemplateActionsMenu({ templateId, title }: { templateId: string; title: string }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [dialog, setDialog] = useState<'rename' | 'delete' | null>(null);

  return (
    <>
      <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label={`更多操作「${title}」`}
            className="border-ink-200 text-ink-500 hover:text-ink-900 flex size-7 items-center justify-center rounded-md border bg-white/90 shadow-sm transition-colors duration-150 hover:bg-white"
          >
            <DotsIcon className="size-4" />
          </button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuItem onSelect={() => setDialog('rename')}>重命名</DropdownMenuItem>

          <DropdownMenuSeparator />

          <DropdownMenuItem icon={<TrashIcon />} tone="danger" onSelect={() => setDialog('delete')}>
            删除模板
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          <DropdownMenuItem disabled>
            设为公开
            <span className="text-ink-300 ml-auto text-[10.5px]">{UPCOMING_BADGE.V20}</span>
          </DropdownMenuItem>
          <DropdownMenuItem disabled>
            收藏
            <span className="text-ink-300 ml-auto text-[10.5px]">{UPCOMING_BADGE.V20}</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {dialog === 'rename' ? (
        <RenameTemplateDialog
          templateId={templateId}
          title={title}
          onClose={() => setDialog(null)}
        />
      ) : null}

      {dialog === 'delete' ? (
        <DeleteTemplateDialog
          templateId={templateId}
          title={title}
          onClose={() => setDialog(null)}
        />
      ) : null}
    </>
  );
}

function RenameTemplateDialog({
  templateId,
  title,
  onClose,
}: {
  templateId: string;
  title: string;
  onClose: () => void;
}) {
  const [state, formAction, pending] = useActionState(renameTemplateAction, {});

  // 成功后自动关闭：与「另存为模板」弹层同一条约定。
  // 不关的话，用户会盯着一个「已经保存成功」的表单，不知道还要不要再点一次。
  useEffect(() => {
    if (state.success) onClose();
  }, [state.success, onClose]);

  return (
    <Modal open onOpenChange={(next) => !next && onClose()}>
      <ModalContent title="重命名模板" description={`当前名称：${title}`} width="sm">
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="templateId" value={templateId} />

          <div>
            <label
              htmlFor="template-title"
              className="text-ink-500 mb-1.5 block text-[11.5px] font-medium"
            >
              模板名称
            </label>
            <input
              id="template-title"
              name="title"
              required
              defaultValue={state.values?.title ?? title}
              className="border-ink-200 text-ink-700 focus:border-brand-500 h-10 w-full rounded-[10px] border bg-white px-3 text-[13px] outline-none"
            />
            {state.fieldErrors?.title ? (
              <p className="mt-1.5 text-[11.5px] text-rose-600">{state.fieldErrors.title[0]}</p>
            ) : null}
          </div>

          {state.message ? <p className="text-[12px] text-rose-600">{state.message}</p> : null}

          <div className="flex gap-2.5">
            <Button type="button" variant="outline" className="flex-1" onClick={onClose}>
              取消
            </Button>
            <Button type="submit" className="flex-1" disabled={pending}>
              {pending ? '保存中…' : '保存'}
            </Button>
          </div>
        </form>
      </ModalContent>
    </Modal>
  );
}

function DeleteTemplateDialog({
  templateId,
  title,
  onClose,
}: {
  templateId: string;
  title: string;
  onClose: () => void;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <Modal open onOpenChange={(next) => !next && onClose()}>
      <ModalContent title="删除模板" description={`确定删除「${title}」吗？`} width="sm">
        <p className="text-ink-500 text-[12.5px] leading-6">
          删除后模板库里不再有它。
          <b className="text-ink-700 font-medium">用它创建过的问卷不受影响</b>
          —— 那些问卷是独立的一份，与模板再无关系。
        </p>

        <div className="mt-5 flex gap-2.5">
          <Button variant="outline" className="flex-1" onClick={onClose}>
            取消
          </Button>
          <Button
            className="flex-1 bg-rose-600 hover:bg-rose-700"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                await deleteTemplateAction(templateId);
                onClose();
              })
            }
          >
            {pending ? '删除中…' : '确认删除'}
          </Button>
        </div>
      </ModalContent>
    </Modal>
  );
}
