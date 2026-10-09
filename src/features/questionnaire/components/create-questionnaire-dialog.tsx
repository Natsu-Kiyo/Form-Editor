'use client';

import { useRouter } from 'next/navigation';
import { useActionState, useState } from 'react';

import { GridIcon, PlusIcon } from '@/components/icons/ui-icons';
import { Button } from '@/components/ui/button';
import { Modal, ModalContent } from '@/components/ui/modal';
import { EMPTY_FORM_STATE } from '@/types/form-state';

import { createQuestionnaireAction } from '../actions/create-questionnaire';

/** 弹层里那张「从模板创建」卡点下去的目的地 */
const TEMPLATES_PATH = '/app/templates';

export type CreateQuestionnaireDialogProps = {
  /** 顶栏是主按钮（h-9 / 13px），空状态里是小按钮（h-8 / 12px） */
  variant?: 'topbar' | 'empty';
};

/**
 * 新建问卷弹层（入口：顶栏「新建问卷」与空状态里的同名按钮）。
 *
 * 组件自带触发按钮，所以「顶栏」与「空状态」各放一个实例即可 ——
 * 两处共用同一份弹层与同一个 action，不会出现两套行为。
 *
 * 两处刻意的处理：
 * - 弹层里没有标题输入框：标题在编辑器顶栏改（设计稿 W03 的顶栏标题即输入框），
 *   这里多问一次只会让「想先随手建一份」的路径变长。
 * - **「从模板创建」是一个跳转入口，不在这里列模板**（R64）：模板中心有搜索、分类、
 *   预览与公开池，「在这儿再列一遍」既复制了一套界面、又绕开了那些能力。
 *   点它 = 关弹层 + 去模板中心（挑中哪张卡再点「使用此模板」，落地即编辑器）。
 */
export function CreateQuestionnaireDialog({ variant = 'topbar' }: CreateQuestionnaireDialogProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={
          variant === 'topbar'
            ? 'bg-brand-500 hover:bg-brand-600 flex h-9 items-center gap-1.5 rounded-[10px] px-4 text-[13px] font-medium text-white transition-colors duration-150'
            : 'bg-brand-500 hover:bg-brand-600 flex h-8 items-center gap-1.5 rounded-lg px-3.5 text-[12px] font-medium text-white transition-colors duration-150'
        }
      >
        <PlusIcon className="size-4" />
        新建问卷
      </button>

      <Modal open={open} onOpenChange={setOpen}>
        <ModalContent title="新建问卷" description="选择一种方式开始" width="sm">
          {open ? <CreateQuestionnaireForm onDone={() => setOpen(false)} /> : null}
        </ModalContent>
      </Modal>
    </>
  );
}

function CreateQuestionnaireForm({ onDone }: { onDone: () => void }) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(createQuestionnaireAction, EMPTY_FORM_STATE);

  // 没有「成功后关闭弹层」这一步：创建成功时 action 会直接 `redirect` 到编辑器，
  // 整个页面会跟着换掉，弹层自然消失（挂个 effect 反而会变成永不触发的死代码）

  return (
    <form action={formAction} className="space-y-3" noValidate>
      {/*
        只有「空白创建」这一种提交方式，所以它保持「已选」样式：
        底部那颗「创建」建的就是它。另一张卡是跳转入口，不是选项。
      */}
      <div className="border-brand-500 ring-brand-500/10 flex items-center gap-4 rounded-xl border-2 p-4 ring-[3px]">
        <span className="bg-brand-50 flex size-10 shrink-0 items-center justify-center rounded-[10px]">
          <PlusIcon className="text-brand-500 size-[18px]" />
        </span>
        <span className="flex-1">
          <span className="text-ink-900 block text-[13.5px] font-medium">空白创建</span>
          <span className="text-ink-500 block text-[12px]">从第一道题开始设计</span>
        </span>
      </div>

      <button
        type="button"
        onClick={() => {
          onDone();
          router.push(TEMPLATES_PATH);
        }}
        className="border-ink-200 hover:border-brand-300 flex w-full items-center gap-4 rounded-xl border p-4 text-left transition-colors duration-150"
      >
        <span className="bg-ink-50 flex size-10 shrink-0 items-center justify-center rounded-[10px]">
          <GridIcon className="text-ink-500 size-[18px]" />
        </span>
        <span className="flex-1">
          <span className="text-ink-900 block text-[13.5px] font-medium">从模板创建</span>
          <span className="text-ink-500 block text-[12px]">点击跳转到模板页</span>
        </span>
      </button>

      {state.message ? <p className="text-caption text-rose-500">{state.message}</p> : null}

      <div className="flex gap-2.5 pt-1">
        <Button type="button" variant="outline" className="flex-1" onClick={onDone}>
          取消
        </Button>
        <Button loading={pending} type="submit" className="flex-1" disabled={pending}>
          {pending ? '创建中…' : '创建'}
        </Button>
      </div>
    </form>
  );
}
