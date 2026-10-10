'use client';

import { useActionState, useEffect, useState, useTransition } from 'react';

import { AlertTriangleIcon, DotsIcon, TrashIcon } from '@/components/icons/ui-icons';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Label } from '@/components/ui/label';
import { Modal, ModalContent } from '@/components/ui/modal';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/toast';
import { TEMPLATE_PUBLIC_CATEGORIES } from '@/config/constants';
import { EMPTY_FORM_STATE } from '@/types/form-state';

import { toggleTemplateFavoriteAction } from '../actions/favorite-template';
import {
  deleteTemplateAction,
  publishTemplateAction,
  renameTemplateAction,
  unpublishTemplateAction,
} from '../actions/manage-template';
import { TEMPLATE_PUBLIC_LIMIT } from '../lib/template-publish';

/**
 * 「我的模板」卡右上角的「⋯」（设计稿 W11「列表项更多菜单 · 我的模板卡」）。
 *
 * X2 起四项都是真的（此前「设为公开 / 收藏」是 B 级灰显）：
 * **设为公开 / 取消公开**（ADMIN，权限矩阵「公开模板到公开池」一行）、
 * **收藏 / 取消收藏**（VIEWER 起）、重命名 / 删除（EDITOR）。
 *
 * 三处刻意的处理：
 * - 菜单项按权限**不渲染**（与问卷卡「⋯」同一条规矩：看不到无权入口，
 *   而不是给一个点了报错的按钮）；
 * - **取消公开不加二次确认**：它不是破坏性动作（重新公开即恢复），
 *   而「垃圾撤得回、误操作有退路」正是这个功能敢开放的前提；
 * - 公开的弹层要**顺便补齐描述与分类**：模板创建后没有编辑它们的入口，
 *   而公开池要求一段像样的说明与一个公开分类 —— 没有这个弹层，
 *   早先另存出来的模板就永远公开不了（门槛把人领进死路比没有门槛更糟）。
 *   其中**描述预填、分类不预选**：R59 起所有者要求分类必须由人明确选一次
 *   （不预选就不会出现「没看清就点了确认」把分类带错的情况）。
 */
