'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';

import { AlertTriangleIcon } from '@/components/icons/ui-icons';
import { Button } from '@/components/ui/button';
import { Modal, ModalContent } from '@/components/ui/modal';
import { useToast } from '@/components/ui/toast';

import { leaveWorkspaceAction } from '../actions/leave-workspace';

/**
 * 「退出工作区」的二次确认（入口在自己那一行，所有者的那行是「解散」）。
 *
 * 走与「移除成员」同一套危险确认卡 —— 它和"被移除"对当事人是同一件事
 * （立刻失去全部访问权），分量对齐；只是**发起人不同**，所以文案从
 * 「对方」改成「你」。不需要输入确认文字：退出的人只影响自己，
 * 而且他随时能被重新邀请回来（真正的重动作是解散，见另一个弹窗）。
 */
export function LeaveWorkspaceDialog({
  open,
  onOpenChange,
  workspaceName,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceName: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const { toast } = useToast();

  const submit = () => {
    startTransition(async () => {
      const result = await leaveWorkspaceAction();

      if (!result.ok) {
        toast({ title: '没有退出', description: result.message, variant: 'error' });
        return;
      }

      router.push('/app');
    });
  };

  return (
    <Modal
      open={open}
      onOpenChange={(next) => {
        if (pending) return;
        onOpenChange(next);
      }}
    >
      <ModalContent title="确定退出这个工作区？" hideTitle width="sm" className="p-6">
        <div className="mb-4 flex size-11 items-center justify-center rounded-xl bg-rose-50">
          <AlertTriangleIcon className="size-5 text-rose-500" />
        </div>

        <h3 className="text-ink-900 mb-2 text-[16px] font-semibold">确定退出这个工作区？</h3>
        <p className="text-ink-500 mb-5 text-[12.5px] leading-5">
          退出「{workspaceName}」后，你将立刻失去对其中问卷与数据的访问。
        </p>

        <div className="bg-ink-50 border-ink-100 mb-5 rounded-[10px] border p-3">
          <div className="text-ink-500 text-[11.5px] leading-5">
            要重新加入需要新的邀请链接；你的账号与你自己创建的工作区不受影响。
          </div>
        </div>

        <div className="flex gap-2.5">
          <Button
            variant="outline"
            className="flex-1"
            disabled={pending}
            onClick={() => onOpenChange(false)}
          >
            取消
          </Button>
          <Button
            variant="danger"
            className="flex-1"
            disabled={pending}
            loading={pending}
            onClick={submit}
          >
            确认退出
          </Button>
        </div>
      </ModalContent>
    </Modal>
  );
}
