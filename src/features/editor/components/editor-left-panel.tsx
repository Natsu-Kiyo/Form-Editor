'use client';

import { QUESTION_TYPE_ICON } from '@/components/icons/question-type-icons';
import { PlusIcon } from '@/components/icons/ui-icons';
import { QUESTION_TYPE_LABEL, UPCOMING_BADGE, type QuestionType } from '@/config/constants';
import { cn } from '@/utils/cn';

import type { DraftQuestion } from './editor-draft';
import { useEditorDraft } from './editor-draft';

const TYPE_ORDER: readonly QuestionType[] = [
  'SINGLE',
  'MULTI',
  'SHORT_TEXT',
  'LONG_TEXT',
  'RATING',
  'DROPDOWN',
  'DATE',
  'MATRIX',
];

/** 1.1 才开放的题型：入口保留但灰显，两端都不给点 */
const GREYED_TYPES: readonly QuestionType[] = ['MATRIX'];

/** 左栏：题型面板 + 添加分页 + 题目结构大纲 */
export function EditorLeftPanel({
  questions,
  selectedKey,
  onSelect,
  readOnly,
}: {
  questions: DraftQuestion[];
  selectedKey: string | null;
  onSelect: (key: string) => void;
  readOnly: boolean;
}) {
  const { addQuestion, insertPageBreakAfter, removePageBreakAt } = useEditorDraft();

  const selectedIndex = questions.findIndex((question) => question.key === selectedKey);
  const anchor = selectedIndex >= 0 ? questions[selectedIndex] : questions[0];
  // 分页必须插在两道题之间：最后一题之后没有内容可分
  const canAddPageBreak =
    !readOnly && questions.length >= 2 && anchor != null && selectedIndex < questions.length - 1;

  return (
    <aside className="border-ink-200 w-[236px] shrink-0 overflow-y-auto border-r bg-white p-4">
      <div className="text-ink-400 mb-3 text-[11px] font-semibold tracking-wide">题型</div>

      <div className="grid grid-cols-2 gap-2">
        {TYPE_ORDER.map((type) => {
          const greyed = GREYED_TYPES.includes(type);
          const disabled = greyed || readOnly;
          const Icon = QUESTION_TYPE_ICON[type];

          return (
            <button
              key={type}
              type="button"
              disabled={disabled}
              title={
                greyed
                  ? '矩阵题属 1.1 规划，本版本不开放'
                  : readOnly
                    ? '只读状态不能添加题目'
                    : `添加${QUESTION_TYPE_LABEL[type]}题`
              }
              onClick={() => {
                // 加完立刻选中：用户接着就要改题目文本，不该还要自己去找
                onSelect(addQuestion(type as Exclude<QuestionType, 'MATRIX'>));
              }}
              className={cn(
                'group relative flex h-[62px] flex-col items-center justify-center gap-1.5 rounded-[10px] border transition-all duration-150',
                disabled
                  ? 'border-ink-200 cursor-not-allowed opacity-60'
                  : 'border-ink-200 hover:border-brand-400 hover:bg-brand-50',
              )}
            >
              <Icon
                className={cn(
                  'size-4',
                  disabled ? 'text-ink-400' : 'text-ink-400 group-hover:text-brand-500',
                )}
              />
              <span
                className={cn(
                  'text-[11.5px]',
                  disabled ? 'text-ink-600' : 'text-ink-600 group-hover:text-brand-600',
                )}
              >
                {QUESTION_TYPE_LABEL[type]}
              </span>

              {greyed ? (
                <span className="bg-ink-100 text-ink-400 absolute top-1 right-1 rounded px-1 text-[9px]">
                  {UPCOMING_BADGE.V11}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      <button
        type="button"
        disabled={!canAddPageBreak}
        title={
          readOnly
            ? '只读状态不能改结构'
            : questions.length < 2
              ? '至少要有两道题才能分页'
              : !canAddPageBreak
                ? '分页要插在两道题之间 —— 选中一道非末尾的题再点这里'
                : `在「${anchor?.title.trim() || '未命名题目'}」之后分页`
        }
        onClick={() => {
          if (anchor) insertPageBreakAfter(anchor.key);
        }}
        className={cn(
          'mt-5 flex h-9 w-full items-center justify-center gap-1.5 rounded-[10px] border border-dashed text-[12.5px] transition-all duration-150',
          canAddPageBreak
            ? 'border-ink-300 text-ink-500 hover:border-brand-400 hover:text-brand-500 hover:bg-brand-50'
            : 'border-ink-200 text-ink-300 cursor-not-allowed',
        )}
      >
        <PlusIcon className="size-3.5" />
        添加分页
      </button>

      <div className="border-ink-100 mt-5 border-t pt-4">
        <div className="text-ink-400 mb-3 text-[11px] font-semibold tracking-wide">题目结构</div>

        {questions.length === 0 ? (
          <p className="text-ink-400 px-2.5 text-[11.5px] leading-5">
            还没有题目。点上面的题型就能添加第一道。
          </p>
        ) : (
          <div className="space-y-1">
            {questions.map((question, index) => {
              const active = question.key === selectedKey;
              const previous = questions[index - 1];
              const pageStarts = previous != null && previous.pageIndex !== question.pageIndex;

              return (
                <div key={question.key}>
                  {pageStarts ? (
                    <div className="group text-ink-300 flex items-center gap-2 rounded-md px-2.5 py-1.5 text-[11px]">
                      <span>— 分页 —</span>
                      {!readOnly ? (
                        <button
                          type="button"
                          aria-label={`删除第 ${question.pageIndex} 个分页符`}
                          title="把这个分页并回上一页"
                          onClick={() => removePageBreakAt(question.pageIndex)}
                          className="text-ink-300 ml-auto opacity-0 transition-all duration-150 group-hover:opacity-100 hover:text-rose-500 focus-visible:opacity-100"
                        >
                          删除
                        </button>
                      ) : null}
                    </div>
                  ) : null}

                  <button
                    type="button"
                    onClick={() => onSelect(question.key)}
                    aria-current={active ? 'true' : undefined}
                    className={cn(
                      'flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-[12px] transition-colors duration-150',
                      active
                        ? 'bg-brand-50 text-brand-600 font-medium'
                        : 'text-ink-500 hover:bg-ink-50',
                    )}
                  >
                    <span className={cn('font-mono text-[11px]', active ? '' : 'text-ink-400')}>
                      {index + 1}
                    </span>
                    <span className="truncate">{question.title.trim() || '未命名题目'}</span>
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </aside>
  );
}
