'use client';

import { useActionState, useState } from 'react';

import { ChevronDownIcon, ChevronUpIcon, SearchIcon } from '@/components/icons/ui-icons';
import { Button } from '@/components/ui/button';
import { Modal, ModalContent } from '@/components/ui/modal';
import { Textarea } from '@/components/ui/textarea';
import { EMPTY_FORM_STATE } from '@/types/form-state';
import { cn } from '@/utils/cn';

import { submitFeedbackAction } from '../actions/feedback';

/**
 * 常见问题。
 *
 * 答案必须**如实描述当前版本的行为** —— 帮助文案里写一个还没做的功能，
 * 和画一个点了没反应的按钮是同一种问题。
 * 例如「忘记密码怎么办」直接说明本版本需要联系工作区所有者，
 * 因为自助找回密码确实没有做。
 */
const FAQS = [
  {
    question: '问卷发布后还能改题目吗？',
    answer:
      '不能。发布即冻结题目结构，这是为了保证历史答卷与统计口径一致。需要调整时，可以在问卷列表的「更多」里复制为新问卷。',
  },
  {
    question: '为什么别人打不开我的链接？',
    answer:
      '常见原因有三种：问卷还是草稿没发布、被暂停了、或者已经达到回收上限或截止时间。先到发布设置里确认一下当前状态。',
  },
  {
    question: '忘记密码怎么办？',
    answer:
      '本版本没有做自助找回密码，因为那需要真实的邮件投递服务。如果这是演示账号，直接使用页面上印的演示口令登录即可。',
  },
  {
    question: '演示环境的数据会被清空吗？',
    answer: '会。这是公开演示环境，数据可能被定期重置，请不要填写真实的敏感信息。',
  },
];

export type HelpDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function HelpDialog({ open, onOpenChange }: HelpDialogProps) {
  const [keyword, setKeyword] = useState('');
  const [expanded, setExpanded] = useState<string | null>(FAQS[0].question);

  const trimmed = keyword.trim();
  const matched = trimmed
    ? FAQS.filter((item) => item.question.includes(trimmed) || item.answer.includes(trimmed))
    : FAQS;

  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <ModalContent title="帮助与反馈" width="md">
        <div className="relative mb-4">
          <SearchIcon className="text-ink-400 pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2" />
          <input
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder="搜索帮助主题…"
            aria-label="搜索帮助主题"
            className="bg-ink-100 text-body-s text-ink-800 placeholder:text-ink-400 focus:border-brand-500 focus:ring-brand-500/20 h-9 w-full rounded-[10px] border border-transparent pr-3 pl-9 transition-all duration-150 outline-none focus:bg-white focus:ring-[3px]"
          />
        </div>

        <div className="text-ink-400 mb-2 text-[11px] font-semibold tracking-wide">常见问题</div>

        {matched.length === 0 ? (
          <p className="text-ink-400 border-ink-200 rounded-[10px] border border-dashed px-3.5 py-4 text-center text-[12px]">
            没有匹配「{trimmed}」的主题。可以在下面直接写给我们。
          </p>
        ) : (
          <div className="border-ink-200 divide-ink-100 divide-y overflow-hidden rounded-[10px] border">
            {matched.map((item) => {
              const isOpen = expanded === item.question;

              return (
                <div key={item.question} className={cn(isOpen && 'bg-brand-50/40')}>
                  <button
                    type="button"
                    aria-expanded={isOpen}
                    onClick={() => setExpanded(isOpen ? null : item.question)}
                    className="flex w-full items-center gap-2 px-3.5 py-3 text-left"
                  >
                    <span
                      className={cn(
                        'flex-1 text-[12.5px]',
                        isOpen ? 'text-ink-900 font-medium' : 'text-ink-700',
                      )}
                    >
                      {item.question}
                    </span>
                    {isOpen ? (
                      <ChevronUpIcon className="text-ink-400 size-3.5 shrink-0" />
                    ) : (
                      <ChevronDownIcon className="text-ink-400 size-3.5 shrink-0" />
                    )}
                  </button>

                  {isOpen ? (
                    <p className="text-ink-600 px-3.5 pb-3 text-[12px] leading-5">{item.answer}</p>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}

        <div className="border-ink-100 mt-5 border-t pt-4">
          <div className="text-ink-800 text-[12.5px] font-medium">没找到答案？</div>
          <div className="text-ink-400 mt-0.5 mb-2.5 text-[11px]">直接写给我们，会尽快回复。</div>

          {open ? <FeedbackForm /> : null}
        </div>
      </ModalContent>
    </Modal>
  );
}

function FeedbackForm() {
  const [state, formAction, pending] = useActionState(submitFeedbackAction, EMPTY_FORM_STATE);

  return (
    <form action={formAction} noValidate>
      <Textarea
        name="content"
        rows={3}
        placeholder="描述你遇到的问题，或想提的建议…"
        aria-label="反馈内容"
        defaultValue={state.values?.content}
        invalid={Boolean(state.fieldErrors?.content)}
      />
      {state.fieldErrors?.content ? (
        <p className="text-caption mt-1.5 text-rose-500">{state.fieldErrors.content.join('，')}</p>
      ) : null}

      <div className="mt-3 flex items-center justify-between gap-3">
        <span className="text-caption text-emerald-600">{state.success ?? ''}</span>
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? '提交中…' : '提交反馈'}
        </Button>
      </div>
    </form>
  );
}
