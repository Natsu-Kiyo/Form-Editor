'use client';

import { useState } from 'react';

import { AlertCircleIcon } from '@/components/icons/ui-icons';
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
import { QUESTION_TYPE_LABEL, UPCOMING_BADGE, type QuestionType } from '@/config/constants';

import type { DraftQuestion, EditableQuestionType } from './editor-draft';
import { useEditorDraft } from './editor-draft';

const EDITABLE_TYPES = (Object.keys(QUESTION_TYPE_LABEL) as QuestionType[]).filter(
  (type): type is Exclude<QuestionType, 'MATRIX'> => type !== 'MATRIX',
);

/**
 * 右栏：题目属性（设计稿 W03 右侧面板）。
 *
 * 所有控件都写**本地草稿**，顶栏按一次「保存」才落库 —— 所以没有防抖、没有失败态，
 * 也天然可以整段反悔（顶栏「放弃修改」）。
 *
 * 「逻辑」与「外观」按 B 级规范灰显：`disabled` + 角标 + 一行说明。
 */
export function PropertyPanel({
  question,
  readOnly,
}: {
  question: DraftQuestion | null;
  readOnly: boolean;
}) {
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
        <span className="text-brand-500 border-brand-500 -mb-px flex h-11 items-center border-b-2 px-3 text-[13px] font-medium">
          题目属性
        </span>
        <button
          type="button"
          disabled
          title={`条件跳转属 ${UPCOMING_BADGE.V11} 规划，本版本不开放`}
          className="text-ink-500 flex h-11 items-center gap-1.5 px-3 text-[13px] font-medium disabled:cursor-not-allowed"
        >
          逻辑
          <span className="bg-ink-100 text-ink-400 rounded px-1 text-[9px]">
            {UPCOMING_BADGE.V11}
          </span>
        </button>
        <button
          type="button"
          disabled
          title={`主题与外观属 ${UPCOMING_BADGE.V20} 规划，本版本不开放`}
          className="text-ink-500 flex h-11 items-center gap-1.5 px-3 text-[13px] font-medium disabled:cursor-not-allowed"
        >
          外观
          <span className="bg-ink-100 text-ink-400 rounded px-1 text-[9px]">
            {UPCOMING_BADGE.V20}
          </span>
        </button>
      </div>

      <div className="space-y-5 p-4">
        <QuestionTypeField question={question} readOnly={readOnly} />
        <QuestionTitleField question={question} readOnly={readOnly} />

        {question.type === 'RATING' ? (
          <ScoreRangeField question={question} readOnly={readOnly} />
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

        <div className="border-ink-100 border-t pt-4">
          <div className="mb-2 flex items-center gap-1.5">
            <span className="text-ink-500 text-[11.5px] font-medium">条件跳转</span>
            <span className="bg-ink-100 text-ink-400 rounded px-1 text-[9px]">
              {UPCOMING_BADGE.V11} 上线
            </span>
          </div>
          <div className="bg-ink-50 border-ink-200 text-ink-400 rounded-[10px] border border-dashed p-3 text-[11.5px] leading-5">
            选择某个选项后跳转到指定题目。下一版本开放。
          </div>
        </div>

        {!readOnly ? (
          <div className="border-ink-100 border-t pt-4">
            <DeleteQuestionButton question={question} />
          </div>
        ) : null}
      </div>
    </aside>
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
  const min = question.config.min ?? 1;
  const max = question.config.max ?? 5;

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
            if (next >= max) return false;
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
            if (next <= min) return false;
            updateQuestion(question.key, { config: { ...question.config, max: next } });
            return true;
          }}
        />
      </div>
      <p className="text-caption text-ink-400 mt-1.5">最大值要大于最小值</p>
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
