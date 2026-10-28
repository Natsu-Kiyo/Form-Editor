'use client';

import { useRef, useState, useTransition } from 'react';

import { QuestionPreviewList } from '@/components/questionnaire/question-preview';
import { Button } from '@/components/ui/button';
import { Drawer, DrawerContent } from '@/components/ui/drawer';
import { Modal, ModalContent } from '@/components/ui/modal';
import { useToast } from '@/components/ui/toast';
import { formatVersion } from '@/config/constants';
import { cn } from '@/utils/cn';

import { previewVersionAction } from '../actions/preview-version';
import { rollbackVersionAction } from '../actions/rollback-version';
import type { VersionHistory, VersionPreviewResult, VersionRow } from '../api/versions';
import { useEditorDraft } from './editor-draft';

/**
 * 版本历史（设计稿 W11 的抽屉）。
 *
 * 三条规则落在这里（前两条来自设计稿，第三条来自用户复测）：
 * - 「回滚不删除任何历史版本」—— 一个版本都不会消失；
 * - 「发布即冻结」—— 只有草稿能回滚，已发布 / 只读时这里只剩预览；
 * - **回滚不再写一条新记录**：只把「当前版本」指回目标版本。原先每次回滚都留一条
 *   与目标版本内容相同的记录，回滚几次后抽屉里全是看不出差别的行。
 *
 * 顶部那条「已回滚到 vN」也**不是一次性回执**（那是它上次出错的原因：回滚后继续编辑到 v9，
 * 它还挂在最上面）。现在它由 `currentVersion < latestVersion` 推出来 —— 也就是
 * 「指针落后于最新编号」= 回滚过且之后没再保存；一旦保存出新版本，它就自然消失。
 */
