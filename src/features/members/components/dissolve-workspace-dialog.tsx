'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { AlertTriangleIcon } from '@/components/icons/ui-icons';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Modal, ModalContent } from '@/components/ui/modal';
import { useToast } from '@/components/ui/toast';
import { DISSOLVE_CONFIRM_TEXT } from '@/config/constants';

import { dissolveWorkspaceAction } from '../actions/dissolve-workspace';

/**
 * 「解散工作区」的二次确认（入口只在所有者自己那一行）。
 *
 * 比其它危险弹窗（删除问卷 / 移除成员 / 撤回邀请）**刻意更重**：
 * - **要手写确认文字**：它是全站唯一一个"一条语句删掉一大片数据"的动作 ——
 *   问卷、答卷、模板、成员关系与操作日志全部级联消失，与删一份问卷不在同一量级；
 * - **把会没掉的东西列出来**（而不是只说「不可撤销」）：人得知道自己在删什么；
 * - 确认文字**前后端各判一次**：这里「输入对了才可点」只是即时反馈，不是安全边界。
 *
 * 失败走 action 的返回值、toast 报出来；成功后 `router.push('/app')` ——
 * 此刻活跃工作区已经在服务端换好了（见 `landAfterWorkspaceGone`），列表页拿到的是新工作区。
 */
export function DissolveWorkspaceDialog({
  open,
  onOpenChange,
  workspaceName,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceName: string;
}) {
  const router = useRouter();
  const [confirmText, setConfirmText] = useState('');
  const [pending, startTransition] = useTransition();
  const { toast } = useToast();

  const matched = confirmText.trim() === DISSOLVE_CONFIRM_TEXT;

  const submit = () => {
    startTransition(async () => {
      const result = await dissolveWorkspaceAction(confirmText);

      if (!result.ok) {
        toast({ title: '没有解散', description: result.message, variant: 'error' });
        return;
      }

      router.push('/app');
    });
  };

  return (
    <Modal
      open={open}
      onOpenChange={(next) => {
        // 处理中不给关（关掉了也拦不住服务端那一次，只会让人以为取消了）
        if (pending) return;
        if (!next) setConfirmText('');
        onOpenChange(next);
      }}
    >
      <ModalContent title="确定解散这个工作区？" hideTitle width="sm" className="p-6">
        <div className="mb-4 flex size-11 items-center justify-center rounded-xl bg-rose-50">
          <AlertTriangleIcon className="size-5 text-rose-500" />
        </div>

        <h3 className="text-ink-900 mb-2 text-[16px] font-semibold">确定解散这个工作区？</h3>
        <p className="text-ink-500 mb-5 text-[12.5px] leading-5">
          解散「{workspaceName}」会<b className="text-ink-700">永久删除</b>
          它的全部数据，此操作不可撤销。
        </p>

        <div className="bg-ink-50 border-ink-100 mb-5 rounded-[10px] border p-3">
          <div className="text-ink-500 text-[11.5px] leading-5">
            会一起没掉的：所有问卷与答卷、模板、成员关系与操作日志。成员的账号还在
            （他们自己创建的工作区不受影响），但都失去对这份数据的访问。
          </div>
        </div>

        <div className="mb-5">
          <Label htmlFor="dissolve-confirm" className="mb-1.5 block text-[12px]">
            输入「{DISSOLVE_CONFIRM_TEXT}」以确认
          </Label>
          <Input
            id="dissolve-confirm"
            value={confirmText}
            onChange={(event) => setConfirmText(event.target.value)}
            placeholder={DISSOLVE_CONFIRM_TEXT}
            autoComplete="off"
            disabled={pending}
          />
        </div>

        <div className="flex gap-2.5">
          <Button
            variant="outline"
            className="flex-1"
            disabled={pending}
            onClick={() => {
              setConfirmText('');
              onOpenChange(false);
            }}
          >
            取消
          </Button>
          <Button
            variant="danger"
            className="flex-1"
            disabled={!matched || pending}
            loading={pending}
            onClick={submit}
          >
            确认解散
          </Button>
        </div>
      </ModalContent>
    </Modal>
  );
}
