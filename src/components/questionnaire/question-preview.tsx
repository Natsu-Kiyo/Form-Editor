import {
  QUESTION_TYPE_LABEL,
  matrixColumns,
  ratingBounds,
  type QuestionType,
} from '@/config/constants';
import { cn } from '@/utils/cn';

/**
 * 「这份问卷填起来是什么样」的只读渲染。
 *
 * 放在 `components/questionnaire/` 而不是某个 feature 里：**模板中心的预览**与
 * **编辑器的预览**都要用它（与 `export-responses-dialog` 同一个理由 ——
 * 两处各写一遍必然出现「模板里看到的和编辑里看到的不一样」）。
 *
 * 三条刻意的处理：
 * - **只读**：控件不可交互、不做必答校验。它是「长什么样」的示意图，不是填写入口
 * - 按题型画**真的形状**（选项圈、评分格、填空框），而不是列出题型名称 ——
 *   用户点预览想知道的就是这个
 * - 不引任何交互组件（没有 `'use client'`）：它是纯渲染，两端、两个调用方都能直接用
 */
export type PreviewQuestion = {
  type: QuestionType;
  title: string;
  description?: string | null;
  required?: boolean;
  config?: unknown;
  options?: readonly string[];
};

export function QuestionPreviewList({ questions }: { questions: readonly PreviewQuestion[] }) {
  return (
    <div className="space-y-5">
      {questions.map((question, index) => (
        <div key={index}>
          <div className="text-ink-800 mb-2 text-[13px] font-medium">
            {index + 1}. {question.title || '（未命名题目）'}
            {question.required ? <span className="ml-1 text-rose-500">*</span> : null}
          </div>
          {question.description ? (
            <p className="text-ink-400 mb-2 text-[11.5px]">{question.description}</p>
          ) : null}

          <QuestionPreviewShape
            type={question.type}
            options={question.options ?? []}
            config={question.config}
          />
        </div>
      ))}
    </div>
  );
}

/** 各题型的「长什么样」。一律只读：预览不是填写。 */
function QuestionPreviewShape({
  type,
  options,
  config,
}: {
  type: QuestionType;
  options: readonly string[];
  config: unknown;
}) {
  const bounds = ratingBounds((config ?? {}) as { min?: number; max?: number });
  const readOnlyBox =
    'border-ink-200 text-ink-400 bg-ink-50/60 rounded-[10px] border px-3 h-10 text-[12.5px] flex items-center';

  if (type === 'SINGLE' || type === 'MULTI' || type === 'DROPDOWN') {
    if (options.length === 0) {
      return <p className="text-ink-400 text-[12px]">（还没有选项）</p>;
    }

    return (
      <div className="space-y-1.5">
        {options.map((option) => (
          <div key={option} className="text-ink-600 flex items-center gap-2.5 text-[12.5px]">
            <span
              className={cn(
                'border-ink-300 size-4 shrink-0 border',
                type === 'MULTI' ? 'rounded-[4px]' : 'rounded-full',
              )}
            />
            {option}
          </div>
        ))}
      </div>
    );
  }

  if (type === 'RATING') {
    return (
      <div className="text-ink-400 flex flex-wrap items-center gap-1.5 text-[13px]">
        {Array.from({ length: bounds.max - bounds.min + 1 }, (_, index) => (
          <span
            key={index}
            className="border-ink-300 text-ink-500 flex size-7 items-center justify-center rounded-md border text-[11.5px]"
          >
            {bounds.min + index}
          </span>
        ))}
      </div>
    );
  }

  if (type === 'DATE') return <div className={readOnlyBox}>yyyy-mm-dd</div>;

  if (type === 'MATRIX') {
    const columns = matrixColumns((config ?? {}) as Record<string, unknown>);

    // 行 × 列圆点的只读示意：列名只在表头出现一次，行名每行一个
    return (
      <div className="space-y-1.5">
        <div className="text-ink-400 flex items-center gap-2 text-[10.5px]">
          <span className="w-20 shrink-0" />
          {columns.map((column) => (
            <span key={column} className="w-10 shrink-0 truncate text-center">
              {column}
            </span>
          ))}
        </div>
        {options.map((row) => (
          <div key={row} className="text-ink-600 flex items-center gap-2 text-[12.5px]">
            <span className="w-20 shrink-0 truncate">{row}</span>
            {columns.map((column) => (
              <span key={column} className="flex w-10 shrink-0 justify-center">
                <span className="border-ink-300 size-3.5 rounded-full border" />
              </span>
            ))}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className={cn(readOnlyBox, type === 'LONG_TEXT' && 'h-16 items-start py-2.5')}>
      在此填写…
    </div>
  );
}

/** 题型标签：预览弹层的标题行用 */
export function previewTypeLabel(type: QuestionType) {
  return QUESTION_TYPE_LABEL[type] ?? type;
}
