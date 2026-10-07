'use client';

import { useState, useTransition } from 'react';

import { Button } from '@/components/ui/button';
import { Modal, ModalContent } from '@/components/ui/modal';
import { Switch } from '@/components/ui/switch';
import { COLLECTION_STATE_LABEL, type QuestionnaireStatus } from '@/config/constants';
import { cn } from '@/utils/cn';

import { changeCollectionStatusAction } from '../actions/change-collection-status';

/**
 * 回收开关。
 *
 * 三种动作的**可用性由服务端的同一份规则决定**（`lib/transitions.ts`），这里只是照它显示：
 * 回收中 → 暂停；已暂停 → 恢复；两者都能截止；已截止与已归档则什么都不给
 * —— 「截止不可重开」是刻意的，所以界面上不出现一个点了会被拒绝的「恢复回收」。
 *
 * 截止要二次确认：它是**不可逆**的，链接一失效就回不来。
 */
export function CollectionControls({
  questionnaireId,
  status,
  variant,
}: {
  questionnaireId: string;
  status: QuestionnaireStatus;
  variant: 'topbar' | 'card';
}) {
  const [pending, startTransition] = useTransition();
  const [closeOpen, setCloseOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const collecting = status === 'PUBLISHED';
  const paused = status === 'PAUSED';
  const finished = status === 'CLOSED' || status === 'ARCHIVED';
  const draft = status === 'DRAFT';

  const run = (action: 'PAUSE' | 'RESUME' | 'CLOSE') => {
    setError(null);
    startTransition(async () => {
      const result = await changeCollectionStatusAction(questionnaireId, action);
      if (!result.ok) setError(result.message);
      setCloseOpen(false);
    });
  };

  const buttons = (
    <div className={cn('flex items-center gap-2', variant === 'card' && 'mt-3.5 grid grid-cols-2')}>
      {collecting ? (
        <Button
          variant="outline"
          size={variant === 'card' ? 'md' : 'sm'}
          disabled={pending}
          onClick={() => run('PAUSE')}
        >
          暂停回收
        </Button>
      ) : null}

      {paused ? (
        <Button
          variant="primary"
          size={variant === 'card' ? 'md' : 'sm'}
          disabled={pending}
          onClick={() => run('RESUME')}
        >
          恢复回收
        </Button>
      ) : null}

      {!finished && !draft ? (
        <Button
          variant="outline"
          size={variant === 'card' ? 'md' : 'sm'}
          disabled={pending}
          onClick={() => setCloseOpen(true)}
        >
          截止回收
        </Button>
      ) : null}

      {finished ? (
        <p className="text-ink-500 text-[12px] leading-5">
          {COLLECTION_STATE_LABEL[status as 'CLOSED']}，链接已失效。
          {/* 明确给出下一步，否则用户只会看到一个没有出路的死状态 */}
          要再来一轮请把它复制为新问卷。
        </p>
      ) : null}

      {draft ? <p className="text-ink-500 text-[12px] leading-5">发布后才开始回收。</p> : null}
    </div>
  );

  return (
    <>
      {variant === 'card' ? (
        <div className="border-ink-200 rounded-[14px] border p-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-ink-900 text-[13px] font-medium">回收开关</div>
              <div className="text-ink-400 mt-0.5 text-[11px]">
                {collecting
                  ? '关闭后链接将无法填写'
                  : paused
                    ? '已暂停，链接暂时无法填写'
                    : '当前未在回收'}
              </div>
            </div>

            <Switch
              checked={collecting}
              disabled={pending || finished || draft}
              aria-label="回收开关"
              onCheckedChange={(next) => run(next ? 'RESUME' : 'PAUSE')}
            />
          </div>

          {buttons}
        </div>
      ) : (
        <>
          {collecting ? (
            <Button variant="outline" size="sm" disabled={pending} onClick={() => run('PAUSE')}>
              暂停回收
            </Button>
          ) : null}

          {paused ? (
            <Button variant="primary" size="sm" disabled={pending} onClick={() => run('RESUME')}>
              恢复回收
            </Button>
          ) : null}

          {!finished && !draft ? (
            <Button
              variant="outline"
              size="sm"
              disabled={pending}
              onClick={() => setCloseOpen(true)}
            >
              截止回收
            </Button>
          ) : null}
        </>
      )}

      {error ? (
        <p role="alert" className="text-[12px] text-rose-600">
          {error}
        </p>
      ) : null}

      <Modal open={closeOpen} onOpenChange={setCloseOpen}>
        <ModalContent title="确定截止回收？" description="这一步不可撤销" width="sm">
          <p className="text-ink-600 text-[12.5px] leading-5">
            截止后公开链接立刻失效，作答者会看到「已截止」。
            <b className="text-ink-800">已截止的问卷不能重新开启</b>
            —— 否则「什么时候能填」就没法向已经收到通知的人解释了。
          </p>

          <div className="mt-4 flex gap-2.5">
            <Button variant="outline" className="flex-1" onClick={() => setCloseOpen(false)}>
              取消
            </Button>
            <Button
              loading={pending}
              variant="danger"
              className="flex-1"
              disabled={pending}
              onClick={() => run('CLOSE')}
            >
              {pending ? '截止中…' : '确认截止'}
            </Button>
          </div>
        </ModalContent>
      </Modal>
    </>
  );
}
