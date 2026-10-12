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

import { GripIcon, PlusIcon, TrashIcon } from '@/components/icons/ui-icons';
import { MATRIX_LIMITS } from '@/config/constants';
import { duplicateLabels } from '@/lib/questionnaire-structure';
import { cn } from '@/utils/cn';

import type { DraftQuestion } from './editor-draft';
import { nextFreeOptionLabel, optionUnit, useEditorDraft } from './editor-draft';

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
   * 重名提示。判据直接从 `@/lib/questionnaire-structure` 取 —— 与保存时那道闸门
   * 用同一个函数，界面上标红的东西一定就是保存会被拦下的东西（R92 · N7）。
   */
  const duplicated = duplicateLabels(question.options.map((option) => option.label));

  // 到上限就不给加了 —— 与「删到下限不给删」同一条规矩，比加了再被 schema 拒好
  const canAdd = !isMatrix || question.options.length < MATRIX_LIMITS.MAX_ROWS;
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
              variant={variant}
            />
          ))}

          {!readOnly && canAdd ? (
            <button
              type="button"
              onClick={() => addOption(question.key)}
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
  variant,
}: {
  question: DraftQuestion;
  optionKey: string;
  label: string;
  index: number;
  readOnly: boolean;
  canDelete: boolean;
  duplicated: boolean;
  variant: 'canvas' | 'panel';
}) {
  const { updateOption, removeOption } = useEditorDraft();
  const isPanel = variant === 'panel';
  const unit = optionUnit(question.type);

  const inputName = isPanel ? `${unit} ${index + 1}` : `${unit}文案`;
  const dragName = isPanel ? `拖动第 ${index + 1} 个${unit}` : `拖动${unit}「${label}」`;
  const deleteName = isPanel ? `删除第 ${index + 1} 个${unit}` : `删除${unit}「${label}」`;

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
        onChange={(event) => updateOption(question.key, optionKey, event.target.value)}
        onBlur={() => {
          // 失焦时把空白项补回一个占位文案：空着等于这道题有个坏选项（矩阵则是坏行）。
          // 占位文案要避开已有的名字 —— 把两格都清空再依次失焦，就是一次真实的撞名
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
