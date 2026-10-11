'use client';

import { useState, useTransition } from 'react';

import { Button } from '@/components/ui/button';
import { Drawer, DrawerContent } from '@/components/ui/drawer';
import { Modal, ModalContent } from '@/components/ui/modal';
import { formatVersion } from '@/config/constants';
import { cn } from '@/utils/cn';

import { rollbackVersionAction } from '../actions/rollback-version';
import type { VersionRow } from '../api/versions';

/**
 * 版本历史（设计稿 W11 的抽屉）。
 *
 * 两条设计稿的原话被落进实现里：
 * - 「回滚不删除任何历史版本」—— 回滚会**再写一条**新版本，抽屉里会多出一条「回滚自 vN」；
 * - 「发布即冻结」—— 只有草稿能回滚，已发布的问卷这里只读（`readOnly` 传进来）。
 *
 * 已发布的问卷不做「移动端隐藏」处理：版本历史本来就只在这一页出现，
 * 窄屏时抽屉自动占满宽度即可。
 */
export function VersionDrawer({
  questionnaireId,
  versions,
  readOnly,
}: {
  questionnaireId: string;
  versions: VersionRow[];
  readOnly: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState<VersionRow | null>(null);
  /** 回滚结果横幅：**带语气** —— 失败不能长得像成功（R91 · S3） */
  const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const rollback = () => {
    if (!target) return;

    startTransition(async () => {
      const result = await rollbackVersionAction(questionnaireId, target.id);

      /*
       * 此前两个分支写的是同一句 `setMessage(result.message)`，而横幅的样式写死 emerald ——
       * 于是「这个版本不存在」被渲染成一条绿色的「成功」回执，还用 `role="status"` 播报。
       */
      setMessage({ tone: result.ok ? 'ok' : 'error', text: result.message });
      setTarget(null);
      if (result.ok) setOpen(false);
    });
  };

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        历史版本
      </Button>

      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerContent
          title="版本历史"
          description={`共 ${versions.length} 个版本`}
          widthClassName="max-w-[440px]"
        >
          <div className="flex-1 overflow-y-auto px-5 py-4">
            {message ? (
              <p
                // 失败用 alert（读屏会立刻打断），成功才用 status
                role={message.tone === 'error' ? 'alert' : 'status'}
                className={cn(
                  'mb-3 rounded-lg px-3 py-2 text-[12.5px]',
                  message.tone === 'error'
                    ? 'bg-rose-50 text-rose-700'
                    : 'bg-emerald-50 text-emerald-700',
                )}
              >
                {message.text}
              </p>
            ) : null}

            <ol className="space-y-1">
              {versions.map((version) => (
                <li
                  key={version.id}
                  className={cn(
                    'flex items-start gap-3 rounded-[10px] px-3 py-3',
                    version.isCurrent ? 'bg-brand-50/60' : 'hover:bg-ink-50',
                  )}
                >
                  <span className="text-ink-400 mt-0.5 shrink-0 font-mono text-[12px]">
                    {formatVersion(version.version)}
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className="text-ink-800 block text-[13px]">
                      {version.label}
                      {version.isCurrent ? (
                        <span className="bg-brand-100 text-brand-700 ml-2 rounded px-1.5 py-0.5 text-[10px] font-medium">
                          当前
                        </span>
                      ) : null}
                    </span>
                    <span className="text-ink-400 mt-1 block text-[11.5px]">
                      {version.authorName} · {version.createdAtLabel}
                    </span>
                  </span>

                  {!readOnly && !version.isCurrent ? (
                    <Button variant="ghost" size="sm" onClick={() => setTarget(version)}>
                      回滚
                    </Button>
                  ) : null}
                </li>
              ))}
            </ol>

            {versions.length === 0 ? (
              <p className="text-ink-400 text-[12.5px] leading-5">
                还没有版本。每次保存（结构确有变化时）与每次发布都会留一条快照。
              </p>
            ) : null}
          </div>
        </DrawerContent>
      </Drawer>

      <Modal open={target !== null} onOpenChange={() => setTarget(null)}>
        <ModalContent
          title={`回滚到 ${target ? formatVersion(target.version) : ''}？`}
          description="会用这一版的结构覆盖当前草稿"
          width="sm"
        >
          <p className="text-ink-600 text-[12.5px] leading-5">
            当前未保存的改动会丢失。回滚<b className="text-ink-800">不会删除任何历史版本</b>
            ，它会再写一条新版本，所以之后再回滚回来也可以。
          </p>

          <div className="mt-4 flex gap-2.5">
            <Button variant="outline" className="flex-1" onClick={() => setTarget(null)}>
              取消
            </Button>
            <Button loading={pending} className="flex-1" disabled={pending} onClick={rollback}>
              {pending ? '回滚中…' : '确认回滚'}
            </Button>
          </div>
        </ModalContent>
      </Modal>
    </>
  );
}
