'use client';

import { useActionState, useEffect, useState, useTransition } from 'react';

import { CheckIcon, ChevronUpDownIcon, PlusIcon } from '@/components/icons/ui-icons';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Modal, ModalContent } from '@/components/ui/modal';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ROLE_LABEL } from '@/config/constants';
import { EMPTY_FORM_STATE } from '@/types/form-state';
import { cn } from '@/utils/cn';

import { createWorkspaceAction } from '../actions/create-workspace';
import { switchWorkspaceAction } from '../actions/switch-workspace';
import type { WorkspaceSummary } from '../api/workspaces';

export type WorkspaceSwitcherProps = {
  workspaces: WorkspaceSummary[];
  activeId: string | null;
};

/**
 * 工作区切换器（入口：侧栏顶部）。
 *
 * 侧栏里显示的是**当前工作区**，点开才是完整列表 + 新建入口。
 * 切换写进 Cookie（服务端 action），而不是放进 URL —— 问卷、成员、日志
 * 全部挂在工作区下，URL 里再带一段工作区前缀会让每条链接都变长且易失效。
 */
export function WorkspaceSwitcher({ workspaces, activeId }: WorkspaceSwitcherProps) {
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const active = workspaces.find((workspace) => workspace.id === activeId) ?? workspaces[0] ?? null;

  return (
    <>
      <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="bg-ink-50 border-ink-200 hover:bg-ink-100 flex w-full items-center gap-2.5 rounded-[10px] border px-3 py-2.5 text-left transition-colors duration-150"
          >
            <Avatar name={active?.name ?? '未'} size="xs" tone="brand" />
            <span className="min-w-0 flex-1">
              <span className="text-ink-800 block truncate text-[12.5px] font-medium">
                {active?.name ?? '还没有工作区'}
              </span>
              <span className="text-ink-400 block text-[10.5px]">
                {active ? `${active.memberCount} 位成员` : '先新建一个'}
              </span>
            </span>
            <ChevronUpDownIcon className="text-ink-400 size-3.5 shrink-0" />
          </button>
        </PopoverTrigger>

        <PopoverContent align="start" className="w-[268px] p-3">
          <div className="text-ink-400 px-2 py-1.5 text-[11px] font-medium">切换工作区</div>

          <div className="space-y-0.5">
            {workspaces.map((workspace) => {
              const isActive = workspace.id === active?.id;

              return (
                <button
                  key={workspace.id}
                  type="button"
                  disabled={pending}
                  onClick={() =>
                    startTransition(async () => {
                      await switchWorkspaceAction(workspace.id);
                      setPopoverOpen(false);
                    })
                  }
                  className={cn(
                    'flex w-full items-center gap-2.5 rounded-[10px] px-3 py-2.5 text-left transition-colors duration-150',
                    isActive ? 'bg-brand-50' : 'hover:bg-ink-50',
                  )}
                >
                  <Avatar name={workspace.name} size="xs" tone="brand" />
                  <span className="min-w-0 flex-1">
                    <span className="text-ink-900 block truncate text-[12.5px] font-medium">
                      {workspace.name}
                    </span>
                    <span className="text-ink-400 block text-[10.5px]">
                      {workspace.memberCount} 位成员 · {ROLE_LABEL[workspace.role]}
                    </span>
                  </span>
                  {isActive ? (
                    <CheckIcon className="text-brand-500 size-4 shrink-0" strokeWidth={2.6} />
                  ) : null}
                </button>
              );
            })}
          </div>

          <div className="bg-ink-100 my-2 h-px" />

          <button
            type="button"
            onClick={() => {
              setPopoverOpen(false);
              setDialogOpen(true);
            }}
            className="text-brand-500 hover:bg-brand-50 flex h-9 w-full items-center justify-center gap-1.5 rounded-[10px] text-[12.5px] font-medium transition-colors duration-150"
          >
            <PlusIcon className="size-3.5" />
            新建工作区
          </button>
        </PopoverContent>
      </Popover>

      <Modal open={dialogOpen} onOpenChange={setDialogOpen}>
        <ModalContent
          title="新建工作区"
          description="工作区用来隔离问卷、成员与操作日志。"
          width="sm"
        >
          {/* 只在打开时挂载：Radix 关闭时会卸载内容，useActionState 也就随之重置 */}
          <CreateWorkspaceForm onDone={() => setDialogOpen(false)} />
        </ModalContent>
      </Modal>
    </>
  );
}

function CreateWorkspaceForm({ onDone }: { onDone: () => void }) {
  const [state, formAction, pending] = useActionState(createWorkspaceAction, EMPTY_FORM_STATE);

  useEffect(() => {
    if (state.success) onDone();
  }, [state.success, onDone]);

  return (
    <form id="create-workspace-form" action={formAction} className="space-y-4" noValidate>
      <div>
        <Label htmlFor="workspace-name" required>
          工作区名称
        </Label>
        <Input
          id="workspace-name"
          name="name"
          placeholder="例如：星野社团"
          defaultValue={state.values?.name}
          invalid={Boolean(state.fieldErrors?.name)}
          required
        />
        {state.fieldErrors?.name ? (
          <p className="text-caption mt-1.5 text-rose-500">{state.fieldErrors.name.join('，')}</p>
        ) : null}
      </div>

      {state.message ? <p className="text-caption text-rose-500">{state.message}</p> : null}

      <div className="flex justify-end gap-2 pt-1">
        <Button type="button" variant="ghost" onClick={onDone}>
          取消
        </Button>
        <Button loading={pending} type="submit" disabled={pending}>
          {pending ? '创建中…' : '创建'}
        </Button>
      </div>
    </form>
  );
}
