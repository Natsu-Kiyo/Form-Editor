'use client';

import { useState, useTransition } from 'react';

import { AlertTriangleIcon } from '@/components/icons/ui-icons';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Modal, ModalContent } from '@/components/ui/modal';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/components/ui/toast';
import { ROLE_LABEL, type Role } from '@/config/constants';

import { transferOwnershipAction } from '../actions/transfer-ownership';

type Candidate = { userId: string; name: string; email: string; role: Role };

/**
 * 「转让工作区所有权」的确认弹窗（入口：所有者自己那一行的角色下拉）。
 *
 * 它借用「解散」那套卡的结构（图标区 + 标题 + 说明 + 提示块 + 两枚按钮），
 * 但有两处**刻意不同**：
 * - 图标是 **amber** 而不是 rose：转让不是破坏动作（数据一份不少），
 *   只是"重要且不可随手撤销"—— 换成危险色会把两件事说成一件事；
 * - 手写确认文字换成**继承人下拉**：解散要防的是"手滑删库"，转让要防的是
 *   "转错人"，所以这里的必答项是"转给谁"，不是"证明你知道自己在干什么"。
 *
 * `selfRole` 就是发起人在角色下拉里选的那一档 ⬅ 语义：**选了哪一档，转让后自己就是哪一档**。
 */
export function TransferOwnershipDialog({
  open,
  onOpenChange,
  workspaceName,
  selfRole,
  candidates,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceName: string;
  /** 发起人降级后的角色（= 他在角色下拉里选的那一档） */
  selfRole: Role;
  /** 可继承的成员（已排除发起人自己）；空数组 = 工作区里只有他一个人 */
  candidates: Candidate[];
}) {
  const [nextOwnerUserId, setNextOwnerUserId] = useState('');
  const [pending, startTransition] = useTransition();
  const { toast } = useToast();

  const selected = candidates.find((candidate) => candidate.userId === nextOwnerUserId) ?? null;
  const roleLabel = ROLE_LABEL[selfRole];

  const submit = () => {
    startTransition(async () => {
      const result = await transferOwnershipAction({ nextOwnerUserId, selfRole });

      if (!result.ok) {
        toast({ title: '没有转让', description: result.message, variant: 'error' });
        return;
      }

      onOpenChange(false);
      toast({
        title: '所有权已转让',
        description: `${selected?.name ?? '对方'} 现在是新的所有者，你转为「${roleLabel}」`,
        variant: 'success',
      });
    });
  };

  return (
    <Modal
      open={open}
      onOpenChange={(next) => {
        if (pending) return;
        if (!next) setNextOwnerUserId('');
        onOpenChange(next);
      }}
    >
      <ModalContent title="转让工作区所有权？" hideTitle width="sm" className="p-6">
        <div className="mb-4 flex size-11 items-center justify-center rounded-xl bg-amber-50">
          <AlertTriangleIcon className="size-5 text-amber-500" />
        </div>

        <h3 className="text-ink-900 mb-2 text-[16px] font-semibold">转让工作区所有权？</h3>
        <p className="text-ink-500 mb-5 text-[12.5px] leading-5">
          你将把「{workspaceName}」的所有权交给另一位成员，自己转为
          <b className="text-ink-700">「{roleLabel}」</b>。
        </p>

        <div className="bg-ink-50 border-ink-100 mb-5 rounded-[10px] border p-3">
          <div className="text-ink-500 text-[11.5px] leading-5">
            {candidates.length === 0 ? (
              <>这个工作区里只有你一个人 —— 先邀请一位成员，或者用「解散」结束这个工作区。</>
            ) : (
              <>
                新所有者可以调整成员与角色、也能解散工作区。你仍以「{roleLabel}
                」的身份留在工作区里，随时可以自己退出。
              </>
            )}
          </div>
        </div>

        <div className="mb-5">
          <Label htmlFor="next-owner" className="mb-1.5 block text-[12px]">
            选择继承所有者的成员
          </Label>
          <Select
            value={nextOwnerUserId}
            onValueChange={setNextOwnerUserId}
            disabled={pending || candidates.length === 0}
          >
            <SelectTrigger id="next-owner" aria-label="继承所有者的成员" className="h-10 w-full">
              <SelectValue placeholder="选择一位成员" />
            </SelectTrigger>
            <SelectContent>
              {candidates.map((candidate) => (
                <SelectItem key={candidate.userId} value={candidate.userId}>
                  {candidate.name}（{ROLE_LABEL[candidate.role]}）
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex gap-2.5">
          <Button
            variant="outline"
            className="flex-1"
            disabled={pending}
            onClick={() => {
              setNextOwnerUserId('');
              onOpenChange(false);
            }}
          >
            取消
          </Button>
          <Button
            className="flex-1"
            disabled={!selected || pending}
            loading={pending}
            onClick={submit}
          >
            确认转让
          </Button>
        </div>
      </ModalContent>
    </Modal>
  );
}
