'use client';

import {
  createContext,
  startTransition,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { saveEditorDraftAction } from '../actions/save-draft';
import type { EditorQuestion, EditableQuestionType, QuestionConfig } from '../api/questionnaires';

/**
 * 编辑器草稿。
 *
 * 为什么是「草稿 + 手动保存」而不是「改哪儿存哪儿」：
 * 逐字段保存看着方便，实际有两个硬伤 ——
 * ① **没法反悔**：改错了想整段退回，没有任何入口；
 * ② **慢**：每敲几个字就发一次请求，服务端还要把整页重渲染一遍（连侧栏一起查库）。
 * 所以改动先落在本地，用户按「保存」（或 Ctrl/Cmd+S）才写库。
 *
 * 草稿里的 id 是**本地 key**，不是数据库 id：保存走的是「整份结构替换」，
 * 服务端每次重建题目行，所以本地 key 只要在本次编辑期间稳定即可（React key / 拖拽 / 选中态都用它）。
 */

export type { EditableQuestionType, QuestionConfig } from '../api/questionnaires';

export type DraftOption = { key: string; label: string };

export type DraftQuestion = {
  key: string;
  type: EditableQuestionType;
  title: string;
  description: string | null;
  required: boolean;
  shuffleOptions: boolean;
  pageIndex: number;
  config: QuestionConfig;
  options: DraftOption[];
};

export type SaveState = 'idle' | 'saving' | 'error' | 'blocked';

export function toDraftQuestions(questions: EditorQuestion[]): DraftQuestion[] {
  return questions.map((question) => ({
    key: question.id,
    type: question.type,
    title: question.title,
    description: question.description,
    required: question.required,
    shuffleOptions: question.shuffleOptions,
    pageIndex: question.pageIndex,
    config: question.config,
    options: question.options.map((option) => ({ key: option.id, label: option.label })),
  }));
}

let tempCounter = 0;

function tempKey(prefix: string) {
  tempCounter += 1;
  return `${prefix}-tmp-${tempCounter}`;
}

/** 新建选择题先给两个选项 —— 一个没有选项的单选题没法作答 */
const DEFAULT_OPTION_COUNT = 2;

function defaultConfig(type: EditableQuestionType): QuestionConfig {
  if (type === 'RATING') return { min: 1, max: 5 };
  if (type === 'SHORT_TEXT') return { maxLength: 100 };
  if (type === 'LONG_TEXT') return { maxLength: 500 };
  return {};
}

function isChoiceType(type: EditableQuestionType) {
  return type === 'SINGLE' || type === 'MULTI' || type === 'DROPDOWN';
}

type EditorDraftValue = {
  title: string;
  questions: DraftQuestion[];
  dirty: boolean;
  state: SaveState;
  errorMessage: string | null;
  setTitle: (title: string) => void;
  addQuestion: (type: EditableQuestionType) => string;
  updateQuestion: (key: string, patch: Partial<Omit<DraftQuestion, 'key' | 'options'>>) => void;
  removeQuestion: (key: string) => void;
  reorderQuestions: (keys: string[]) => void;
  addOption: (questionKey: string) => void;
  updateOption: (questionKey: string, optionKey: string, label: string) => void;
  removeOption: (questionKey: string, optionKey: string) => void;
  reorderOptions: (questionKey: string, keys: string[]) => void;
  insertPageBreakAfter: (questionKey: string) => void;
  removePageBreakAt: (pageIndex: number) => void;
  save: () => void;
  discard: () => void;
};

const EditorDraftContext = createContext<EditorDraftValue | null>(null);

export function useEditorDraft() {
  const value = useContext(EditorDraftContext);
  if (!value) throw new Error('useEditorDraft 必须在 EditorDraftProvider 内使用');
  return value;
}

export function EditorDraftProvider({
  questionnaireId,
  initialTitle,
  initialQuestions,
  readOnly,
  children,
}: {
  questionnaireId: string;
  initialTitle: string;
  initialQuestions: EditorQuestion[];
  readOnly: boolean;
  children: React.ReactNode;
}) {
  const [title, setTitleState] = useState(initialTitle);
  const [questions, setQuestions] = useState(() => toDraftQuestions(initialQuestions));
  const [dirty, setDirty] = useState(false);
  const [state, setState] = useState<SaveState>(readOnly ? 'blocked' : 'idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // 放进 ref 是为了让 save 不必依赖整个 questions 数组 ——
  // 否则每敲一个字都会重建 save 回调（连带重建 context value、重渲染全部消费者）。
  // 同步放在 effect 里：渲染期写 ref 会触发「Cannot access refs during render」，
  // 而保存是用户交互触发的，effect 早就跑完了。
  const titleRef = useRef(title);
  const questionsRef = useRef(questions);

  useEffect(() => {
    titleRef.current = title;
    questionsRef.current = questions;
  });

  const mutate = useCallback((updater: (list: DraftQuestion[]) => DraftQuestion[]) => {
    setQuestions((list) => updater(list));
    setDirty(true);
    setErrorMessage(null);
  }, []);

  const save = useCallback(() => {
    if (readOnly) return;

    setState('saving');
    setErrorMessage(null);

    const payload = {
      formatVersion: 1 as const,
      // 空标题/空题目会被 payload 校验拦下，这里给一个兜底文案而不是让用户对着报错猜
      title: titleRef.current.trim() || '未命名问卷',
      intro: null,
      questions: questionsRef.current.map((question) => ({
        type: question.type,
        title: question.title.trim() || '未命名题目',
        description: question.description,
        required: question.required,
        shuffleOptions: question.shuffleOptions,
        pageIndex: question.pageIndex,
        config: question.config,
        options: isChoiceType(question.type) ? question.options.map((option) => option.label) : [],
      })),
    };

    startTransition(async () => {
      try {
        const result = await saveEditorDraftAction(questionnaireId, payload);

        if (result.ok) {
          setDirty(false);
          setState('idle');
        } else {
          setErrorMessage(result.message);
          setState('error');
        }
      } catch {
        // 网络断了、权限被改了、结构被冻结了 —— 都落到这里。
        // 不吞掉：顶栏显示「保存失败」并给重试入口
        setErrorMessage('保存失败，请检查网络后重试');
        setState('error');
      }
    });
  }, [questionnaireId, readOnly]);

  /** 放弃本次修改，回到服务端那一份 */
  const discard = useCallback(() => {
    setTitleState(initialTitle);
    setQuestions(toDraftQuestions(initialQuestions));
    setDirty(false);
    setErrorMessage(null);
    setState(readOnly ? 'blocked' : 'idle');
  }, [initialTitle, initialQuestions, readOnly]);

  // Ctrl / Cmd + S 保存：编辑器里最顺手的一个快捷键，成本极低
  useEffect(() => {
    if (readOnly) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
        event.preventDefault();
        save();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [readOnly, save]);

  const value = useMemo<EditorDraftValue>(
    () => ({
      title,
      questions,
      dirty,
      state,
      errorMessage,
      setTitle: (next) => {
        setTitleState(next);
        setDirty(true);
      },
      addQuestion: (type) => {
        const key = tempKey('q');
        mutate((list) => [
          ...list,
          {
            key,
            type,
            title: '新题目',
            description: null,
            required: false,
            shuffleOptions: false,
            pageIndex: list.at(-1)?.pageIndex ?? 0,
            config: defaultConfig(type),
            options: isChoiceType(type)
              ? Array.from({ length: DEFAULT_OPTION_COUNT }, (_, index) => ({
                  key: tempKey('o'),
                  label: `选项 ${index + 1}`,
                }))
              : [],
          },
        ]);
        return key;
      },
      updateQuestion: (key, patch) =>
        mutate((list) =>
          list.map((question) => (question.key === key ? { ...question, ...patch } : question)),
        ),
      removeQuestion: (key) => mutate((list) => list.filter((question) => question.key !== key)),
      reorderQuestions: (keys) =>
        mutate((list) => {
          const byKey = new Map(list.map((question) => [question.key, question]));
          return keys.flatMap((key) => {
            const question = byKey.get(key);
            return question ? [question] : [];
          });
        }),
      addOption: (questionKey) =>
        mutate((list) =>
          list.map((question) =>
            question.key === questionKey
              ? {
                  ...question,
                  options: [
                    ...question.options,
                    { key: tempKey('o'), label: `选项 ${question.options.length + 1}` },
                  ],
                }
              : question,
          ),
        ),
      updateOption: (questionKey, optionKey, label) =>
        mutate((list) =>
          list.map((question) =>
            question.key === questionKey
              ? {
                  ...question,
                  options: question.options.map((option) =>
                    option.key === optionKey ? { ...option, label } : option,
                  ),
                }
              : question,
          ),
        ),
      removeOption: (questionKey, optionKey) =>
        mutate((list) =>
          list.map((question) =>
            question.key === questionKey
              ? {
                  ...question,
                  options: question.options.filter((option) => option.key !== optionKey),
                }
              : question,
          ),
        ),
      reorderOptions: (questionKey, keys) =>
        mutate((list) =>
          list.map((question) => {
            if (question.key !== questionKey) return question;

            const byKey = new Map(question.options.map((option) => [option.key, option]));
            return {
              ...question,
              options: keys.flatMap((key) => {
                const option = byKey.get(key);
                return option ? [option] : [];
              }),
            };
          }),
        ),
      insertPageBreakAfter: (questionKey) =>
        mutate((list) => {
          const index = list.findIndex((question) => question.key === questionKey);
          if (index === -1 || index >= list.length - 1) return list;

          return list.map((question, position) =>
            position > index ? { ...question, pageIndex: question.pageIndex + 1 } : question,
          );
        }),
      removePageBreakAt: (pageIndex) =>
        mutate((list) =>
          list.map((question) => {
            if (question.pageIndex === pageIndex) return { ...question, pageIndex: pageIndex - 1 };
            if (question.pageIndex > pageIndex)
              return { ...question, pageIndex: question.pageIndex - 1 };
            return question;
          }),
        ),
      save,
      discard,
    }),
    [title, questions, dirty, state, errorMessage, mutate, save, discard],
  );

  return <EditorDraftContext.Provider value={value}>{children}</EditorDraftContext.Provider>;
}
