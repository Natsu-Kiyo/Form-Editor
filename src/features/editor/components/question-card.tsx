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
import { MATRIX_LIMITS, QUESTION_TYPE_LABEL, RATING_SCALE, ratingBounds } from '@/config/constants';
import { hasOptionList } from '@/lib/questionnaire-structure';
import { cn } from '@/utils/cn';

import type { DraftQuestion } from './editor-draft';
import { draftMatrixColumns, useEditorDraft } from './editor-draft';

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

  if (question.type === 'MATRIX') {
    // 行列数是这道题最要紧的两个参数（R62）：行可能很长，画布上数不过来。
    // 列数用**草稿原值**：正在清空的那一格仍然算一列（用过滤后的会当场少一列）
    parts[0] = `${QUESTION_TYPE_LABEL.MATRIX} ${question.options.length} 行 × ${draftMatrixColumns(question.config).length} 列`;
  }

  // 条件块里的题：摘要把这件事说出来，否则画布上只有块首那一行条件条在解释
  if (question.showIf) parts.push('条件显示');

  parts.push(question.required ? '必填' : '选填');

  return parts;
}

/** 两份显示条件是不是「同一个块」：依赖同一道题、命中同一组选项（与勾选顺序无关） */
function sameShowIf(a: DraftQuestion['showIf'], b: DraftQuestion['showIf']) {
  if (!a || !b) return false;
  if (a.dependsOnKey !== b.dependsOnKey) return false;

  return (
    a.options.length === b.options.length && a.options.every((item) => b.options.includes(item))
  );
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

  const { questions } = useEditorDraft();

  const summary = buildSummary(question);
  const isChoice = isChoiceType(question.type);

  /*
   * 条件块（R65）：块 = 连续的、条件相同的题。
   * 画布上的呈现刻意**不做真容器**（那会让 dnd-kit 变成跨组拖拽）：
   * - 块首那张卡里加一行条件说明；
   * - 块内每张卡左侧画一条品牌色竖线（伪元素，不动布局、不与选中态的边框打架）。
   */
  const showIf = question.showIf;
  const previousShowIf = index > 0 ? questions[index - 1]?.showIf : null;
  const isBlockStart = showIf !== null && !sameShowIf(previousShowIf, showIf);
  const dependsOn = showIf ? questions.find((item) => item.key === showIf.dependsOnKey) : undefined;

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
        showIf &&
          'before:bg-brand-300 before:absolute before:top-4 before:bottom-4 before:-left-[2px] before:w-[3px] before:rounded-full before:content-[""]',
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

      {isBlockStart ? (
        <div className="border-brand-100 bg-brand-50 text-brand-700 mb-3 rounded-lg border px-3 py-2 text-[11.5px] leading-5">
          当 Q{(dependsOn ? questions.indexOf(dependsOn) : 0) + 1}「
          {dependsOn?.title.trim() || '已删除的题目'}」选了「{showIf.options.join(' / ')}」时显示
        </div>
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

          {hasOptionList(question.type) ? (
            <>
              {/* 矩阵的列在右栏改（行在下面直接改，与选项一致），但它长什么样得在画布上看得见 */}
              {question.type === 'MATRIX' ? <MatrixColumnPreview question={question} /> : null}
              <OptionList question={question} readOnly={readOnly} />
            </>
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

/** 矩阵列的只读预览（画布上）；编辑在右栏，见 `property-panel.tsx` 的 `MatrixColumnsField` */
function MatrixColumnPreview({ question }: { question: DraftQuestion }) {
  /*
   * 用草稿原值（含正在清空的那一格），空列显示成 `…` —— 与右栏那个空白输入框对应。
   * 若用读取侧的 `matrixColumns()`（过滤空串），清空一格会让预览里那一列也消失，
   * 坐实「清空 = 删列」的错觉（这正是 R62 修掉的那个 bug 的观感来源）。
   */
  const columns = draftMatrixColumns(question.config).map((column) => column.trim() || '…');

  return (
    <div className="mb-2 flex items-center gap-2 pl-8 text-[12px]">
      <span className="text-ink-500 shrink-0">列</span>
      <span className="text-ink-400 truncate">
        {columns.length > 0 ? columns.join(' · ') : '（还没有列，在右栏添加）'}
      </span>
    </div>
  );
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
  // 矩阵题的这份列表是「行」：下限 2（一格不叫矩阵）、上限 10
  const isMatrix = question.type === 'MATRIX';

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
              canDelete={question.options.length > (isMatrix ? MATRIX_LIMITS.MIN_ROWS : 1)}
            />
          ))}

          {/* 到上限就不给加了 —— 与「删到下限不给删」同一条规矩，比加了再被 schema 拒好 */}
          {!readOnly && (!isMatrix || question.options.length < MATRIX_LIMITS.MAX_ROWS) ? (
            <button
              type="button"
              onClick={() => addOption(question.key)}
              className="border-ink-300 hover:border-brand-400 flex h-9 w-full items-center gap-2.5 rounded-lg border border-dashed px-3 transition-colors duration-150"
            >
              <span className="size-4 shrink-0" aria-hidden="true" />
              <span className="text-ink-400 text-[13px]">{isMatrix ? '添加行' : '添加选项'}</span>
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
  // 矩阵题这一行是「行」，其余题型是「选项」—— 文案跟着走，无障碍名称才不会说错
  const unit = question.type === 'MATRIX' ? '行' : '选项';

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
          aria-label={`拖动${unit}「${label}」`}
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
          // 圆点 = 单选语义（SINGLE 与矩阵的每一行都是「选一个」）
          question.type === 'SINGLE' || question.type === 'MATRIX'
            ? 'rounded-full'
            : 'rounded-[5px]',
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
          // 失焦时把空白项补回一个占位文案：空着等于这道题有个坏选项（矩阵则是坏行）
          if (!label.trim()) updateOption(question.key, optionKey, unit);
        }}
        readOnly={readOnly}
        aria-label={`${unit}文案`}
        className={cn('text-ink-700 min-w-0 flex-1 bg-transparent text-[13px] outline-none')}
        data-focused={focused || undefined}
      />

      {!readOnly ? (
        <button
          type="button"
          disabled={!canDelete}
          title={
            canDelete
              ? `删除这个${unit}`
              : question.type === 'MATRIX'
                ? `至少要保留 ${MATRIX_LIMITS.MIN_ROWS} 行`
                : '至少要保留一个选项'
          }
          aria-label={`删除${unit}「${label}」`}
          onClick={() => removeOption(question.key, optionKey)}
          className="text-ink-300 shrink-0 opacity-0 transition-all duration-150 group-hover:opacity-100 hover:text-rose-500 focus-visible:text-rose-500 focus-visible:opacity-100 disabled:cursor-not-allowed disabled:opacity-0"
        >
          <TrashIcon className="size-3.5" />
        </button>
      ) : null}
    </div>
  );
}
