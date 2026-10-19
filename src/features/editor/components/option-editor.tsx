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

import { useState } from 'react';

import { GripIcon, PlusIcon, TrashIcon } from '@/components/icons/ui-icons';
import { CharCount } from '@/components/ui/char-count';
import { MATRIX_LIMITS, PAYLOAD_LIMITS, QUESTIONNAIRE_LIMITS } from '@/config/constants';
import { duplicateLabels } from '@/lib/questionnaire-structure';
import { cn } from '@/utils/cn';

import { nextFreeOptionLabel, optionUnit } from '../lib/draft-options';

import type { DraftQuestion } from './editor-draft';
import { useEditorDraft } from './editor-draft';

/**
 * 选项列表编辑器：选择题的「选项」与矩阵题的「行」（两者结构同构，共用一套编辑）。
 *
 * **一处实现、两个入口**（R93）：
 * - `variant="canvas"` —— 画布上缩进在题目里那串（桌面用，看得见、直接改）；
 * - `variant="panel"` —— 属性面板里的紧凑版。桌面右栏与**窄屏属性弹层是同一块面板**，
 *   所以窄屏到这里才第一次有了改选项的地方。
 *
 * 窄屏为什么必须有它：窄屏的画布是**预览 + 点开弹层**的形态，点题卡会打开属性弹层
 * （`editor-workspace` 的 `selectQuestion`），画布上那排输入框根本拿不到焦点 ——
 * 于是「改选项」在手机上是一个不存在的操作。换句话说，这个字段的归属不是「右栏」，
 * 而是「那块两端共用的面板」。
 *
 * 不发明新交互：增删改排序与画布上那份完全一致（同一套 dnd-kit 手势、同一套占位文案、
 * 同一套重名判据）。两者唯一的差别是排版密度与**无障碍名称**（见 `OptionRow`）。
 */
export function OptionEditor({
  question,
  readOnly,
  variant,
}: {
  question: DraftQuestion;
  readOnly: boolean;
  variant: 'canvas' | 'panel';
}) {
  const { addOption, reorderOptions } = useEditorDraft();
  const isMatrix = question.type === 'MATRIX';
  const unit = optionUnit(question.type);
  const isPanel = variant === 'panel';

  /*
   * 刚添加的那一项 —— 空文案的新选项出现后**焦点要直接落上去**（R94）：
   * 用户点「新增选项」的意图就是「敲字」，不该先删一遍占位文案。
   *
   * 状态放在**每个入口自己身上**（画布与面板各有一份 `OptionEditor`），
   * 于是「在哪儿点的新增，焦点就落在哪儿」是天然的 —— 不需要知道另一个入口在哪。
   * 用 `autoFocus` 而不是 effect + ref：它只在挂载那一刻生效，正好是「这一格刚出现」。
   */
  const [focusKey, setFocusKey] = useState<string | null>(null);

  /*
   * 重名提示。判据直接从 `@/lib/questionnaire-structure` 取 —— 与保存时那道闸门
   * 用同一个函数，界面上标红的东西一定就是保存会被拦下的东西（R92 · N7）。
   */
  const duplicated = duplicateLabels(question.options.map((option) => option.label));

  /*
   * 到上限就不给加了 —— 与「删到下限不给删」同一条规矩，比加了再被 schema 拒好。
   * 选择题 10 个、矩阵行 10 个（审查 #15），两个上限都来自 constants，与写入闸门同源。
   */
  const maxOptions = isMatrix
    ? MATRIX_LIMITS.MAX_ROWS
    : QUESTIONNAIRE_LIMITS.MAX_OPTIONS_PER_CHOICE;
  const canAdd = question.options.length < maxOptions;
  const canDelete = question.options.length > (isMatrix ? MATRIX_LIMITS.MIN_ROWS : 1);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
    // 触摸端长按才拖（与题目卡同一条规矩）：没有它，手机上的手势会先被滚动吃掉
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
      // id 里带上入口名：桌面页面上两个列表同时存在，DndContext 的 id 也要能区分
      id={`${variant}-options-${question.key}`}
      sensors={sensors}
      collisionDetection={closestCorners}
      modifiers={[restrictToVerticalAxis]}
      onDragEnd={onDragEnd}
    >
      <SortableContext
        items={question.options.map((option) => option.key)}
        strategy={verticalListSortingStrategy}
      >
        <div className={cn('space-y-2', !isPanel && 'pl-8')}>
          {question.options.map((option, index) => (
            <OptionRow
              key={option.key}
              question={question}
              optionKey={option.key}
              label={option.label}
              index={index}
              readOnly={readOnly}
              canDelete={canDelete}
              duplicated={duplicated.includes(option.label.trim())}
              autoFocus={option.key === focusKey}
              variant={variant}
            />
          ))}

          {!readOnly && canAdd ? (
            <button
              type="button"
              onClick={() => setFocusKey(addOption(question.key))}
              className={cn(
                'border-ink-300 hover:border-brand-400 flex h-9 w-full items-center gap-2.5 rounded-lg border border-dashed px-3 transition-colors duration-150',
                isPanel && 'text-ink-400 justify-center gap-1.5',
              )}
            >
              {isPanel ? (
                <PlusIcon className="size-3.5" />
              ) : (
                <span className="size-4 shrink-0" aria-hidden="true" />
              )}
              <span className="text-[13px]">{isPanel ? `新增${unit}` : `添加${unit}`}</span>
            </button>
          ) : null}

          {/* 只在可编辑时提示 —— 已发布 / 只读的问卷改不了，说了也没用 */}
          {!readOnly ? <DuplicateOptionsNotice unit={unit} duplicated={duplicated} /> : null}
        </div>
      </SortableContext>
    </DndContext>
  );
}

