'use client';

import { useState, useTransition } from 'react';

import { StarIcon } from '@/components/icons/ui-icons';
import { Button } from '@/components/ui/button';
import { TEMPLATE_PUBLIC_BADGE, type QuestionType } from '@/config/constants';
import { cn } from '@/utils/cn';

import type { TemplateCardData } from '../api/templates';
import { TemplateActionsMenu } from './template-actions-menu';
import { TemplatePreviewDialog } from './template-preview-dialog';

/**
 * 模板卡（设计稿 W08）。
 *
 * 五处刻意的处理：
 * - **缩略图是现算的骨架**，不是图片：按前四道题的题型画（文本题长条、选项题小方块、
 *   评分题方格），省掉一整套缩略图资源与它们必然的失效问题。
 * - **「使用此模板」不做中间确认**：它在提交里只做一件事 —— 复制一份新问卷。
 *   中间加一层「确定要使用吗」是在问一个用户刚刚已经回答过的问题。
 * - **按钮一律常显**（R64 起，含桌面）：「公开模板」是主 Tab，按钮要 hover 才出现
 *   会让「能不能用」变成要猜的事；「我的模板」卡另有右上角「⋯」（它唯一能改自己的地方）。
 * - **星标（收藏）**：所有卡都有（X2 起「官方 / 公开 / 我的」都能收藏）。
 *   **两端都渲染**：R59 起所有者决定忽略 P07「移动端只做查看 + 使用」的口径 ——
 *   手机上也该能收藏、能管自己的模板，不再用 CSS 把它们藏起来。
 * - **「公开」角标**（设计稿 W08：贴在标题旁）只在非公开池的卡片上显示；
 *   公开池里让位给「来自 X 工作区」的来源行（角标说明状态，来源说明归属，各管一件事）。
 */
export function TemplateCard({
  template,
  onUse,
  using,
  canManage,
  canPublish,
  onToggleFavorite,
  favoritePending,
  showSource = false,
}: {
  template: TemplateCardData;
  /** 用这个模板建一份新问卷（提交按钮自己不做确认，见上） */
  onUse: () => void;
  using: boolean;
  /** 「使用此模板」（创建问卷）与「⋯」（改模板）都要求编辑者；查看者只有「预览」与星标 */
  canManage: boolean;
  /** 「设为公开 / 取消公开」= 管理员（权限矩阵「公开模板到公开池」一行） */
  canPublish: boolean;
  onToggleFavorite: () => void;
  favoritePending: boolean;
  /** 公开池的卡片显示「来自 X 工作区」（透明化：谁公开的一目了然） */
  showSource?: boolean;
}) {
  const [previewOpen, setPreviewOpen] = useState(false);
  const [, startTransition] = useTransition();
  const mine = !template.isOfficial;

  return (
    <div className="group border-ink-200 hover:border-brand-300 hover:shadow-card relative flex flex-col overflow-hidden rounded-xl border bg-white transition-all duration-150">
      <div className="absolute top-2.5 right-2.5 z-10 flex items-center gap-1.5">
        <button
          type="button"
          aria-label={`${template.isFavorited ? '取消收藏' : '收藏'}「${template.title}」`}
          aria-pressed={template.isFavorited}
          disabled={favoritePending}
          onClick={onToggleFavorite}
          // 窄屏 36px（与顶栏铃铛一致，触控友好）；桌面回到 28px（与「⋯」并排不挤标题）
          className="border-ink-200 flex size-9 items-center justify-center rounded-md border bg-white/90 shadow-sm transition-colors duration-150 hover:bg-white disabled:cursor-not-allowed lg:size-7"
        >
          <StarIcon
            filled={template.isFavorited}
            className={cn('size-4', template.isFavorited ? 'text-amber-500' : 'text-ink-500')}
          />
        </button>

        {/*
          「⋯」两端都渲染（R59 起）：P07 原本写「移动端只做查看 + 使用」，
          所有者决定忽略它 —— 手机上同样要能重命名 / 删除 / 公开自己的模板。
        */}
        {mine && canManage ? (
          <TemplateActionsMenu
            templateId={template.id}
            title={template.title}
            description={template.description}
            isPublic={template.isPublic}
            isFavorited={template.isFavorited}
            canPublish={canPublish}
          />
        ) : null}
      </div>

      <TemplateThumbnail types={template.previewTypes} />

      <div className="flex flex-1 flex-col p-4">
        <div className="mb-1 flex items-center gap-1.5">
          <span className="text-ink-900 truncate text-[13.5px] font-medium">{template.title}</span>
          {template.isPublic && !showSource ? (
            <span className="shrink-0 rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium text-emerald-600">
              {TEMPLATE_PUBLIC_BADGE}
            </span>
          ) : null}
        </div>

        {showSource && !template.isOfficial && template.workspaceName ? (
          <div className="text-ink-400 mb-1 text-[11px]">来自 {template.workspaceName}</div>
        ) : null}

        <div className="text-ink-400 flex items-center justify-between text-[11.5px]">
          <span>
            {template.questionCount} 题 · 约 {estimateMinutes(template.questionCount)} 分钟
          </span>
          <span className="font-mono">{template.usageCount} 次使用</span>
        </div>

        {/*
          按钮**一律常显**（R64 起，含桌面）—— 设计稿 W08 让官方卡悬浮才出现，
          但公开池是模板中心的主 Tab，「按钮要 hover 才看得见」会让「能不能用」变成
          要猜的事；与「我的模板」卡统一之后，四类卡（官方 / 公开 / 我的 / 收藏）行为一致。
        */}
        <div className="mt-3 flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="flex-1"
            // 带上标题的可访问名：网格里有八张同形卡，「预览」两个字没法区分是哪一张
            aria-label={`预览「${template.title}」`}
            onClick={() => setPreviewOpen(true)}
          >
            预览
          </Button>
          {canManage ? (
            <Button
              type="button"
              size="sm"
              className="bg-brand-50 text-brand-600 hover:bg-brand-100 flex-1 shadow-none"
              aria-label={`使用此模板「${template.title}」`}
              disabled={using}
              onClick={() => startTransition(onUse)}
            >
              {using ? '创建中…' : '使用此模板'}
            </Button>
          ) : null}
        </div>
      </div>

      <TemplatePreviewDialog
        templateId={template.id}
        title={template.title}
        open={previewOpen}
        onOpenChange={setPreviewOpen}
      />
    </div>
  );
}