export function VersionDrawer({
  questionnaireId,
  history,
  readOnly,
}: {
  questionnaireId: string;
  history: VersionHistory;
  readOnly: boolean;
}) {
  const { applyServerStructure, state, dirty } = useEditorDraft();
  const { toast } = useToast();

  const [open, setOpen] = useState(false);
  /** 待确认回滚的那一版 */
  const [target, setTarget] = useState<VersionRow | null>(null);
  /** 正在预览的那一版（弹层开着）；数据由 action 按需取 */
  const [preview, setPreview] = useState<VersionRow | null>(null);
  const [previewData, setPreviewData] = useState<VersionPreviewResult | null>(null);
  const [previewPending, setPreviewPending] = useState(false);
  /** 失败提示留在抽屉里（成功会关抽屉，回执走 toast） */
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  /**
   * 预览请求的序号。用户可能点开 v5 又立刻点开 v3 —— 先发的请求若后回来，
   * 弹层里显示的会是上一版的内容。只认最后一次请求。
   */
  const previewRequestRef = useRef(0);

  /** 指针落后于最新编号 = 回滚过、且之后没有再保存 */
  const rolledBackTo =
    history.currentVersion > 0 && history.currentVersion < history.latestVersion
      ? history.currentVersion
      : null;

  const closePreview = () => {
    previewRequestRef.current += 1;
    setPreview(null);
    setPreviewData(null);
    setPreviewPending(false);
  };

  const openDrawer = () => {
    setErrorMessage(null);
    setOpen(true);
  };

  const closeDrawer = () => {
    setErrorMessage(null);
    setTarget(null);
    closePreview();
    setOpen(false);
  };

  const openPreview = (row: VersionRow) => {
    const requestId = previewRequestRef.current + 1;
    previewRequestRef.current = requestId;

    setPreview(row);
    setPreviewData(null);
    setPreviewPending(true);

    void (async () => {
      const result = await previewVersionAction(questionnaireId, row.id);
      // 已经换了一版（或关掉了弹层）：这份结果作废
      if (previewRequestRef.current !== requestId) return;

      setPreviewPending(false);
      setPreviewData(result);
    })();
  };

  const rollback = () => {
    if (!target) return;

    startTransition(async () => {
      const result = await rollbackVersionAction(questionnaireId, target.id);
      setTarget(null);

      if (!result.ok) {
        setErrorMessage(result.message);
        return;
      }

      /*
       * **界面上的草稿要跟着换掉**（用户复测：回滚后那道题还在，问卷看起来完全没变）。
       * 服务端确实已经退回去了，但 `revalidatePath` 只能换页面 props，
       * 换不掉画布读的那份 `useState`；不换的话，用户接着按保存还会把旧结构写回去。
       */
      applyServerStructure(result.structure);
      setOpen(false);
      toast({
        title: result.message,
        description: '「当前」已移到这一版，历史记录没有增减',
        variant: 'success',
      });
    });
  };

  return (
    <>
      <Button variant="outline" size="sm" onClick={openDrawer}>
        历史版本
      </Button>

      <Drawer
        open={open}
        onOpenChange={(next) => {
          if (next) setOpen(true);
          else closeDrawer();
        }}
      >
        <DrawerContent
          title="版本历史"
          description={`共 ${history.versions.length} 个版本`}
          widthClassName="max-w-[440px]"
        >
          <div className="flex-1 overflow-y-auto px-5 py-4">
            {rolledBackTo !== null ? <RollbackBanner version={rolledBackTo} dirty={dirty} /> : null}

            {errorMessage ? (
              <p
                // 失败用 alert（读屏会立刻打断），成功才用 status
                role="alert"
                className="mb-3 rounded-lg bg-rose-50 px-3 py-2 text-[12.5px] leading-5 text-rose-700"
              >
                {errorMessage}
              </p>
            ) : null}

            <ol className="space-y-1">
              {history.versions.map((version) => (
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
                      {version.summary}
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

                  {/*
                    右侧竖排：「回滚」在上，「预览」在下（用户指定的位置）。
                    两个动作**等宽**（`w-16` + 文字居中）：先前一个用 Button 的 px-3.5、
                    另一个用 px-2，右边缘对齐但文字中心对不齐 —— 看起来就是「歪了」。
                    没有「回滚」的行（当前版本 / 只读）用等高占位撑住，让每行的「预览」
                    都落在同一条水平线上。
                  */}
                  <span className="flex w-16 shrink-0 flex-col items-stretch gap-0.5">
                    {!readOnly && !version.isCurrent ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full px-0"
                        onClick={() => setTarget(version)}
                      >
                        回滚
                      </Button>
                    ) : (
                      <span className="h-8" aria-hidden="true" />
                    )}
                    <button
                      type="button"
                      onClick={() => openPreview(version)}
                      className="text-brand-500 hover:text-brand-600 hover:bg-brand-50 flex h-8 w-full items-center justify-center rounded-lg text-[12px] font-medium transition-colors duration-150"
                    >
                      预览
                    </button>
                  </span>
                </li>
              ))}
            </ol>

            {history.versions.length === 0 ? (
              <p className="text-ink-400 text-[12.5px] leading-5">
                还没有版本。每次保存（结构确有变化时）都会留一条快照；回滚不会新增记录。
              </p>
            ) : null}
          </div>
        </DrawerContent>
      </Drawer>

      {/*
        预览：抽屉里只能看到「修改自 vN · 共 M 道题」，而用户要判断的是
        「这一版的题目是不是我想回去的那份」—— 所以给他看真的题目，而不是再猜一次文案。
      */}
      <Modal open={preview !== null} onOpenChange={(next) => (next ? undefined : closePreview())}>
        <ModalContent
          title={preview ? `预览 ${formatVersion(preview.version)}` : '预览'}
          description="历史版本，只读 —— 确认之后可以把「当前」回滚到这一版"
          width="lg"
          footer={
            <>
              <Button variant="outline" onClick={closePreview}>
                关闭
              </Button>
              <Button
                disabled={readOnly || previewPending || !previewData?.ok}
                onClick={() => {
                  const row = preview;
                  closePreview();
                  if (row) setTarget(row);
                }}
              >
                回滚到这一版
              </Button>
            </>
          }
        >
          {previewPending ? (
            <p className="text-ink-400 py-6 text-center text-[12.5px]">正在读取这一版的结构…</p>
          ) : !previewData ? null : previewData.ok ? (
            <div className="space-y-5">
              <div className="border-ink-100 border-b pb-4">
                <div className="text-ink-900 text-[15px] font-semibold">
                  {previewData.preview.title || '未命名问卷'}
                </div>
                {previewData.preview.intro ? (
                  <p className="text-ink-500 mt-1.5 text-[12.5px] leading-5 whitespace-pre-wrap">
                    {previewData.preview.intro}
                  </p>
                ) : null}
                <p className="text-ink-400 mt-2 text-[11.5px]">
                  {previewData.preview.questions.length} 题
                </p>
              </div>

              {previewData.preview.questions.length === 0 ? (
                <p className="text-ink-400 py-4 text-center text-[12.5px]">
                  这一版没有题目 —— 回滚过去会得到一份空问卷。
                </p>
              ) : (
                <QuestionPreviewList questions={previewData.preview.questions} />
              )}
            </div>
          ) : (
            <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-[12.5px] text-rose-700">
              {previewData.message}
            </p>
          )}
        </ModalContent>
      </Modal>

      <Modal open={target !== null} onOpenChange={() => setTarget(null)}>
        <ModalContent
          title={`回滚到 ${target ? formatVersion(target.version) : ''}？`}
          description="会用这一版的结构覆盖当前草稿"
          width="sm"
        >
          <p className="text-ink-600 text-[12.5px] leading-5">
            当前未保存的改动会丢失。「当前」会移到这一版，
            <b className="text-ink-800">历史版本一个都不会删</b>
            ，回滚本身也不会新增记录 —— 之后再回滚到别的版本一样可以。
          </p>

          {/* 保存还在路上时不让回滚：那笔保存带的是回滚前的结构，落地后会把回滚结果又覆盖掉 */}
          {state === 'saving' ? (
            <p className="mt-2 text-[12px] leading-5 text-amber-700">
              正在保存当前草稿 —— 等这次保存结束后再回滚，否则它会把回滚结果覆盖回去。
            </p>
          ) : null}

          <div className="mt-4 flex gap-2.5">
            <Button variant="outline" className="flex-1" onClick={() => setTarget(null)}>
              取消
            </Button>
            <Button
              loading={pending}
              className="flex-1"
              disabled={pending || state === 'saving'}
              onClick={rollback}
            >
              {pending ? '回滚中…' : '确认回滚'}
            </Button>
          </div>
        </ModalContent>
      </Modal>
    </>
  );
}

/**
 * 「已回滚到 vN」。
 *
 * 状态而不是回执：只要指针还停在旧版本上，它就一直在（关掉抽屉再打开也在）；
 * 一旦用户编辑（`dirty`）或保存出新版本，它的条件就不成立了。
 *
 * 文案只留一句（用户复测）：「当前问卷就是这一版」「再保存一次就会生成 v3」都是废话 ——
 * 前者是同一句话换个说法，后者是界面上本来就能看见的事。唯一保留的补充是改了还没存，
 * 因为那时的内容**已经不等于 vN 了**，不说就是撒谎。
 */
function RollbackBanner({ version, dirty }: { version: number; dirty: boolean }) {
  return (
    <p
      role="status"
      className={cn(
        'mb-3 rounded-lg px-3 py-2 text-[12.5px] leading-5',
        dirty ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700',
      )}
    >
      {dirty
        ? `已回滚到 ${formatVersion(version)}，当前有未保存的修改`
        : `已回滚到 ${formatVersion(version)}`}
    </p>
  );
}
