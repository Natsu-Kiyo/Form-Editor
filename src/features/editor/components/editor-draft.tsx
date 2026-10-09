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

import { MATRIX_DEFAULT_COLUMNS, MATRIX_LIMITS, SHOW_IF_SOURCE_TYPES } from '@/config/constants';
import { hasOptionList } from '@/lib/questionnaire-structure';

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

/**
 * 草稿里的显示条件：依赖**哪一道草稿题** —— 用本地 key 而不是序号。
 *
 * 序号在编辑过程中随时会错位（插入 / 删除 / 拖拽都会挪动后面所有题），
 * 而 key 在本次编辑期间是稳定的。保存时才映射成 payload 里的绝对序号
 * （与「读回来时把序号映射成 key」是一对边界转换）。
 */
export type DraftShowIf = {
  dependsOnKey: string;
  options: string[];
};

export type DraftQuestion = {
  key: string;
  type: EditableQuestionType;
  title: string;
  description: string | null;
  required: boolean;
  shuffleOptions: boolean;
  pageIndex: number;
  /** 题型差异项（不含 `showIf` —— 它被提到外面成独立字段，因为它引用别的题） */
  config: QuestionConfig;
  /** 条件显示（R65）：为空 = 一直显示。块内加题时新题会继承锚点这一份 */
  showIf: DraftShowIf | null;
  options: DraftOption[];
};

export type SaveState = 'idle' | 'saving' | 'error' | 'blocked';

export function toDraftQuestions(questions: EditorQuestion[]): DraftQuestion[] {
  // 序号 → key 的映射表：payload 里的 `showIf.questionIndex` 在这里换成草稿题的 key
  const keyByIndex = questions.map((question) => question.id);

  return questions.map((question) => ({
    key: question.id,
    type: question.type,
    title: question.title,
    description: question.description,
    required: question.required,
    shuffleOptions: question.shuffleOptions,
    pageIndex: question.pageIndex,
    // `showIf` 从 config 里提出来（它引用别的题，不适合留在「题型差异项」里）——
    // 留着一份旧序号的副本，保存时反而会被原样写回去
    config: withoutShowIf(question.config),
    showIf: toDraftShowIf(question.config.showIf, keyByIndex),
    options: question.options.map((option) => ({ key: option.id, label: option.label })),
  }));
}

function withoutShowIf(config: QuestionConfig): QuestionConfig {
  const rest = { ...config };
  delete rest.showIf;

  return rest;
}

function toDraftShowIf(showIf: QuestionConfig['showIf'], keyByIndex: string[]): DraftShowIf | null {
  if (!showIf) return null;

  const dependsOnKey = keyByIndex[showIf.questionIndex];

  // 依赖题找不到（脏数据）就当没有条件：宁可少一个条件，也不要一个指向空气的条件
  return dependsOnKey ? { dependsOnKey, options: showIf.options } : null;
}

/**
 * 草稿 → payload 的显示条件：依赖 key 换回序号，并把几种「结构已经被改坏」的情况
 * **在保存前自愈掉**（都在编辑器里发生，用户看得见改的结果）：
 *
 * - 依赖题被删 / 被拖到本题**后面**了 → 条件只允许指向前面的题，丢掉；
 * - 依赖题不再是选择类（题型被改过）→ 丢掉；
 * - 引用的选项改过名 / 被删（一个都不剩）→ 丢掉，还剩一部分就只留有效的。
 *
 * 外部来源（JSON 导入、历史模板 payload）不经过这里，由 payload schema 的跨题校验拦。
 */
function resolveShowIf(question: DraftQuestion, list: DraftQuestion[], index: number) {
  const showIf = question.showIf;
  if (!showIf) return undefined;

  const dependsOnIndex = list.findIndex((item) => item.key === showIf.dependsOnKey);
  if (dependsOnIndex < 0 || dependsOnIndex >= index) return undefined;

  const dependsOn = list[dependsOnIndex]!;
  if (!SHOW_IF_SOURCE_TYPES.includes(dependsOn.type)) return undefined;

  const available = new Set(dependsOn.options.map((option) => option.label));
  const options = showIf.options.filter((option) => available.has(option));

  // 原本就是空（用户勾到 0 个）：原样带出去，让 payload schema 给出明确报错 ——
  // 那是「还没配完」，不该被静默丢掉
  if (showIf.options.length === 0) return { questionIndex: dependsOnIndex, options: [] };

  // 过滤之后才变空（选项被删 / 改名）：那次改名就是「不要这个条件了」的操作，丢弃
  return options.length > 0 ? { questionIndex: dependsOnIndex, options } : undefined;
}

let tempCounter = 0;

function tempKey(prefix: string) {
  tempCounter += 1;
  return `${prefix}-tmp-${tempCounter}`;
}

/** 新建选择题先给两个选项 —— 一个没有选项的单选题没法作答（矩阵的「行」同理，见 addQuestion） */
const DEFAULT_OPTION_COUNT = 2;

