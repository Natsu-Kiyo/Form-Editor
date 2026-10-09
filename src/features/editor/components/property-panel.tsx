'use client';

import { useState } from 'react';

import { AlertCircleIcon, PlusIcon, TrashIcon } from '@/components/icons/ui-icons';
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
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import {
  MATRIX_LIMITS,
  QUESTION_TYPE_LABEL,
  RATING_SCALE,
  SHOW_IF_SOURCE_TYPES,
  ratingBounds,
  type QuestionType,
} from '@/config/constants';
import { cn } from '@/utils/cn';

import type { DraftQuestion, EditableQuestionType } from './editor-draft';
import { draftMatrixColumns, useEditorDraft } from './editor-draft';

/** 题目类型下拉的全部选项。R62 起 8 个题型全开放（顺序 = 常量里的定义顺序） */
const EDITABLE_TYPES = Object.keys(QUESTION_TYPE_LABEL) as QuestionType[];

/**
 * 右栏：题目属性（设计稿 W03 右侧面板）。
 *
 * 所有控件都写**本地草稿**，顶栏按一次「保存」才落库 —— 所以没有防抖、没有失败态，
 * 也天然可以整段反悔（顶栏「放弃修改」）。
 *
 * 两个 Tab 都是真实现：题目属性、逻辑（R65 起 = 条件显示）。
 * 「外观」原是本面板的第三个 Tab（灰显 2.0 占位），**R74 起决定不做、入口已移除**。
 */
export function PropertyPanel({
  question,
  readOnly,
}: {
  question: DraftQuestion | null;
  readOnly: boolean;
}) {
  // 切题时**保留当前 Tab**：连着一串题配条件的场景里，每次切题都弹回「题目属性」很烦
  const [tab, setTab] = useState<'basic' | 'logic'>('basic');

  if (!question) {
    return (
      <aside className="border-ink-200 w-[288px] shrink-0 border-l bg-white p-4">
        <p className="text-ink-400 text-[12px] leading-5">
          选中左侧画布上的任意一道题，这里会显示它的属性。
        </p>
      </aside>
    );
  }

  const isChoice =
    question.type === 'SINGLE' || question.type === 'MULTI' || question.type === 'DROPDOWN';
  const isText = question.type === 'SHORT_TEXT' || question.type === 'LONG_TEXT';

  return (
    <aside className="border-ink-200 w-[288px] shrink-0 overflow-y-auto border-l bg-white">
      <div className="border-ink-200 flex border-b px-4">
        <PanelTab active={tab === 'basic'} onClick={() => setTab('basic')}>
          题目属性
        </PanelTab>
        <PanelTab active={tab === 'logic'} onClick={() => setTab('logic')}>
          逻辑
        </PanelTab>
      </div>

      {tab === 'logic' ? (
        <div className="space-y-5 p-4">
          <ShowIfField question={question} readOnly={readOnly} />
        </div>
      ) : (
        <div className="space-y-5 p-4">
          <QuestionTypeField question={question} readOnly={readOnly} />
          <QuestionTitleField question={question} readOnly={readOnly} />

          {question.type === 'RATING' ? (
            <ScoreRangeField question={question} readOnly={readOnly} />
          ) : null}

          {question.type === 'MATRIX' ? (
            <MatrixColumnsField question={question} readOnly={readOnly} />
          ) : null}

          {isText ? <MaxLengthField question={question} readOnly={readOnly} /> : null}

          <div className="border-ink-100 space-y-3.5 border-t pt-4">
            <SwitchRow
              label="必填"
              hint="未作答不允许提交"
              checked={question.required}
              disabled={readOnly}
              onChange={(required) => ({ required })}
              question={question}
            />
            <SwitchRow
              label="选项随机排序"
              hint={isChoice ? '仅选择题可用' : '当前题型不可用'}
              checked={question.shuffleOptions && isChoice}
              disabled={readOnly || !isChoice}
              onChange={(shuffleOptions) => ({ shuffleOptions })}
              question={question}
            />
          </div>

          {!readOnly ? (
            <div className="border-ink-100 border-t pt-4">
              <DeleteQuestionButton question={question} />
            </div>
          ) : null}
        </div>
      )}
    </aside>
  );
}

/** 右栏的 Tab。与模板页的 TabButton 同款式：激活态用品牌色下划线 */
function PanelTab({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      className={cn(
        '-mb-px flex h-11 items-center gap-1.5 border-b-2 px-3 text-[13px] font-medium transition-colors duration-150',
        active
          ? 'border-brand-500 text-brand-500'
          : 'text-ink-500 hover:text-ink-800 border-transparent',
      )}
    >
      {children}
    </button>
  );
}

