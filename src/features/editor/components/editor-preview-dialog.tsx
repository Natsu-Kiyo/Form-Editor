'use client';

import { QuestionPreviewList } from '@/components/questionnaire/question-preview';
import { Modal, ModalContent } from '@/components/ui/modal';

import { useEditorDraft } from './editor-draft';

/**
 * 编辑器里的「预览」（设计稿 W03 顶栏）。
 *
 * 三处刻意的处理：
 * - **预览的是当前草稿**（含还没保存的改动），并在弹层里写明这一点 ——
 *   用户点预览就是想确认「我刚改的看起来对不对」，给他上次保存的版本没有意义
 * - 渲染用的是 `components/questionnaire/question-preview`，**与模板中心的预览是同一份**：
 *   两处各写一遍必然出现「模板里看到的和编辑里看到的不一样」
 * - 只读：不可填写、不校验必答。真正填写走分享出去的链接
 */
export function EditorPreviewDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { title, questions } = useEditorDraft();

  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <ModalContent title="预览" width="lg">
        {questions.length === 0 ? (
          <p className="text-ink-400 py-8 text-center text-[12.5px]">
            还没有题目。先从题型面板加一道，再回来看它长什么样。
          </p>
        ) : (
          <div className="space-y-5">
            <div className="border-ink-100 border-b pb-4">
              <div className="text-ink-900 text-[15px] font-semibold">{title || '未命名问卷'}</div>
              <p className="text-ink-400 mt-2 text-[11.5px]">{questions.length} 题</p>
            </div>

            <QuestionPreviewList
              questions={questions.map((question) => ({
                type: question.type,
                title: question.title,
                description: question.description,
                required: question.required,
                config: question.config,
                options: question.options.map((option) => option.label),
              }))}
            />
          </div>
        )}
      </ModalContent>
    </Modal>
  );
}