/**
 * 选项重名提示（R92 · N7）。**说清后果**而不只是「不能重名」：
 * 作答结果里存的就是选项文案，两个同名项在统计里分不开。
 *
 * 三处渲染都是这一句（画布可编辑列表 / 属性面板 / 窄屏只读预览）——
 * 文案只有这一份，免得同一条规矩在不同地方说法不同。
 */
export function DuplicateOptionsNotice({
  unit,
  duplicated,
}: {
  unit: string;
  duplicated: string[];
}) {
  if (duplicated.length === 0) return null;

  return (
    <p role="alert" className="text-caption text-rose-600">
      有{unit}重名（{duplicated.map((label) => `「${label}」`).join('、')}
      ）：作答结果按文案记录，同名会让两份答案混在一起，保存也会被拦下
    </p>
  );
}

/**
 * 这一格「空着离开」时会变成什么（只给占位提示用）。
 *
 * 逐格往后排：**上面**那些同样空着的格子会先被补上，于是这一格显示的是**下一个**编号 ——
 * 否则两格同时空着会都显示「选项 3」，看着像要撞名（真到补位时是逐格重算的，不会撞）。
 * 纯观感：真值由 `nextFreeOptionLabel` 在失焦那一刻算（R9-4）。
 */
function placeholderFor(question: DraftQuestion, index: number) {
  const unit = optionUnit(question.type);
  const taken = question.options.map((option) => option.label);

  // 把这一格之前的空格按顺序补上，轮到自己时编号才是对的
  for (let position = 0; position < index; position += 1) {
    if (taken[position]!.trim()) continue;
    taken[position] = nextFreeOptionLabel(unit, taken);
  }

  return nextFreeOptionLabel(unit, taken);
}

/**
 * 一行选项（矩阵题则是「一行」）。
 *
 * **无障碍名称按入口区分**：桌面上画布与右栏会同时出现这两份列表，
 * 若都叫「选项文案」「添加选项」，读屏用户与自动化都无法指认要操作哪一个
 * （`getByRole` 是子串匹配，重名会直接撞成 strict mode violation）。
 * 画布那份沿用「选项文案 / 添加选项」（既有用例与既有习惯都指着它），
 * 面板那份用带序号的「选项 N / 新增选项」。
 */