export function TemplateActionsMenu({
  templateId,
  title,
  description,
  isPublic,
  isFavorited,
  canPublish,
}: {
  templateId: string;
  title: string;
  /** 公开弹层预填：模板当前的说明（分类刻意不传，见上） */
  description: string;
  /** 当前是否在公开池里（决定菜单文案：设为公开 / 取消公开） */
  isPublic: boolean;
  isFavorited: boolean;
  /** 公开 / 取消公开 = ADMIN（权限矩阵那一行，界面与 action 各拦一次） */
  canPublish: boolean;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [dialog, setDialog] = useState<'publish' | 'rename' | 'delete' | null>(null);
  const [pending, startTransition] = useTransition();
  const { toast } = useToast();

  const unpublish = () => {
    setMenuOpen(false);
    startTransition(async () => {
      const result = await unpublishTemplateAction(templateId);
      if (!result.ok) {
        toast({ title: '取消公开失败', description: result.message, variant: 'error' });
        return;
      }
      toast({ title: '已取消公开', description: `「${title}」已从公开池移除`, variant: 'success' });
    });
  };

  const toggleFavorite = () => {
    setMenuOpen(false);
    startTransition(async () => {
      const result = await toggleTemplateFavoriteAction(templateId, !isFavorited);
      if (!result.ok) {
        toast({ title: '操作失败', description: result.message, variant: 'error' });
        return;
      }
      toast({
        title: isFavorited ? '已取消收藏' : '已收藏',
        description: `「${title}」`,
        variant: 'success',
      });
    });
  };

  return (
    <>
      <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label={`更多操作「${title}」`}
            // 与星标同规格：窄屏 36px（触控友好），桌面 28px
            className="border-ink-200 text-ink-500 hover:text-ink-900 flex size-9 items-center justify-center rounded-md border bg-white/90 shadow-sm transition-colors duration-150 hover:bg-white lg:size-7"
          >
            <DotsIcon className="size-4" />
          </button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" className="w-44">
          {/* 设计稿 W11 的顺序：设为公开 / 收藏 / 重命名 / 删除 */}
          {canPublish ? (
            isPublic ? (
              <DropdownMenuItem disabled={pending} onSelect={unpublish}>
                取消公开
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem onSelect={() => setDialog('publish')}>设为公开</DropdownMenuItem>
            )
          ) : null}

          <DropdownMenuItem onSelect={toggleFavorite}>
            {isFavorited ? '取消收藏' : '收藏'}
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          <DropdownMenuItem onSelect={() => setDialog('rename')}>重命名</DropdownMenuItem>

          <DropdownMenuSeparator />

          <DropdownMenuItem icon={<TrashIcon />} tone="danger" onSelect={() => setDialog('delete')}>
            删除模板
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {dialog === 'publish' ? (
        <PublishTemplateDialog
          templateId={templateId}
          title={title}
          defaultDescription={description}
          onClose={() => setDialog(null)}
        />
      ) : null}

      {dialog === 'rename' ? (
        <RenameTemplateDialog
          templateId={templateId}
          title={title}
          onClose={() => setDialog(null)}
        />
      ) : null}

      {dialog === 'delete' ? (
        <DeleteTemplateDialog
          templateId={templateId}
          title={title}
          onClose={() => setDialog(null)}
        />
      ) : null}
    </>
  );
}

/**
 * 设为公开（X2）。
 *
 * 描述与分类在这里就地补齐；配额 / 题数 / 分类这些规则由服务端的
 * `canPublishTemplate` 与 schema 最终把关（界面只是把字段摆出来）。
 */
function PublishTemplateDialog({
  templateId,
  title,
  defaultDescription,
  onClose,
}: {
  templateId: string;
  title: string;
  /** 预填的模板说明（分类刻意不预填，见文件顶部说明） */
  defaultDescription: string;
  onClose: () => void;
}) {
  const [state, formAction, pending] = useActionState(publishTemplateAction, EMPTY_FORM_STATE);

  /*
   * 分类**不预选**（R59 起所有者要求）：初始为空，必须由人明确选一次。
   * 选中项在渲染时派生（用户选过 → 用他的；提交出错 → 用服务端回填的），
   * 而不是在 effect 里补 setState —— 与「另存为模板」同一套处理。
   */
  const [picked, setPicked] = useState<string | null>(null);
  const category = picked || state.values?.category || '';

  useEffect(() => {
    if (state.success) onClose();
  }, [state.success, onClose]);

  return (
    <Modal open onOpenChange={(next) => !next && onClose()}>
      <ModalContent
        title="设为公开"
        description={`「${title}」公开后，其他工作区能在「公开模板」里看到并使用它。`}
        width="sm"
      >
        <form action={formAction} className="space-y-4" noValidate>
          <input type="hidden" name="templateId" value={templateId} />

          <div className="bg-ink-50 border-ink-100 text-ink-500 rounded-[10px] border p-3 text-[11.5px] leading-5">
            每个工作区最多公开 {TEMPLATE_PUBLIC_LIMIT}{' '}
            张；公开的模板需要一段像样的说明，并自行选择一个公开分类（官方五类之外的选「其他」）。
            <b className="text-ink-700 font-medium">可随时取消公开</b>
            —— 取消后其他工作区就看不到它了，已经用它建出来的问卷不受影响。
          </div>

          <div>
            <Label htmlFor="publish-template-description" required>
              模板说明
            </Label>
            <Textarea
              id="publish-template-description"
              name="description"
              rows={3}
              defaultValue={state.values?.description ?? defaultDescription}
              invalid={Boolean(state.fieldErrors?.description)}
              placeholder="一句话说明这个模板适用什么场景（会展示给所有人）"
              required
            />
            {state.fieldErrors?.description ? (
              <p className="text-caption mt-1.5 text-rose-500">
                {state.fieldErrors.description.join('，')}
              </p>
            ) : null}
          </div>

          <div>
            <Label htmlFor="publish-template-category" required>
              模板分类
            </Label>
            <Select name="category" value={category} onValueChange={setPicked}>
              <SelectTrigger
                id="publish-template-category"
                invalid={Boolean(state.fieldErrors?.category)}
              >
                <SelectValue placeholder="选择一个官方分类" />
              </SelectTrigger>
              <SelectContent>
                {TEMPLATE_PUBLIC_CATEGORIES.map((item) => (
                  <SelectItem key={item} value={item}>
                    {item}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {state.fieldErrors?.category ? (
              <p className="text-caption mt-1.5 text-rose-500">
                {state.fieldErrors.category.join('，')}
              </p>
            ) : null}
          </div>

          {state.message ? <p className="text-caption text-rose-500">{state.message}</p> : null}

          <div className="flex gap-2.5">
            <Button type="button" variant="outline" className="flex-1" onClick={onClose}>
              取消
            </Button>
            <Button loading={pending} type="submit" className="flex-1" disabled={pending}>
              {pending ? '公开中…' : '确认公开'}
            </Button>
          </div>
        </form>
      </ModalContent>
    </Modal>
  );
}

function RenameTemplateDialog({
  templateId,
  title,
  onClose,
}: {
  templateId: string;
  title: string;
  onClose: () => void;
}) {
  const [state, formAction, pending] = useActionState(renameTemplateAction, {});

  // 成功后自动关闭：与「另存为模板」弹层同一条约定。
  // 不关的话，用户会盯着一个「已经保存成功」的表单，不知道还要不要再点一次。
  useEffect(() => {
    if (state.success) onClose();
  }, [state.success, onClose]);

  return (
    <Modal open onOpenChange={(next) => !next && onClose()}>
      <ModalContent title="重命名模板" description={`当前名称：${title}`} width="sm">
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="templateId" value={templateId} />

          <div>
            <label
              htmlFor="template-title"
              className="text-ink-500 mb-1.5 block text-[11.5px] font-medium"
            >
              模板名称
            </label>
            <input
              id="template-title"
              name="title"
              required
              defaultValue={state.values?.title ?? title}
              className="border-ink-200 text-ink-700 focus:border-brand-500 h-10 w-full rounded-[10px] border bg-white px-3 text-[13px] outline-none"
            />
            {state.fieldErrors?.title ? (
              <p className="mt-1.5 text-[11.5px] text-rose-600">{state.fieldErrors.title[0]}</p>
            ) : null}
          </div>

          {state.message ? <p className="text-[12px] text-rose-600">{state.message}</p> : null}

          <div className="flex gap-2.5">
            <Button type="button" variant="outline" className="flex-1" onClick={onClose}>
              取消
            </Button>
            <Button loading={pending} type="submit" className="flex-1" disabled={pending}>
              {pending ? '保存中…' : '保存'}
            </Button>
          </div>
        </form>
      </ModalContent>
    </Modal>
  );
}

/**
 * 删除模板的二次确认（与问卷删除同一套卡）。
 *
 * **成功后不主动关**（R79）：删除请求返回 ≠ 列表已更新 —— 主动关会露出一段
 * 「弹窗没了、卡片还在」（问卷删除那边本地量到约 1.4s），看起来就是「闪了一下」。
 * 这里让弹窗一直停在「删除中…」，等 revalidate 后的新列表落地 —— 卡片卸载，
 * 弹窗随之消失：**两者是同一帧**。等待态由数据落地清除、不用计时器
 * （与答卷详情 R68、问卷删除 R78 是同一条规矩）。
 */
function DeleteTemplateDialog({
  templateId,
  title,
  onClose,
}: {
  templateId: string;
  title: string;
  onClose: () => void;
}) {
  const [pending, startTransition] = useTransition();
  /**
   * 点过「确认删除」之后就一直是真（只有失败才复位）。
   * 它管住的是**成功之后、列表落地之前**那段：那时 transition 的 pending 已经结束
   * （action 返回了），按钮若变回「确认删除」，用户能再点一次。
   */
  const [submitted, setSubmitted] = useState(false);
  const busy = pending || submitted;

  return (
    <Modal
      open
      onOpenChange={(next) => {
        // 删除进行中（含数据落地前的等待）：Esc / 点遮罩都不关 —— 关掉会露出「弹窗没了、卡片还在」
        if (!next && !busy) onClose();
      }}
    >
      {/* 与另外三处危险确认同一套卡（设计稿把它们收在一个样本里） */}
      <ModalContent title="确定删除这个模板？" hideTitle width="sm" className="p-6">
        <div className="mb-4 flex size-11 items-center justify-center rounded-xl bg-rose-50">
          <AlertTriangleIcon className="size-5 text-rose-500" />
        </div>

        <h3 className="text-ink-900 mb-2 text-[16px] font-semibold">确定删除这个模板？</h3>
        <p className="text-ink-500 mb-5 text-[12.5px] leading-5">
          「{title}」将从模板库中删除，此操作不可撤销。
        </p>

        <div className="bg-ink-50 border-ink-100 mb-5 rounded-[10px] border p-3">
          <div className="text-ink-500 text-[11.5px] leading-5">
            <b className="text-ink-700 font-medium">用它创建过的问卷不受影响</b>
            —— 那些问卷是独立的一份，与模板再无关系。
          </div>
        </div>

        <div className="flex gap-2.5">
          <Button variant="outline" className="flex-1" disabled={busy} onClick={onClose}>
            取消
          </Button>
          <Button
            loading={busy}
            variant="danger"
            className="flex-1"
            disabled={busy}
            onClick={() => {
              setSubmitted(true);
              startTransition(async () => {
                try {
                  await deleteTemplateAction(templateId);
                  // 成功后**什么都不做**：等列表落地、卡片卸载、弹窗随之消失（见函数头）
                } catch (error) {
                  // 失败：复位，用户可重试或取消；错误照旧抛出去（不吞）
                  setSubmitted(false);
                  throw error;
                }
              });
            }}
          >
            {busy ? '删除中…' : '确认删除'}
          </Button>
        </div>
      </ModalContent>
    </Modal>
  );
}
