'use client';

import { useActionState, useEffect, useState, useTransition } from 'react';

import { CheckIcon, ChevronUpDownIcon, PlusIcon } from '@/components/icons/ui-icons';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Modal, ModalContent } from '@/components/ui/modal';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Spinner } from '@/components/ui/spinner';
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
 *
 * 切换的等待态（R80）：点了哪一行，那一行就地把「N 位成员」换成「切换中…」+
 * spinner，其余行禁用。**弹层要等到新工作区落地才关** —— action 返回 ≠ 页面
 * 数据已换，提前关会露出「弹层没了、列表还是旧工作区」的中间态（R78 量过同类帧差）。
 * 落地判断看 `activeId` 这个 prop 有没有变成点了的那个，不用计时器（R68 的规矩）。
 */
export function WorkspaceSwitcher({ workspaces, activeId }: WorkspaceSwitcherProps) {
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  /** 正在切往哪个工作区；null = 没在切。由新 props 落地清除（见下） */
  const [switchingId, setSwitchingId] = useState<string | null>(null);

  const active = workspaces.find((workspace) => workspace.id === activeId) ?? workspaces[0] ?? null;

  /*
   * 切换完成 = 新工作区**落地**（`active` 变成点了的那个）：
   * 渲染期根据 prop 调整 state（React 官方写法），收掉等待态并关弹层。
   */
  if (switchingId !== null && active?.id === switchingId) {
    setSwitchingId(null);
    setPopoverOpen(false);
  }

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
              const isSwitching = switchingId === workspace.id;

              return (
                <button
                  key={workspace.id}
                  type="button"
                  disabled={pending || switchingId !== null}
                  aria-busy={isSwitching || undefined}
                  onClick={() => {
                    // 点当前工作区：不会有导航，直接收起（不然等待态永远等不到落地）
                    if (isActive) {
                      setPopoverOpen(false);
                      return;
                    }
                    setSwitchingId(workspace.id);
                    startTransition(async () => {
                      try {
                        await switchWorkspaceAction(workspace.id);
                        // 成功后什么都不做：等新工作区落地，上面的渲染期同步会收尾
                      } catch (error) {
                        // 失败：复位，用户可以再点
                        setSwitchingId(null);
                        throw error;
                      }
                    });
                  }}
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
                      {isSwitching
                        ? '切换中…'
                        : `${workspace.memberCount} 位成员 · ${ROLE_LABEL[workspace.role]}`}
                    </span>
                  </span>
                  {isSwitching ? (
                    <Spinner />
                  ) : isActive ? (
                    <CheckIcon className="text-brand-500 size-4 shrink-0" strokeWidth={2.6} />
                  ) : null}
                </button>
              );
            })}
          </div>

          <div className="bg-ink-100 my-2 h-px" />

          <button
            type="button"
            disabled={switchingId !== null}
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
