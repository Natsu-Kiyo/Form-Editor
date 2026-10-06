'use client';

import { useTransition } from 'react';

import { PlusIcon } from '@/components/icons/ui-icons';
import { Fab } from '@/components/ui/fab';

import { createBlankQuestionnaireAction } from '../actions/create-questionnaire';

/**
 * 移动工作台的悬浮「＋」（设计稿 P04）。
 *
 * **直接建一份空白问卷进编辑器，不弹新建弹层** —— 设计稿写得明确：
 * 「＋ = 新建问卷，直接开一份空白问卷进编辑器（空态给『＋ 添加题目』与『从模板开始』两条路）」。
 * 也就是说「空白 / 从模板」这个选择发生在**编辑器里**，而不是先弹一层再问一遍。
 * 想从模板开始时，底部导航的「模板」那一格就是入口。
 *
 * 只有在**有权限**（编辑者）时才会渲染 —— 查看者看不到这个按钮（见调用处）。
 */
export function CreateBlankFab() {
  const [pending, startTransition] = useTransition();

  return (
    <Fab
      aria-label="新建问卷"
      disabled={pending}
      onClick={() => startTransition(() => void createBlankQuestionnaireAction())}
      className="fixed right-5 bottom-[96px] z-30 size-[52px] lg:hidden"
    >
      <PlusIcon className="size-5" strokeWidth={2.6} />
    </Fab>
  );
}
