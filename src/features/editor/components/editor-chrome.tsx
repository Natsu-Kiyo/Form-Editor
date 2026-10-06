'use client';

import Link from 'next/link';
import { useState } from 'react';

import { AlertCircleIcon, CheckIcon } from '@/components/icons/ui-icons';
import { QuestionnaireTopbar } from '@/components/layout/questionnaire-topbar';
import { useIsDesktop } from '@/hooks/use-is-desktop';

import type { VersionRow } from '../api/versions';
import { VersionDrawer } from './version-drawer';
import { Button } from '@/components/ui/button';
import { Modal, ModalContent } from '@/components/ui/modal';
import { useUnsavedGuard } from '@/hooks/use-unsaved-guard';
import { cn } from '@/utils/cn';

import type { EditorReadOnlyReason } from '../api/questionnaires';
import { useEditorDraft } from './editor-draft';

/**
 * 编辑器顶栏（设计稿 W03 上半段）：返回、标题即输入框、保存按钮与保存状态，
 * 以及右侧的「历史版本」与「发布」。
 *
 * 「预览 / 协作」仍**不渲染**：预览要等 M5 的作答端（做一个仿的预览等于写一份注定要扔的代码），
 * 协作属 2.0。画一个点了没反应的按钮比少一个按钮糟得多。
 */
export function EditorChrome({
  readOnlyReason,
  versions,
}: {
  readOnlyReason: EditorReadOnlyReason;
  versions: VersionRow[];
}) {
  const isDesktop = useIsDesktop();
  const { questionnaireId, title, dirty, state, errorMessage, setTitle, save, discard } =
    useEditorDraft();
  const { isLeaving, isBackNavigation, cancelLeave, leave } = useUnsavedGuard(dirty);
  const [discardOpen, setDiscardOpen] = useState(false);

  const readOnly = readOnlyReason !== null;

  return (
    <QuestionnaireTopbar
      titleSlot={
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          readOnly={readOnly}
          aria-label="问卷标题"
          className="text-ink-900 hover:border-ink-200 focus:border-brand-500 w-64 min-w-0 border-b border-transparent bg-transparent text-[15px] font-semibold transition-colors duration-150 outline-none read-only:cursor-default"
        />
      }
    >
      {!readOnly ? (
        <>
          <SaveState
            state={state}
            dirty={dirty}
            errorMessage={errorMessage}
            onRetry={save}
            onDiscard={() => setDiscardOpen(true)}
          />

          <Button size="sm" disabled={!dirty || state === 'saving'} onClick={save}>
            {state === 'saving' ? '保存中…' : '保存'}
          </Button>
        </>
      ) : null}

      {/* 版本历史按 1.0 的范围只在桌面端出现（计划书 §3 的 C 级清单）：
          窄屏用 useIsDesktop **真不渲染**，不是 CSS 藏起来 */}
      {isDesktop ? (
        <VersionDrawer questionnaireId={questionnaireId} versions={versions} readOnly={readOnly} />
      ) : null}

      {/* 发布设置有两个入口（设计稿要求）：这条与问卷内的「发布设置」Tab */}
      <Link
        href={`/app/q/${questionnaireId}/publish`}
        className="border-ink-200 text-ink-600 hover:border-ink-300 flex h-9 shrink-0 items-center rounded-[10px] border bg-white px-3.5 text-[13px] font-medium transition-colors duration-150"
      >
        {readOnlyReason === 'FROZEN' ? '发布设置' : '发布'}
      </Link>

      <UnsavedChangesDialog
        open={isLeaving}
        isBackNavigation={isBackNavigation}
        onStay={cancelLeave}
        onLeave={leave}
        onSave={save}
      />

      <Modal open={discardOpen} onOpenChange={setDiscardOpen}>
        <ModalContent title="放弃未保存的修改？" width="sm">
          <p className="text-ink-500 mb-5 text-[12.5px] leading-5">
            会回到上次保存时的题目结构，本次改动都会丢掉。
          </p>
          <div className="flex gap-2.5">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => setDiscardOpen(false)}
            >
              继续编辑
            </Button>
            <Button
              type="button"
              variant="danger"
              className="flex-1"
              onClick={() => {
                setDiscardOpen(false);
                discard();
              }}
            >
              放弃修改
            </Button>
          </div>
        </ModalContent>
      </Modal>
    </QuestionnaireTopbar>
  );
}

function SaveState({
  state,
  dirty,
  errorMessage,
  onRetry,
  onDiscard,
}: {
  state: ReturnType<typeof useEditorDraft>['state'];
  dirty: boolean;
  errorMessage: string | null;
  onRetry: () => void;
  onDiscard: () => void;
}) {
  if (state === 'error') {
    return (
      <span className="flex items-center gap-1.5 text-[12px]" role="status">
        <AlertCircleIcon className="size-3.5 text-rose-500" />
        <span className="text-rose-600" title={errorMessage ?? undefined}>
          保存失败
        </span>
        <button
          type="button"
          onClick={onRetry}
          className="text-brand-500 hover:text-brand-600 font-medium transition-colors duration-150"
        >
          重试
        </button>
        <button
          type="button"
          onClick={onDiscard}
          className="text-ink-400 hover:text-ink-600 transition-colors duration-150"
        >
          放弃修改
        </button>
      </span>
    );
  }

  if (state === 'saving') {
    return (
      <span className="text-ink-400 flex items-center gap-1.5 text-[12px]" aria-live="polite">
        <span className="bg-ink-300 size-1.5 rounded-full" aria-hidden="true" />
        保存中…
      </span>
    );
  }

  if (dirty) {
    return (
      <span className="flex items-center gap-1.5 text-[12px] text-amber-600" aria-live="polite">
        <span className="size-1.5 rounded-full bg-amber-500" aria-hidden="true" />
        有未保存的修改
      </span>
    );
  }

  return (
    <span
      className={cn('flex items-center gap-1.5 text-[12px] text-emerald-600')}
      aria-live="polite"
    >
      <CheckIcon className="size-3.5" strokeWidth={2.4} />
      已保存
    </span>
  );
}

/**
 * 离开前的三选一。
 *
 * 刻意给三个出口而不是两个：只给「离开 / 留下」的话，想保住改动的人只能先留下、
 * 再自己去找保存按钮 —— 多一步的心智负担，正是这类弹层最招人烦的地方。
 */
function UnsavedChangesDialog({
  open,
  isBackNavigation,
  onStay,
  onLeave,
  onSave,
}: {
  open: boolean;
  isBackNavigation: boolean;
  onStay: () => void;
  onLeave: () => void;
  onSave: () => void;
}) {
  return (
    <Modal open={open} onOpenChange={(next) => (!next ? onStay() : undefined)}>
      <ModalContent title="有未保存的修改" width="sm">
        <p className="text-ink-500 mb-5 text-[12.5px] leading-5">
          {isBackNavigation
            ? '返回上一页会丢掉这次的改动。要先保存吗？'
            : '离开当前页面会丢掉这次的改动。要先保存吗？'}
        </p>
        <div className="flex flex-col gap-2.5 sm:flex-row">
          <Button type="button" variant="outline" className="flex-1" onClick={onStay}>
            留在本页
          </Button>
          <Button type="button" variant="outline" className="flex-1" onClick={onLeave}>
            放弃并离开
          </Button>
          <Button
            type="button"
            className="flex-1"
            onClick={() => {
              onSave();
              onLeave();
            }}
          >
            保存并离开
          </Button>
        </div>
      </ModalContent>
    </Modal>
  );
}