function OptionRow({
  question,
  optionKey,
  label,
  index,
  readOnly,
  canDelete,
  duplicated,
  autoFocus,
  variant,
}: {
  question: DraftQuestion;
  optionKey: string;
  label: string;
  index: number;
  readOnly: boolean;
  canDelete: boolean;
  duplicated: boolean;
  /** 刚被添加的那一格：挂载即聚焦（见 OptionEditor 的 focusKey） */
  autoFocus: boolean;
  variant: 'canvas' | 'panel';
}) {
  const { updateOption, removeOption } = useEditorDraft();
  const isPanel = variant === 'panel';
  const unit = optionUnit(question.type);

  /*
   * 读屏名里引用文案时，**空文案回落到序号**（R9-3）：新增的那一格还没输，
   * `拖动选项「」` / `删除选项「」` 念出来等于没说。
   */
  const spoken = label.trim() || `${unit} ${index + 1}`;

  const inputName = isPanel ? `${unit} ${index + 1}` : `${unit}文案`;
  const dragName = isPanel ? `拖动第 ${index + 1} 个${unit}` : `拖动${unit}「${spoken}」`;
  const deleteName = isPanel ? `删除第 ${index + 1} 个${unit}` : `删除${unit}「${spoken}」`;

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
        // 重名：整行描红（与列表下方那句提示同一件事的两个层次：哪一行 / 为什么）
        duplicated && 'border-rose-400 hover:border-rose-400',
        isDragging && 'shadow-pop z-10 opacity-70',
      )}
    >
      {!readOnly ? (
        <button
          ref={setActivatorNodeRef}
          type="button"
          {...attributes}
          {...listeners}
          aria-label={dragName}
          // 画布上桌面端悬浮才显形（不干扰阅读），但 375px 没有 hover 可言 —— 常显；
          // 面板里是专门的编辑器，也常显。`touch-none` 是触摸端拖得动的前提
          className={cn(
            'text-ink-300 hover:text-ink-500 -mr-1 shrink-0 cursor-grab touch-none transition-opacity duration-150 active:cursor-grabbing',
            !isPanel && 'lg:opacity-0 lg:group-hover:opacity-100 lg:focus-visible:opacity-100',
          )}
        >
          <GripIcon className="size-3.5" />
        </button>
      ) : null}

      {/* 画布上画出「单选圆点 / 多选方框」，与作答页一致；面板里是紧凑编辑器，省掉它 */}
      {isPanel ? null : (
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
      )}

      <input
        value={label}
        autoFocus={autoFocus}
        // 上限与 schema 同一份常量（R96）：选项写长了存不上，是最容易撞的一处
        maxLength={PAYLOAD_LIMITS.OPTION_LABEL}
        /*
         * 占位提示：空着的那一格就这么离开时，会变成这个名字（失焦补位 / 保存兜底）。
         * 没有它，「新增后是空框」与「空框会自己变成『选项 3』」都无从预期。
         */
        placeholder={placeholderFor(question, index)}
        onChange={(event) => updateOption(question.key, optionKey, event.target.value)}
        onBlur={() => {
          // 失焦时把空白项补回一个占位文案：空着等于这道题有个坏选项（矩阵则是坏行）。
          // 占位文案要避开已有的名字 —— 把两格都清空再依次失焦，就是一次真实的撞名。
          // （保存那一侧另有一道兜底：光标没离开输入框就按 Ctrl+S 时不会失焦，
          //   见 editor-draft 的 fillOptionLabels）
          if (!label.trim()) {
            updateOption(
              question.key,
              optionKey,
              nextFreeOptionLabel(
                unit,
                question.options.map((option) => option.label),
              ),
            );
          }
        }}
        readOnly={readOnly}
        aria-invalid={duplicated || undefined}
        title={duplicated ? `有另一个${unit}也叫「${label.trim()}」` : undefined}
        aria-label={inputName}
        className="text-ink-700 min-w-0 flex-1 bg-transparent text-[13px] outline-none"
      />

      {/* 快满 / 到顶时的计数器（R97）：截停不能是静默的 —— 用户会以为自己写全了 */}
      <CharCount value={label} max={PAYLOAD_LIMITS.OPTION_LABEL} className="shrink-0" />

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
          aria-label={deleteName}
          onClick={() => removeOption(question.key, optionKey)}
          className={cn(
            'text-ink-300 shrink-0 transition-all duration-150 hover:text-rose-500 disabled:cursor-not-allowed',
            isPanel
              ? 'disabled:opacity-40'
              : 'opacity-0 group-hover:opacity-100 focus-visible:text-rose-500 focus-visible:opacity-100 disabled:opacity-0',
          )}
        >
          <TrashIcon className="size-3.5" />
        </button>
      ) : null}
    </div>
  );
}