/**
 * 草稿里的矩阵列，**原样返回、不过滤空串**。
 *
 * 与 `constants.matrixColumns()`（读取侧：收敛上限 + 丢掉空值）**刻意分开**：
 * 编辑器里那一格可能正被清空、还没重新输入，它必须留在数组里 ——
 * 用读取侧那份过滤一下，清空一格就等于当场把那一列删掉，
 * 连着下限校验的基数一起变（列能被删到少于 2）。
 * 与选项编辑同一条规矩：**为空只是空着，失焦时才补一个占位文案**。
 */
export function draftMatrixColumns(config: QuestionConfig) {
  return config.columns ?? [];
}

function defaultConfig(type: EditableQuestionType): QuestionConfig {
  if (type === 'RATING') return { min: 1, max: 5 };
  if (type === 'SHORT_TEXT') return { maxLength: 100 };
  if (type === 'LONG_TEXT') return { maxLength: 500 };
  // 矩阵先给一组最常见的评价列；**行**与选项共用一套初始化（在 addQuestion 里）
  if (type === 'MATRIX') return { columns: [...MATRIX_DEFAULT_COLUMNS] };
  return {};
}

type EditorDraftValue = {
  /** 顶栏要用它拼「发布设置」的链接；页面内各组件不该自己从 URL 里抠 */
  questionnaireId: string;
  title: string;
  questions: DraftQuestion[];
  dirty: boolean;
  state: SaveState;
  errorMessage: string | null;
  setTitle: (title: string) => void;
  /** 添加题目。给了 `afterKey` 就插在那道题之后，否则追加到末尾（并返回新题的 key） */
  addQuestion: (type: EditableQuestionType, afterKey?: string | null) => string;
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

    const list = questionsRef.current;

    const payload = {
      formatVersion: 1 as const,
      // 空标题/空题目会被 payload 校验拦下，这里给一个兜底文案而不是让用户对着报错猜
      title: titleRef.current.trim() || '未命名问卷',
      intro: null,
      // `map` 的第二个参数就是序号：显示条件的「依赖 key → 序号」映射沿着它做
      questions: list.map((question, index) => {
        const showIf = resolveShowIf(question, list, index);

        return {
          type: question.type,
          title: question.title.trim() || '未命名题目',
          description: question.description,
          required: question.required,
          shuffleOptions: question.shuffleOptions,
          pageIndex: question.pageIndex,
          config: showIf ? { ...question.config, showIf } : question.config,
          // 矩阵的「行」存在 options 里，不能像文本题那样丢掉（见 lib/questionnaire-structure 的 hasOptionList）
          options: hasOptionList(question.type)
            ? question.options.map((option) => option.label)
            : [],
        };
      }),
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
      questionnaireId,
      title,
      questions,
      dirty,
      state,
      errorMessage,
      setTitle: (next) => {
        setTitleState(next);
        setDirty(true);
      },
      addQuestion: (type, afterKey) => {
        const key = tempKey('q');
        mutate((list) => {
          /*
           * **插在当前选中那道题之后**，没选中才追加到末尾。
           * 原来的「一律追加」有个很具体的坏处：在一份 20 题的问卷里想在第 3 题后面
           * 补一道题，新题会出现在第 21 位 —— 然后还得把它从末尾拖上去。
           */
          const at = afterKey ? list.findIndex((question) => question.key === afterKey) : -1;
          const anchor = at >= 0 ? list[at] : list.at(-1);

          const created: DraftQuestion = {
            key,
            type,
            title: '新题目',
            description: null,
            required: false,
            shuffleOptions: false,
            // 继承锚点那一题的页：插在第 2 页的题后面，新题自然也在第 2 页
            pageIndex: anchor?.pageIndex ?? 0,
            // 条件块内加题：继承锚点的显示条件（与继承页同一条模式）——
            // 「在不满意追问里再加一问」不用再配一次条件
            showIf: anchor?.showIf ?? null,
            config: defaultConfig(type),
            // 矩阵的「行」也在这份 options 里（两者结构完全同构）：默认给下限 2 行
            options: hasOptionList(type)
              ? Array.from(
                  { length: type === 'MATRIX' ? MATRIX_LIMITS.MIN_ROWS : DEFAULT_OPTION_COUNT },
                  (_, index) => ({
                    key: tempKey('o'),
                    label: type === 'MATRIX' ? `行 ${index + 1}` : `选项 ${index + 1}`,
                  }),
                )
              : [],
          };

          if (at < 0) return [...list, created];

          const next = [...list];
          next.splice(at + 1, 0, created);
          return next;
        });
        return key;
      },
      updateQuestion: (key, patch) =>
        mutate((list) =>
          list.map((question) => (question.key === key ? { ...question, ...patch } : question)),
        ),
      // 删题时把「依赖它」的条件一并清掉：留一个指向空气的条件，界面上就是一句
      // 「当（已删除）选了…时显示」，比没有条件更难懂
      removeQuestion: (key) =>
        mutate((list) =>
          list
            .filter((question) => question.key !== key)
            .map((question) =>
              question.showIf?.dependsOnKey === key ? { ...question, showIf: null } : question,
            ),
        ),
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
    [questionnaireId, title, questions, dirty, state, errorMessage, mutate, save, discard],
  );

  return <EditorDraftContext.Provider value={value}>{children}</EditorDraftContext.Provider>;
}