/**
 * 抽象骨架。
 *
 * 按题型选形状：文本题画长条（要写东西）、选项题画小方块（要点一个）、
 * 评分题画方格（要打几分）。四道题以内画全，更多就画四条 —— 它只是个缩略图。
 */
function TemplateThumbnail({ types }: { types: QuestionType[] }) {
  const rows = types.length > 0 ? types : (['SHORT_TEXT'] as QuestionType[]);

  return (
    <div className="from-brand-50 to-brand-100 flex h-[120px] flex-col justify-center gap-2.5 bg-gradient-to-br p-4">
      <div className="bg-brand-300 h-2.5 w-20 rounded-full" />

      {rows.map((type, index) => (
        <ThumbnailRow key={index} type={type} />
      ))}
    </div>
  );
}

function ThumbnailRow({ type }: { type: QuestionType }) {
  const bar = 'h-2 rounded-full bg-white/80';

  if (type === 'SINGLE' || type === 'MULTI' || type === 'DROPDOWN') {
    return (
      <div className="flex items-center gap-1.5">
        <div className={cn(bar, 'w-14')} />
        <div className="bg-brand-400 size-2 rounded-sm" />
        <div className={cn(bar, 'w-2.5')} />
      </div>
    );
  }

  if (type === 'RATING') {
    return (
      <div className="flex items-center gap-1.5">
        <div className={cn(bar, 'w-14')} />
        {[0, 1, 2].map((index) => (
          <div key={index} className="bg-brand-400 size-2 rounded-sm" />
        ))}
      </div>
    );
  }

  if (type === 'MATRIX') {
    // 矩阵（R62）：两行「短条 + 三个小圆点」，像一张小表格
    return (
      <div className="flex flex-col gap-1.5">
        {[0, 1].map((index) => (
          <div key={index} className="flex items-center gap-1.5">
            <div className={cn(bar, 'w-10')} />
            {[0, 1, 2].map((dot) => (
              <div key={dot} className="bg-brand-400 size-1.5 rounded-full" />
            ))}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className={cn(bar, 'w-32')} />
      <div className={cn(bar, 'w-24')} />
    </div>
  );
}

/**
 * 「约 N 分钟」。
 *
 * 库里没有时长字段，也不能靠人填 —— 按题数估：**每题约 15 秒**，向上取整到分钟，
 * 且至少 1 分钟。宁可给出一个可解释的估算，也不写死一个数（写死的那种，
 * 20 题和 4 题会显示同一个时长）。
 */
function estimateMinutes(questionCount: number) {
  return Math.max(1, Math.round((questionCount * 15) / 60));
}