/**
 * 显示条件（R65）：`当 [前面的某题] 选择了 [选项…] 时显示本题`。
 *
 * 四处刻意的处理：
 * - **下拉里只列本题之前的选择类题** —— 条件只能向前看，环路与求值顺序问题
 *   在配置阶段就不存在；
 * - 打开开关时默认引用「上一个可引用的题」+ 它的第一个选项：一次点击就得到一个
 *   能用的条件，而不是给个空壳让用户从零选起；
 * - 已选项**至少留一个**（最后一个不给取消）：空条件等于这道题永远不显示，
 *   与「选项删到下限不给删」同一条规矩（payload schema 也会再拦一次）；
 * - 同条件的连续题在画布上算一个**条件块**（见 question-card），块内加题自动继承条件。
 */
function ShowIfField({ question, readOnly }: { question: DraftQuestion; readOnly: boolean }) {
  const { questions, updateQuestion } = useEditorDraft();

  const index = questions.findIndex((item) => item.key === question.key);
  // 可引用的题：**排在本题之前**的选择类题（有选项才谈得上命中）
  const sources = questions
    .slice(0, index)
    .filter((item) => SHOW_IF_SOURCE_TYPES.includes(item.type));

  const { showIf } = question;
  const dependsOn = showIf ? sources.find((item) => item.key === showIf.dependsOnKey) : undefined;

  /** 换依赖题时用它做默认选中：第一个选项（选项文案都为空时给空数组，由 schema 兜底） */
  const firstOption = (source: DraftQuestion | undefined) =>
    source?.options[0]?.label ? [source.options[0].label] : [];

  const toggleOption = (label: string) => {
    if (!showIf) return;

    // 允许勾到 0 个（中间态）：用户配条件最常见的一步就是「先取消默认勾上的那个，再勾想要的」，
    // 若在这里拦住「最后一个」，那一步就走不通了。空条件的后果由下面的警示与
    // payload schema 的明确报错承担（见 lib/questionnaire-structure）。
    const picked = showIf.options.includes(label)
      ? showIf.options.filter((item) => item !== label)
      : [...showIf.options, label];

    updateQuestion(question.key, { showIf: { ...showIf, options: picked } });
  };

  return (
    <div className="space-y-3.5">
      <SwitchRow
        label="仅满足条件时显示"
        hint="条件不满足时，这道题在作答端不会出现"
        checked={showIf !== null}
        disabled={readOnly || sources.length === 0}
        onChange={(next) => {
          const fallback = sources.at(-1);

          return {
            showIf:
              next && fallback
                ? { dependsOnKey: fallback.key, options: firstOption(fallback) }
                : null,
          };
        }}
        question={question}
      />

      {sources.length === 0 ? (
        <p className="text-caption text-ink-400 leading-5">
          前面还没有可引用的选择类题目（单选 / 多选 / 下拉）—— 显示条件只能指向排在它前面的题。
        </p>
      ) : null}

      {showIf ? (
        <div className="space-y-3.5">
          <div>
            <Label>依赖题目</Label>
            <Select
              value={showIf.dependsOnKey}
              disabled={readOnly}
              onValueChange={(key) => {
                // 换依赖题时重置已选选项（选项文案对不上，留着就是永不满足的条件）
                updateQuestion(question.key, {
                  showIf: {
                    dependsOnKey: key,
                    options: firstOption(sources.find((item) => item.key === key)),
                  },
                });
              }}
            >
              <SelectTrigger aria-label="依赖题目">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {sources.map((item) => (
                  <SelectItem key={item.key} value={item.key}>
                    Q{questions.indexOf(item) + 1} · {item.title.trim() || '未命名题目'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {dependsOn ? (
            <div>
              <Label>命中以下任意选项时显示</Label>
              <div className="space-y-2">
                {dependsOn.options.map((option) => (
                  <label
                    key={option.key}
                    className="flex cursor-pointer items-center gap-2 text-[12.5px]"
                  >
                    <input
                      type="checkbox"
                      checked={showIf.options.includes(option.label)}
                      disabled={readOnly}
                      onChange={() => toggleOption(option.label)}
                      className="accent-brand-500 size-3.5 shrink-0"
                    />
                    <span className="text-ink-700 truncate">{option.label}</span>
                  </label>
                ))}
              </div>

              {showIf.options.length === 0 ? (
                <p className="text-caption mt-2 leading-5 text-rose-500">
                  至少勾选一个选项 —— 一个都不勾的话，这道题永远不会显示。
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function QuestionTypeField({ question, readOnly }: { question: DraftQuestion; readOnly: boolean }) {
  const { updateQuestion } = useEditorDraft();

  return (
    <div>
      <Label>题目类型</Label>
      <Select
        value={question.type}
        disabled={readOnly}
        onValueChange={(type) =>
          updateQuestion(question.key, { type: type as EditableQuestionType })
        }
      >
        <SelectTrigger aria-label="题目类型">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {EDITABLE_TYPES.map((type) => (
            <SelectItem key={type} value={type}>
              {QUESTION_TYPE_LABEL[type]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function QuestionTitleField({
  question,
  readOnly,
}: {
  question: DraftQuestion;
  readOnly: boolean;
}) {
  const { updateQuestion } = useEditorDraft();

  return (
    <div>
      <Label>题目</Label>
      <Textarea
        rows={2}
        value={question.title}
        onChange={(event) => updateQuestion(question.key, { title: event.target.value })}
        readOnly={readOnly}
        aria-label="题目"
      />
    </div>
  );
}

function ScoreRangeField({ question, readOnly }: { question: DraftQuestion; readOnly: boolean }) {
  const { updateQuestion } = useEditorDraft();
  const { min, max } = ratingBounds(question.config);

  return (
    <div>
      <Label>分值范围</Label>
      <div className="flex gap-2">
        <NumberBox
          key={`${question.key}-min`}
          label="最小"
          value={min}
          disabled={readOnly}
          onCommit={(next) => {
            if (next < RATING_SCALE.MIN || next >= max) return false;
            updateQuestion(question.key, { config: { ...question.config, min: next } });
            return true;
          }}
        />
        <NumberBox
          key={`${question.key}-max`}
          label="最大"
          value={max}
          disabled={readOnly}
          onCommit={(next) => {
            // 超出上限的值直接不接受（NumberBox 会把输入框恢复成原值），
            // 否则画布上就会出现一排压扁的窄框
            if (next <= min || next > RATING_SCALE.MAX) return false;
            updateQuestion(question.key, { config: { ...question.config, max: next } });
            return true;
          }}
        />
      </div>
      <p className="text-caption text-ink-400 mt-1.5">
        最大值要大于最小值，且不超过 {RATING_SCALE.MAX}
      </p>
    </div>
  );
}

function MaxLengthField({ question, readOnly }: { question: DraftQuestion; readOnly: boolean }) {
  const { updateQuestion } = useEditorDraft();

  return (
    <div>
      <Label>文本长度上限</Label>
      <NumberBox
        key={`${question.key}-length`}
        label="字数"
        value={question.config.maxLength ?? (question.type === 'SHORT_TEXT' ? 100 : 500)}
        disabled={readOnly}
        onCommit={(next) => {
          updateQuestion(question.key, { config: { ...question.config, maxLength: next } });
          return true;
        }}
      />
    </div>
  );
}

/**
 * 矩阵的列（R62）。
 *
 * **行不在这里** —— 它在画布的题卡上直接改（与选项同一处、同一套列表交互），
 * 这里只管列。列不做拖拽排序：只有 2–5 个、调整顺序的频率远低于选项，
 * 为它引入一套「纯文本数组的稳定拖拽 id」不划算 —— 删了重加就是现成的手段。
 */
function MatrixColumnsField({
  question,
  readOnly,
}: {
  question: DraftQuestion;
  readOnly: boolean;
}) {
  const { updateQuestion } = useEditorDraft();
  // 草稿原值（空串保留）：正在清空的那一格要是被过滤掉，整列就会当场消失
  const columns = draftMatrixColumns(question.config);
  const canDelete = columns.length > MATRIX_LIMITS.MIN_COLUMNS;
  const canAdd = columns.length < MATRIX_LIMITS.MAX_COLUMNS;

  const commit = (next: string[]) =>
    updateQuestion(question.key, { config: { ...question.config, columns: next } });

  return (
    <div>
      <Label>列</Label>
      <div className="space-y-2">
        {columns.map((label, index) => (
          <div
            // key 用「题 + 序号」：列没有稳定 id，而重排/删除都会重建列表 —— 序号足够
            key={`${question.key}-col-${index}`}
            className="border-ink-200 focus-within:border-brand-500 flex h-9 items-center gap-2 rounded-lg border px-3 transition-colors duration-150"
          >
            <input
              value={label}
              maxLength={MATRIX_LIMITS.MAX_COLUMN_LENGTH}
              disabled={readOnly}
              aria-label={`第 ${index + 1} 列`}
              onChange={(event) =>
                commit(
                  columns.map((item, position) => (position === index ? event.target.value : item)),
                )
              }
              onBlur={() => {
                // 空白列补一个占位：与画布上的选项/行同一条规矩，空文案会拖到保存时被 schema 拒
                if (!label.trim()) {
                  commit(
                    columns.map((item, position) =>
                      position === index ? `列 ${index + 1}` : item,
                    ),
                  );
                }
              }}
              className="text-ink-700 w-full min-w-0 bg-transparent text-[13px] outline-none"
            />
            {!readOnly ? (
              <button
                type="button"
                disabled={!canDelete}
                title={canDelete ? '删除这一列' : `至少要保留 ${MATRIX_LIMITS.MIN_COLUMNS} 列`}
                aria-label={`删除第 ${index + 1} 列`}
                onClick={() => commit(columns.filter((_, position) => position !== index))}
                className="text-ink-300 shrink-0 transition-colors duration-150 hover:text-rose-500 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <TrashIcon className="size-3.5" />
              </button>
            ) : null}
          </div>
        ))}

        {!readOnly ? (
          <button
            type="button"
            disabled={!canAdd}
            onClick={() => commit([...columns, `列 ${columns.length + 1}`])}
            className="border-ink-300 hover:border-brand-400 flex h-9 w-full items-center gap-2.5 rounded-lg border border-dashed px-3 transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <PlusIcon className="text-ink-400 size-3.5" />
            <span className="text-ink-400 text-[13px]">添加列</span>
          </button>
        ) : null}
      </div>
      <p className="text-caption text-ink-400 mt-1.5">
        {MATRIX_LIMITS.MIN_COLUMNS}–{MATRIX_LIMITS.MAX_COLUMNS} 列，顺序即横向顺序；行在画布上直接改
      </p>
    </div>
  );
}

/** 返回 false 表示这个值不合法、已退回原值 */
function NumberBox({
  label,
  value,
  disabled,
  onCommit,
}: {
  label: string;
  value: number;
  disabled: boolean;
  onCommit: (value: number) => boolean;
}) {
  // 只在本地保存正在输入的字符串：数字输入框中途会出现 ""、"1." 这类中间态，
  // 直接往草稿里写会把它们当成数字。提交（失焦）时才校验并落草稿。
  // 换题目/切题型时由调用方给的 key 重挂载，值自然跟着走，不需要在这里做同步。
  const [draft, setDraft] = useState(String(value));

  return (
    <div className="border-ink-200 focus-within:border-brand-500 flex h-9 flex-1 items-center justify-between rounded-lg border px-3 transition-colors duration-150">
      <input
        type="number"
        inputMode="numeric"
        value={draft}
        disabled={disabled}
        aria-label={label}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() => {
          const next = Number(draft);

          if (!Number.isInteger(next) || !onCommit(next)) {
            setDraft(String(value));
          }
        }}
        className="text-ink-800 w-full min-w-0 bg-transparent font-mono text-[13px] outline-none"
      />
      <span className="text-ink-400 shrink-0 pl-2 text-[11px]">{label}</span>
    </div>
  );
}

function SwitchRow({
  question,
  label,
  hint,
  checked,
  disabled,
  onChange,
}: {
  question: DraftQuestion;
  label: string;
  hint: string;
  checked: boolean;
  disabled: boolean;
  onChange: (checked: boolean) => Partial<DraftQuestion>;
}) {
  const { updateQuestion } = useEditorDraft();

  return (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <div className="text-ink-700 text-[13px]">{label}</div>
        <div className="text-ink-400 text-[11px]">{hint}</div>
      </div>
      <Switch
        checked={checked}
        disabled={disabled}
        aria-label={label}
        onCheckedChange={(next) => updateQuestion(question.key, onChange(next))}
      />
    </div>
  );
}

function DeleteQuestionButton({ question }: { question: DraftQuestion }) {
  const { removeQuestion } = useEditorDraft();
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-9 w-full items-center justify-center gap-2 rounded-[10px] text-[12.5px] font-medium text-rose-600 transition-colors duration-150 hover:bg-rose-50"
      >
        <AlertCircleIcon className="size-4" />
        删除这道题
      </button>

      <Modal open={open} onOpenChange={setOpen}>
        <ModalContent title="确定删除这道题？" width="sm">
          <p className="text-ink-500 mb-5 text-[12.5px] leading-5">
            「{question.title.trim() || '未命名题目'}」及其选项会从草稿里移除，
            <b className="text-ink-700">保存之后才真正生效</b>。
          </p>
          <div className="flex gap-2.5">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => setOpen(false)}
            >
              取消
            </Button>
            <Button
              type="button"
              variant="danger"
              className="flex-1"
              onClick={() => {
                setOpen(false);
                removeQuestion(question.key);
              }}
            >
              确认删除
            </Button>
          </div>
        </ModalContent>
      </Modal>
    </>
  );
}
