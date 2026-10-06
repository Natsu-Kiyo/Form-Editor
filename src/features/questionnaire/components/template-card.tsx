'use client';

import { useState, useTransition } from 'react';

import { Button } from '@/components/ui/button';
import { QUESTION_TYPE_LABEL, type QuestionType } from '@/config/constants';
import { cn } from '@/utils/cn';

import type { TemplateCardData } from '../api/templates';
import { TemplateActionsMenu } from './template-actions-menu';
import { TemplatePreviewDialog } from './template-preview-dialog';

/**
 * 模板卡（设计稿 W08）。
 *
 * 三处刻意的处理：
 * - **缩略图是现算的骨架**，不是图片：按前四道题的题型画（文本题长条、选项题小方块、
 *   评分题方格），省掉一整套缩略图资源与它们必然的失效问题。
 * - **「使用此模板」不做中间确认**：它在提交里只做一件事 —— 复制一份新问卷。
 *   中间加一层「确定要使用吗」是在问一个用户刚刚已经回答过的问题。
 * - 官方卡的按钮**悬浮才出现**（设计稿如此，让网格更干净）；「我的模板」卡上的
 *   按钮常显 + 右上角有「⋯」—— 那是它唯一能改自己的地方，藏起来就找不到了。
 */
export function TemplateCard({
  template,
  onUse,
  using,
  canManage,
}: {
  template: TemplateCardData;
  /** 用这个模板建一份新问卷（提交按钮自己不做确认，见上） */
  onUse: () => void;
  using: boolean;
  /** 「使用此模板」（创建问卷）与「⋯」（改模板）都要求编辑者；查看者只有「预览」 */
  canManage: boolean;
}) {
  const [previewOpen, setPreviewOpen] = useState(false);
  const [, startTransition] = useTransition();
  const mine = !template.isOfficial;

  return (
    <div className="group border-ink-200 hover:border-brand-300 hover:shadow-card relative flex flex-col overflow-hidden rounded-xl border bg-white transition-all duration-150">
      {mine && canManage ? (
        <div className="absolute top-2.5 right-2.5 z-10">
          <TemplateActionsMenu templateId={template.id} title={template.title} />
        </div>
      ) : null}

      <TemplateThumbnail types={template.previewTypes} />

      <div className="flex flex-1 flex-col p-4">
        <div className="text-ink-900 mb-1 truncate text-[13.5px] font-medium">{template.title}</div>
        <div className="text-ink-400 flex items-center justify-between text-[11.5px]">
          <span>
            {template.questionCount} 题 · 约 {estimateMinutes(template.questionCount)} 分钟
          </span>
          <span className="font-mono">{template.usageCount} 次使用</span>
        </div>

        {/* 官方卡悬浮才显示按钮；我的模板常显（那是它能被操作的地方） */}
        <div
          className={cn(
            'mt-3 flex gap-2 transition-opacity duration-150',
            mine ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 focus-within:opacity-100',
          )}
        >
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
export function estimateMinutes(questionCount: number) {
  return Math.max(1, Math.round((questionCount * 15) / 60));
}

/** 题型标签的展示（预览弹层与卡片共用一句话口径） */
export function typeLabel(type: QuestionType) {
  return QUESTION_TYPE_LABEL[type] ?? type;
}
