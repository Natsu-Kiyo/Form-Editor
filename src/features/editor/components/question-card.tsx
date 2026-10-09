'use client';

import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCorners,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { useRef, useState } from 'react';

import { GripIcon, TrashIcon } from '@/components/icons/ui-icons';
import { QUESTION_TYPE_LABEL, RATING_SCALE, ratingBounds } from '@/config/constants';
import { cn } from '@/utils/cn';

import type { DraftQuestion } from './editor-draft';
import { useEditorDraft } from './editor-draft';

function isChoiceType(type: DraftQuestion['type']) {
  return type === 'SINGLE' || type === 'MULTI' || type === 'DROPDOWN';
}

function buildSummary(question: DraftQuestion) {
  const parts: string[] = [QUESTION_TYPE_LABEL[question.type]];

  if (question.type === 'RATING') {
    // 与刻度用同一个来源：摘要上写的范围必须和下面画出来的方块数量一致
    const { min, max } = ratingBounds(question.config);
    parts[0] = `${QUESTION_TYPE_LABEL.RATING} ${min}–${max}`;
  }

  parts.push(question.required ? '必填' : '选填');

  return parts;
}

/**
 * 一张题目卡（设计稿 W03 画布），整卡可拖拽排序。
 *
 * 卡上的文案输入**直接写本地草稿**（受控输入），不发请求 —— 保存由顶栏那一个按钮统一做。
 * 拖拽手柄窄屏同样可用（dnd-kit 的指针传感器长按即拖），两端共用这一份手柄。
 */
export function QuestionCard({
  question,
  index,
  selected,
  readOnly,
  onSelect,
}: {
  question: DraftQuestion;
  index: number;
  selected: boolean;
  readOnly: boolean;
  onSelect: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: question.key, disabled: readOnly });

  const summary = buildSummary(question);
  const isChoice = isChoiceType(question.type);

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: transform ? `translate3d(0, ${Math.round(transform.y)}px, 0)` : undefined,
        transition,
      }}
      role="group"
      aria-label={`第 ${index + 1} 题：${question.title}`}
      onClick={onSelect}
      onFocusCapture={onSelect}
      className={cn(
        'relative rounded-xl border bg-white p-5 transition-colors duration-150',
        isDragging ? 'shadow-pop z-10 opacity-70' : null,
        selected
          ? 'border-brand-500 ring-brand-500/10 border-2 ring-[3px]'
          : 'border-ink-200 cursor-default',
      )}
    >
      {selected ? (
        <span className="bg-brand-500 absolute -top-2.5 left-5 flex h-5 items-center rounded-full px-2 text-[10px] font-medium text-white">
          正在编辑
        </span>
      ) : null}

      <div className="flex items-start gap-3">
        {!readOnly ? (
          <button
            ref={setActivatorNodeRef}
            type="button"
            {...attributes}
            {...listeners}
            aria-label={`拖动第 ${index + 1} 题`}
            // `touch-none` 是触摸端能拖的前提：否则浏览器会把这次手势当成滚动，
            // dnd-kit 收不到移动事件（表现就是「长按也没反应」）
            className="text-ink-300 hover:text-ink-500 -ml-1 shrink-0 cursor-grab touch-none pt-1 transition-colors duration-150 active:cursor-grabbing"
          >
            <GripIcon className="size-3.5" />
          </button>
        ) : null}

        <div className="min-w-0 flex-1">
          <div className="mb-3 flex items-start gap-3">
            <span
              className={cn(
                'shrink-0 pt-0.5 font-mono text-[13px]',
                selected ? 'text-brand-500' : 'text-ink-400',
              )}
            >
              Q{index + 1}
            </span>

            <div className="min-w-0 flex-1">
              <div className="text-ink-900 mb-1 text-[14.5px] font-medium">
                {question.title.trim() || '未命名题目'}
              </div>
              <div className="text-ink-400 text-[12px]">
                {summary.map((part, partIndex) => (
                  <span key={part}>
                    {partIndex > 0 ? ' · ' : null}
                    {part}
                  </span>
                ))}
                {question.shuffleOptions && isChoice ? (
                  <>
                    {' · '}
                    <span className="text-brand-500">选项随机</span>
                  </>
                ) : null}
              </div>
            </div>

            {/* 窄屏：`›` 是「点开属性弹层」的提示（P08-a）；桌面没有它，因为右栏一直visible */}
            <span className="text-ink-300 mt-0.5 shrink-0 text-[15px] lg:hidden" aria-hidden="true">
              ›
            </span>
          </div>

          {isChoice ? (
            <OptionList question={question} readOnly={readOnly} />
          ) : question.type === 'RATING' ? (
            // 网格而不是 flex 行：flex 会把放不下的方块**压窄**（固定宽高也扛不住 shrink），
            // 网格则让它换到下一行 —— 每行 5 个，6–10 分正好两行
            <div
              className="grid gap-2 pl-8"
              style={{
                width: `calc(${RATING_SCALE.PER_ROW} * 2.5rem + ${RATING_SCALE.PER_ROW - 1} * 0.5rem)`,
                gridTemplateColumns: `repeat(${RATING_SCALE.PER_ROW}, 2.5rem)`,
              }}
            >
              {scoreRange(question).map((score) => (
                <span
                  key={score}
                  className="border-ink-200 text-ink-500 flex size-10 items-center justify-center rounded-[10px] border font-mono text-[14px]"
                >
                  {score}
                </span>
              ))}
            </div>
          ) : (
            <div className="pl-8">
              <div className="border-ink-200 bg-ink-50 text-ink-400 flex h-9 items-center rounded-lg border border-dashed px-3 text-[12.5px]">
                {previewText(question)}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function scoreRange(question: DraftQuestion) {
  const { min, max } = ratingBounds(question.config);

  return Array.from({ length: Math.max(0, max - min + 1) }, (_, index) => min + index);
}

function previewText(question: DraftQuestion) {
  if (question.type === 'DATE') return '日期选择';

  const maxLength = question.config.maxLength;
  const base = question.type === 'SHORT_TEXT' ? '单行文本输入' : '多行文本输入';

  return maxLength ? `${base} · 最多 ${maxLength} 字` : base;
}

/** 选项列表。内层再开一个 DndContext：手柄在哪个 context 里，拖动就归谁处理 */
function OptionList({ question, readOnly }: { question: DraftQuestion; readOnly: boolean }) {
  const { addOption, reorderOptions } = useEditorDraft();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
    /*
     * 触摸端**长按才拖**，与题目卡那一层同一条规矩（设计稿 P08-a：「长按拖拽排序」）。
     * 只有指针传感器时，手机上这次手势会被浏览器当成滚动吃掉 —— 表现就是「拖不动」。
     * 手柄上还配了 `touch-none`，两者缺一不可。
     */
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
  );

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const order = question.options.map((option) => option.key);
    const from = order.indexOf(String(active.id));
    const to = order.indexOf(String(over.id));
    if (from === -1 || to === -1) return;

    const next = [...order];
    next.splice(to, 0, ...next.splice(from, 1));
    reorderOptions(question.key, next);
  };

  return (
    <DndContext
      id={`options-${question.key}`}
      sensors={sensors}
      collisionDetection={closestCorners}
      modifiers={[restrictToVerticalAxis]}
      onDragEnd={onDragEnd}
    >
      <SortableContext
        items={question.options.map((option) => option.key)}
        strategy={verticalListSortingStrategy}
      >
        <div className="space-y-2 pl-8">
          {question.options.map((option) => (
            <OptionRow
              key={option.key}
              question={question}
              optionKey={option.key}
              label={option.label}
              readOnly={readOnly}
              canDelete={question.options.length > 1}
            />
          ))}

          {!readOnly ? (
            <button
              type="button"
              onClick={() => addOption(question.key)}
              className="border-ink-300 hover:border-brand-400 flex h-9 w-full items-center gap-2.5 rounded-lg border border-dashed px-3 transition-colors duration-150"
            >
              <span className="size-4 shrink-0" aria-hidden="true" />
              <span className="text-ink-400 text-[13px]">添加选项</span>
            </button>
          ) : null}
        </div>
      </SortableContext>
    </DndContext>
  );
}

