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
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { useState } from 'react';

import { FileTextIcon, PlusIcon } from '@/components/icons/ui-icons';
import { EmptyState } from '@/components/ui/empty-state';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { useIsDesktop } from '@/hooks/use-is-desktop';
import { cn } from '@/utils/cn';

import { useEditorDraft } from './editor-draft';
import { EditorPreviewDialog } from './editor-preview-dialog';
import { EditorLeftPanel } from './editor-left-panel';
import { PropertyPanel } from './property-panel';
import { QuestionCard } from './question-card';

/**
 * 编辑器三栏工作区：题型面板 / 画布 / 属性面板。
 *
 * 「当前正在编辑哪道题」是**纯客户端状态**，不进 URL 也不进数据库：
 * 它是视线焦点而不是文档状态，刷新后回到第一题完全可以接受，
 * 而放进 URL 会让每次点选都产生一条历史记录、把后退键毁掉。
 */
export function EditorWorkspace({ readOnly }: { readOnly: boolean }) {
  const { questions, addQuestion, reorderQuestions } = useEditorDraft();
  const [selectedKey, setSelectedKey] = useState<string | null>(questions[0]?.key ?? null);
  /**
   * 窄屏的两个弹层（P08-b / P08-c）。断点显式写 1024：与 Tailwind 的 `lg` 对齐，
   * 否则 768~1023px 会出现「既渲染左栏、又渲染题型按钮」的双份入口。
   */
  const isDesktop = useIsDesktop('(min-width: 1024px)');
  const [typeSheetOpen, setTypeSheetOpen] = useState(false);
  const [propertySheetOpen, setPropertySheetOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  const sensors = useSensors(
    // distance 约束：手柄上的一次「点击」不该被当成拖拽
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
    /*
     * 触摸端**长按才拖**（设计稿 P08-a 原话：「左侧点阵手柄是长按拖拽排序」）。
     * 没有它时指针传感器在手机上会先被页面滚动吃掉，表现就是「题目拖不动」。
     * 手柄上还配了 `touch-none`（见 question-card），两者缺一不可。
     */
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
  );

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const order = questions.map((question) => question.key);
    const from = order.indexOf(String(active.id));
    const to = order.indexOf(String(over.id));
    if (from === -1 || to === -1) return;

    const next = [...order];
    next.splice(to, 0, ...next.splice(from, 1));
    reorderQuestions(next);
  };

  const selected = questions.find((question) => question.key === selectedKey) ?? null;
  const selectedIndex = questions.findIndex((question) => question.key === selectedKey);

  /**
   * 点一道题 = 选中它。窄屏再多做一步：**直接打开属性弹层**
   * （桌面用右栏常驻，窄屏没有右栏，点开才是那个「右栏」）。
   */
  const selectQuestion = (key: string) => {
    setSelectedKey(key);
    if (!isDesktop) setPropertySheetOpen(true);
  };

  return (
    // 桌面是三栏（横排）；窄屏是「画布 + 底部操作条」的纵向两段
    <div className={cn('flex min-h-0 flex-1', !isDesktop && 'flex-col')}>
      {isDesktop ? (
        <EditorLeftPanel
          questions={questions}
          selectedKey={selectedKey}
          onSelect={setSelectedKey}
          readOnly={readOnly}
        />
      ) : null}

      <div className="min-w-0 flex-1 overflow-y-auto p-4 sm:p-7">
        <div className="mx-auto max-w-[620px] space-y-3">
          {questions.length === 0 ? (
            <EmptyState
              icon={<FileTextIcon />}
              title="还没有题目"
              description="从左侧「题型」里点一个，就能添加第一道题"
            />
          ) : (
            <DndContext
              id="questions"
              sensors={sensors}
              // closestCorners 而不是 closestCenter：题目卡很高，用「中心点最近」判断时，
              // 拖起来的卡片中心往往还离自己更近，落点会被判成自己（表现为「拖了没反应」）
              collisionDetection={closestCorners}
              modifiers={[restrictToVerticalAxis]}
              onDragEnd={onDragEnd}
            >
              <SortableContext
                items={questions.map((question) => question.key)}
                strategy={verticalListSortingStrategy}
              >
                {questions.map((question, index) => {
                  const next = questions[index + 1];
                  const pageEnds = next != null && next.pageIndex !== question.pageIndex;

                  return (
                    <div key={question.key} className="space-y-3">
                      <QuestionCard
                        question={question}
                        index={index}
                        selected={question.key === selectedKey}
                        readOnly={readOnly}
                        onSelect={() => selectQuestion(question.key)}
                      />

                      {pageEnds ? <PageBreak pageIndex={question.pageIndex} /> : null}
                    </div>
                  );
                })}
              </SortableContext>
            </DndContext>
          )}

          {/*
            「快速加一道单选题」是桌面画布里的便利入口；窄屏不渲染它 ——
            否则会和悬浮「＋」（题型弹层）形成两个添加入口，而这条**绕过题型选择**，
            与 P08-b「点一个题型」的约定冲突。用 `isDesktop` 而不是 CSS 隐藏：
            隐藏的元素仍在 DOM 里，仍会被读屏与自动化匹配到
          */}
          {isDesktop && questions.length > 0 && !readOnly ? (
            <button
              type="button"
              title="添加一道单选题（其它题型请用左侧「题型」面板）"
              onClick={() => setSelectedKey(addQuestion('SINGLE'))}
              className="border-ink-300 text-ink-500 hover:border-brand-400 hover:text-brand-500 hover:bg-brand-50 flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-dashed text-[13px] transition-all duration-150"
            >
              <PlusIcon className="size-4" />
              添加题目
            </button>
          ) : null}
        </div>
      </div>

      {isDesktop ? (
        <PropertyPanel key={selected?.key ?? 'empty'} question={selected} readOnly={readOnly} />
      ) : null}

      {/*
        窄屏：P08-b 题型弹层 / P08-c 属性弹层。
        两处都**直接复用桌面那两块面板本身**（只用一个 CSS 选择器把它们的定宽与边框中和掉）——
        这正是「不发明新交互，只做形态转换」：字段、顺序、灰显项只可能一致，
        因为压根就是同一个组件。反过来，如果照设计稿另写一套移动面板，
        「两端可改属性集合一致」这条就只能靠人盯。
      */}
      {isDesktop ? null : (
        <>
          {/*
            底部操作条（P08-a）：左边「预览」、右边「＋ 添加题目」。
            原来是右下角一个圆形悬浮钮 —— 设计稿给的是一条**常驻底栏**，
            拇指够得着，也不会挡住最后一题。
          */}
          <div className="border-ink-100 flex shrink-0 items-center gap-2 border-t bg-white px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
            <button
              type="button"
              aria-label="预览"
              onClick={() => setPreviewOpen(true)}
              className="border-ink-200 text-ink-500 flex h-11 w-[54px] shrink-0 items-center justify-center rounded-[14px] border"
            >
              <svg
                viewBox="0 0 24 24"
                className="size-[18px]"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.9}
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            </button>

            {!readOnly ? (
              <button
                type="button"
                onClick={() => setTypeSheetOpen(true)}
                className="bg-brand-500 flex h-11 flex-1 items-center justify-center gap-1.5 rounded-[14px] text-[14px] font-semibold text-white"
              >
                <PlusIcon className="size-4" strokeWidth={2.6} />
                添加题目
              </button>
            ) : null}
          </div>

          <EditorPreviewDialog open={previewOpen} onOpenChange={setPreviewOpen} />

          <Sheet open={typeSheetOpen} onOpenChange={setTypeSheetOpen}>
            <SheetContent title="题型" description="点一个题型，它就加到画布末尾">
              <div className="[&>aside]:w-full [&>aside]:border-0 [&>aside]:p-0">
                <EditorLeftPanel
                  questions={questions}
                  selectedKey={selectedKey}
                  onSelect={(key) => {
                    setSelectedKey(key);
                    setTypeSheetOpen(false);
                  }}
                  onAfterAdd={() => setTypeSheetOpen(false)}
                  readOnly={readOnly}
                />
              </div>
            </SheetContent>
          </Sheet>

          <Sheet open={propertySheetOpen} onOpenChange={setPropertySheetOpen}>
            <SheetContent
              title={selected ? `第 ${selectedIndex + 1} 题属性` : '题目属性'}
              description="与桌面端右栏是同一块面板"
              className="max-h-[85vh]"
            >
              <div className="[&>aside]:w-full [&>aside]:border-0 [&>aside]:p-0">
                <PropertyPanel
                  key={selected?.key ?? 'empty'}
                  question={selected}
                  readOnly={readOnly}
                />
              </div>
            </SheetContent>
          </Sheet>
        </>
      )}
    </div>
  );
}

/** 分页符（设计稿 W03 画布里的「第 N 页结束 · 分页符」） */
function PageBreak({ pageIndex }: { pageIndex: number }) {
  return (
    <div className="flex items-center gap-3 py-1">
      <div className="bg-ink-200 h-px flex-1" />
      <span className="text-ink-400 border-ink-200 rounded-full border bg-white px-2 py-0.5 text-[11px]">
        第 {pageIndex + 1} 页结束 · 分页符
      </span>
      <div className="bg-ink-200 h-px flex-1" />
    </div>
  );
}
