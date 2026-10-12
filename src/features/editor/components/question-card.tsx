'use client';

import { useSortable } from '@dnd-kit/sortable';

import { GripIcon } from '@/components/icons/ui-icons';
import { CharCount } from '@/components/ui/char-count';
import {
  PAYLOAD_LIMITS,
  QUESTION_TYPE_LABEL,
  RATING_SCALE,
  ratingBounds,
} from '@/config/constants';
import { duplicateLabels, hasOptionList } from '@/lib/questionnaire-structure';
import { cn } from '@/utils/cn';

import { draftMatrixColumns, optionUnit } from '../lib/draft-options';

import type { DraftQuestion } from './editor-draft';
import { useEditorDraft } from './editor-draft';
import { DuplicateOptionsNotice, OptionEditor } from './option-editor';

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
 *
 * **桌面内联可编辑、窄屏是预览**（R93）：窄屏点一下卡片就会盖上一层属性弹层
 * （`selectQuestion`），任何内联输入框都拿不到焦点 —— 与其留一排「看着能编辑、
 * 点下去弹出别的东西」的假入口，不如真不渲染（`inlineEditable`），
 * 让窄屏老老实实走「画布看、弹层改」这条形态。两端可改的字段集合仍然完全一致。
 */
export function QuestionCard({
  question,
  index,
  selected,
  readOnly,
  inlineEditable,
  onSelect,
}: {
  question: DraftQuestion;
  index: number;
  selected: boolean;
  readOnly: boolean;
  /** 桌面为 true：题目名与选项直接在画布上改；窄屏为 false（走属性弹层） */
  inlineEditable: boolean;
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

  const { questions, updateQuestion } = useEditorDraft();

  const summary = buildSummary(question);
  const isChoice = isChoiceType(question.type);
  // 只读（已发布 / 无权限）与窄屏都退成纯文本：一个改不动，一个走属性弹层
  const titleEditable = inlineEditable && !readOnly;

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
              {/*
                题目名（R93）：桌面直接是一个下划线输入框 —— 与顶栏「问卷标题」同一个样式，
                于是「在中间改完整道题」成立（标题 + 选项都在画布上）。
                窄屏与只读态仍然是纯文本：前者点一下就该开属性弹层，后者本来就不给改。
              */}
              {titleEditable ? (
                <div className="mb-1 flex items-center gap-2">
                  <input
                    value={question.title}
                    onChange={(event) =>
                      updateQuestion(question.key, { title: event.target.value })
                    }
                    // 上限与 schema 同一份常量（R96）：敲不出存不下的东西
                    maxLength={PAYLOAD_LIMITS.QUESTION_TITLE}
                    placeholder="未命名题目"
                    aria-label={`第 ${index + 1} 题标题`}
                    className="text-ink-900 hover:border-ink-200 focus:border-brand-500 min-w-0 flex-1 border-b border-transparent bg-transparent text-[14.5px] font-medium transition-colors duration-150 outline-none"
                  />
                  {/* 快满 / 到顶时的计数器（R97）：截停不能是静默的 */}
                  <CharCount
                    value={question.title}
                    max={PAYLOAD_LIMITS.QUESTION_TITLE}
                    className="shrink-0"
                  />
                </div>
              ) : (
                <div className="text-ink-900 mb-1 text-[14.5px] font-medium">
                  {question.title.trim() || '未命名题目'}
                </div>
              )}
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
              {/*
                桌面：可编辑的选项列表；窄屏：**只读预览**（同一个组件的 `preview` 形态）。
                窄屏若照旧渲染输入框，用户点上去会先被属性弹层盖住 —— 那是个假入口。
              */}
              {inlineEditable ? (
                <OptionEditor question={question} readOnly={readOnly} variant="canvas" />
              ) : (
                <OptionPreview question={question} readOnly={readOnly} />
              )}
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

/**
 * 选项列表的**只读预览**（窄屏画布）。
 *
 * 与可编辑那份（`option-editor.tsx` 的 `OptionEditor`）外观一致：圆点 / 方框 + 文案。
 * 区别是不渲染输入框、拖拽手柄、删除与「添加」—— 窄屏点卡片会盖上一层属性弹层，
 * 这一层只负责「看得见」，改在弹层里改（那里有同一个编辑器的 `panel` 形态）。
 *
 * 重名照样标出来（描红 + 一句说明）：草稿是从别处带来的旧问题时，
 * 手机上也得知道「这道题存不下去」，而不是等到点保存才发现。
 */
function OptionPreview({ question, readOnly }: { question: DraftQuestion; readOnly: boolean }) {
  const unit = optionUnit(question.type);
  const duplicated = duplicateLabels(question.options.map((option) => option.label));

  return (
    <div className="space-y-2 pl-8">
      {question.options.map((option) => (
        <div
          key={option.key}
          className={cn(
            'border-ink-200 text-ink-700 flex h-9 items-center gap-2.5 rounded-lg border px-3 text-[13px]',
            duplicated.includes(option.label.trim()) && 'border-rose-400',
          )}
        >
          <span
            className={cn(
              'border-ink-300 size-4 shrink-0 border-[1.5px]',
              question.type === 'SINGLE' || question.type === 'MATRIX'
                ? 'rounded-full'
                : 'rounded-[5px]',
            )}
            aria-hidden="true"
          />
          <span className="min-w-0 flex-1 truncate">{option.label}</span>
        </div>
      ))}

      {readOnly ? null : <DuplicateOptionsNotice unit={unit} duplicated={duplicated} />}
    </div>
  );
}