/**
 * 一行选项。
 *
 * 输入框是**受控**的（值来自草稿）：改了只动本地状态，不发请求，
 * 所以不需要防抖那一套 —— 网络往返没了，慢的根源也就没了。
 */
function OptionRow({
  question,
  optionKey,
  label,
  readOnly,
  canDelete,
}: {
  question: DraftQuestion;
  optionKey: string;
  label: string;
  readOnly: boolean;
  canDelete: boolean;
}) {
  const { updateOption, removeOption } = useEditorDraft();
  const inputRef = useRef<HTMLInputElement>(null);
  const [focused, setFocused] = useState(false);

  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: optionKey, disabled: readOnly });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: transform ? `translate3d(0, ${Math.round(transform.y)}px, 0)` : undefined,
        transition,
      }}
      className={cn(
        'group border-ink-200 hover:border-brand-300 hover:bg-brand-50/40 flex h-9 items-center gap-2.5 rounded-lg border px-3 transition-colors duration-150',
        isDragging && 'shadow-pop z-10 opacity-70',
      )}
    >
      {!readOnly ? (
        <button
          ref={setActivatorNodeRef}
          type="button"
          {...attributes}
          {...listeners}
          aria-label={`拖动选项「${label}」`}
          // 手柄在桌面是悬浮才显形（不干扰阅读），但 375px 没有 hover 可言 —— 常显，
          // 否则手机上根本看不到这里能拖。`touch-none` 是触摸端拖得动的前提
          className="text-ink-300 hover:text-ink-500 -mr-1 shrink-0 cursor-grab touch-none transition-opacity duration-150 active:cursor-grabbing lg:opacity-0 lg:group-hover:opacity-100 lg:focus-visible:opacity-100"
        >
          <GripIcon className="size-3.5" />
        </button>
      ) : null}

      <span
        className={cn(
          'border-ink-300 size-4 shrink-0 border-[1.5px]',
          question.type === 'SINGLE' ? 'rounded-full' : 'rounded-[5px]',
        )}
        aria-hidden="true"
      />

      <input
        ref={inputRef}
        value={label}
        onChange={(event) => updateOption(question.key, optionKey, event.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => {
          setFocused(false);
          // 失焦时把空白选项补回一个占位文案：选项为空等于这道题有个坏选项
          if (!label.trim()) updateOption(question.key, optionKey, '选项');
        }}
        readOnly={readOnly}
        aria-label="选项文案"
        className={cn('text-ink-700 min-w-0 flex-1 bg-transparent text-[13px] outline-none')}
        data-focused={focused || undefined}
      />

      {!readOnly ? (
        <button
          type="button"
          disabled={!canDelete}
          title={canDelete ? '删除这个选项' : '至少要保留一个选项'}
          aria-label={`删除选项「${label}」`}
          onClick={() => removeOption(question.key, optionKey)}
          className="text-ink-300 shrink-0 opacity-0 transition-all duration-150 group-hover:opacity-100 hover:text-rose-500 focus-visible:text-rose-500 focus-visible:opacity-100 disabled:cursor-not-allowed disabled:opacity-0"
        >
          <TrashIcon className="size-3.5" />
        </button>
      ) : null}
    </div>
  );
}
