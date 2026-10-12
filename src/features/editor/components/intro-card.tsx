'use client';

import { useEffect, useRef } from 'react';

import { CharCount } from '@/components/ui/char-count';
import { PAYLOAD_LIMITS } from '@/config/constants';
import { cn } from '@/utils/cn';

import { useEditorDraft } from './editor-draft';

/**
 * 卷首卡（R95）：画布**顶部、Q1 之上**那张卡，编辑「卷首语」。
 *
 * 为什么在这儿（而不是右栏「题目属性」里）：卷首语是**整份问卷**的内容，不是某道题的属性；
 * 而它恰恰是作答者在标题下方看到的第一段话 —— 放在中栏才算「内容在它该在的地方」。
 * 右栏那块面板也已经满了（截图里到「删除这道题」就到底了），塞不进去。
 *
 * 为什么必须比「右栏加个字段」更值得做：它原先**根本没有编辑入口**，
 * 只能从模板 / 导入 JSON 带进来 —— 有内容、看不见、也改不了，
 * 比「没有这个功能」更难解释。同一轮还修掉了保存时把它写成 `null` 的那个 bug
 * （见 `editor-draft` 的 `save()`），否则这张卡填的东西会被下一次保存抹掉。
 *
 * 三端形态与题卡一致（R93 立的规矩）：
 * - 桌面：直接是个能写的输入框（高度跟着内容长）；
 * - 窄屏：预览 + 点一下开弹层（`onEdit`，由工作区给那块 `Sheet`）；
 * - 只读态（已发布 / 无权限）：纯文本。
 */
export function IntroCard({
  readOnly,
  inlineEditable,
  onEdit,
}: {
  readOnly: boolean;
  inlineEditable: boolean;
  onEdit: () => void;
}) {
  const { intro, setIntro } = useEditorDraft();
  const areaRef = useRef<HTMLTextAreaElement>(null);
  const editable = inlineEditable && !readOnly;
  const clickable = !inlineEditable && !readOnly;

  /*
   * 高度跟着内容长。少了它，`rows` 写死的那点高度会在写到第三行时冒出内部滚动条 ——
   * 而这段文字正是用户要「看着整体效果」写的东西。
   * 这里只改 DOM 样式、不 setState（不涉及 set-state-in-effect 那条规矩）。
   */
  useEffect(() => {
    const area = areaRef.current;
    if (!area) return;

    area.style.height = 'auto';
    area.style.height = `${area.scrollHeight}px`;
  }, [intro, editable]);

  // 只读（已发布 / 无权限）且没写过：整张卡不渲染 —— 一个既改不动、也没内容的框只是噪音
  if (readOnly && !intro.trim()) return null;

  const body = editable ? (
    <textarea
      ref={areaRef}
      value={intro}
      rows={2}
      maxLength={PAYLOAD_LIMITS.INTRO}
      aria-label="卷首语"
      onChange={(event) => setIntro(event.target.value)}
      placeholder="写一句说明：这份问卷用来做什么、大概要几分钟（可留空）"
      className="text-ink-700 w-full resize-none bg-transparent text-[13.5px] leading-6 outline-none"
    />
  ) : (
    <p className="text-ink-700 text-[13.5px] leading-6 whitespace-pre-wrap">
      {intro.trim() || '（还没有卷首语，点这里写一句）'}
    </p>
  );

  const content = (
    <>
      <div className="mb-2.5 flex items-start gap-3">
        <span className="text-ink-400 shrink-0 pt-0.5 font-mono text-[13px]">卷首语</span>
        {/* 快满 / 到顶时的计数器（R97）：截停不能是静默的 */}
        {editable ? (
          <CharCount value={intro} max={PAYLOAD_LIMITS.INTRO} className="ml-auto shrink-0 pt-0.5" />
        ) : null}
        {/* 窄屏：`›` 是「点开编辑弹层」的提示（与题卡同一个记号） */}
        {clickable ? (
          <span className="text-ink-300 -mt-0.5 shrink-0 text-[15px]" aria-hidden="true">
            ›
          </span>
        ) : null}
      </div>
      {body}
    </>
  );

  const shell = cn(
    'rounded-xl border bg-white p-5 transition-colors duration-150',
    editable || clickable ? 'border-ink-300 border-dashed' : 'border-ink-200',
    clickable && 'hover:border-brand-400 w-full text-left',
  );

  // 窄屏用一个真按钮（键盘与读屏都能用），桌面是容器 + 里面的输入框
  if (clickable) {
    return (
      <button type="button" aria-label="编辑卷首语" onClick={onEdit} className={shell}>
        {content}
      </button>
    );
  }

  return <div className={shell}>{content}</div>;
}
