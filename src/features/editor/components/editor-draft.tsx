'use client';

import {
  createContext,
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

function toDraftQuestions(questions: EditorQuestion[]): DraftQuestion[] {
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
 * 这一串文本项在这道题里叫什么：矩阵题是「行」，其余是「选项」。
 *
 * 存在的意义是**只写一遍**：新建题的默认项、添加按钮的占位文案、输入框的无障碍名
 * 都要说同一个词，各写一遍就会出现「添加」给的是「选项 3」、而输入框自称「行文案」。
 */
export function optionUnit(type: DraftQuestion['type']) {
  return type === 'MATRIX' ? '行' : '选项';
}

/**
 * 找一个**不重名**的占位文案：`选项 1`、`选项 2`…… 给「添加」与「清空后失焦补占位」共用。
 *
 * 为什么不是「数量 + 1」：删掉中间一个再添加就会当场撞名
 * （`[选项 1, 选项 3]` 里添加又得到「选项 3」），而重名从 R92 起会被 schema 拦下 ——
 * 用户会撞上一句「保存不了」却看不出自己哪里做错了。
 * 从 1 开始取第一个空着的编号：既不撞名，删完再加还会把空出来的编号补上。
 */
export function nextFreeOptionLabel(unit: string, labels: readonly string[]) {
  const taken = new Set(labels.map((label) => label.trim()));

  let index = 1;
  while (taken.has(`${unit} ${index}`)) index += 1;

  return `${unit} ${index}`;
}

/**
 * 一串文案（选项 / 行 / 列）的**保存兜底**：空着的那几格补成占位（`选项 3` / `列 2`）。
 *
 * 为什么需要它：新增的选项与列初始是空的，补位发生在**失焦**时；而「光标还在空输入框里
 * 直接按 Ctrl+S」不会失焦 —— 那份草稿会因为 `min(1)` 被 schema 拒掉，
 * 选项那边报出来的还是 zod 的英文原话。
 *
 * 放在这里（而不是界面上强行填）与上面那句 `title.trim() || '未命名题目'` 是同一条规矩：
 * **空着的字段由保存兜底，界面不替用户改内容**。
 * 逐格补而不是一次算完：两格同时空着时要拿到两个**不同**的占位（文案不允许重名，R92 · N7）。
 */
function fillEmptyLabels(unit: string, labels: readonly string[]) {
  const taken = [...labels];

  return labels.map((label) => {
    const value = label.trim();
    if (value) return value;

    const filled = nextFreeOptionLabel(unit, taken);
    // 记进 taken：下一格空着的才拿不到同一个占位
    taken.push(filled);

    return filled;
  });
}

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
  /**
   * 卷首语（R95）：作答者在标题下方看到的那段话。
   *
   * 草稿里用**空串**表示「没写」—— 与 `null` 的区别只存在于落库那一步
   * （`save()` 里 `trim() || null`），界面上不必到处判 `null`。
   */
  intro: string;
  questions: DraftQuestion[];
  dirty: boolean;
  state: SaveState;
  errorMessage: string | null;
  setTitle: (title: string) => void;
  setIntro: (intro: string) => void;
  /** 添加题目。给了 `afterKey` 就插在那道题之后，否则追加到末尾（并返回新题的 key） */
  addQuestion: (type: EditableQuestionType, afterKey?: string | null) => string;
  updateQuestion: (key: string, patch: Partial<Omit<DraftQuestion, 'key' | 'options'>>) => void;
  removeQuestion: (key: string) => void;
  reorderQuestions: (keys: string[]) => void;
  /** 添加一个选项 / 行。返回新项的 key —— 调用方拿它把焦点落到刚出现的那一格（R94） */
  addOption: (questionKey: string) => string;
  updateOption: (questionKey: string, optionKey: string, label: string) => void;
  removeOption: (questionKey: string, optionKey: string) => void;
  reorderOptions: (questionKey: string, keys: string[]) => void;
  insertPageBreakAfter: (questionKey: string) => void;
  removePageBreakAt: (pageIndex: number) => void;
  /**
   * 保存草稿。**返回这次保存是否成功** —— 「保存并离开」必须等它：
   * 不等就导航会出现「用户以为存上了、其实服务端拒绝了，而他已经在别的页面上」（R91 · S4）。
   */
  save: () => Promise<boolean>;
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
  initialIntro,
  initialQuestions,
  readOnly,
  children,
}: {
  questionnaireId: string;
  initialTitle: string;
  /** 库里的卷首语（`null` = 没写过）；草稿里统一按空串处理 */
  initialIntro: string | null;
  initialQuestions: EditorQuestion[];
  readOnly: boolean;
  children: React.ReactNode;
}) {
  const [title, setTitleState] = useState(initialTitle);
  const [intro, setIntroState] = useState(initialIntro ?? '');
  const [questions, setQuestions] = useState(() => toDraftQuestions(initialQuestions));
  const [dirty, setDirty] = useState(false);
  const [state, setState] = useState<SaveState>(readOnly ? 'blocked' : 'idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // 放进 ref 是为了让 save 不必依赖整个 questions 数组 ——
  // 否则每敲一个字都会重建 save 回调（连带重建 context value、重渲染全部消费者）。
  // 同步放在 effect 里：渲染期写 ref 会触发「Cannot access refs during render」，
  // 而保存是用户交互触发的，effect 早就跑完了。
  const titleRef = useRef(title);
  const introRef = useRef(intro);
  const questionsRef = useRef(questions);

  useEffect(() => {
    titleRef.current = title;
    introRef.current = intro;
    questionsRef.current = questions;
  });

  const mutate = useCallback((updater: (list: DraftQuestion[]) => DraftQuestion[]) => {
    setQuestions((list) => updater(list));
    setDirty(true);
    setErrorMessage(null);
  }, []);

  const save = useCallback(async (): Promise<boolean> => {
    if (readOnly) return false;

    setState('saving');
    setErrorMessage(null);

    const list = questionsRef.current;

    const payload = {
      formatVersion: 1 as const,
      // 空标题/空题目会被 payload 校验拦下，这里给一个兜底文案而不是让用户对着报错猜
      title: titleRef.current.trim() || '未命名问卷',
      /*
       * 卷首语照草稿原样带走（R95）。这里曾经硬编码 `null` ——
       * 于是「从模板创建 / 导入 JSON 带进来的卷首语」会在编辑器里按一次保存就被**静默清空**，
       * 列表卡片上那段说明跟着变回「共 N 道题」。空串落成 `null`：库里两种「没写」没有区别。
       */
      intro: introRef.current.trim() || null,
      // `map` 的第二个参数就是序号：显示条件的「依赖 key → 序号」映射沿着它做
      questions: list.map((question, index) => {
        const showIf = resolveShowIf(question, list, index);
        const config = showIf ? { ...question.config, showIf } : question.config;

        return {
          type: question.type,
          title: question.title.trim() || '未命名题目',
          description: question.description,
          required: question.required,
          shuffleOptions: question.shuffleOptions,
          pageIndex: question.pageIndex,
          // 矩阵的列同样可能空着就保存（与选项同一情形）：补占位后再交给 schema
          config:
            question.type === 'MATRIX'
              ? { ...config, columns: fillEmptyLabels('列', draftMatrixColumns(config)) }
              : config,
          // 矩阵的「行」存在 options 里，不能像文本题那样丢掉（见 lib/questionnaire-structure 的 hasOptionList）。
          // 空文案在这里兜底（与 title 同理）：新增的选项可能还空着、没来得及失焦
          options: hasOptionList(question.type)
            ? fillEmptyLabels(
                optionUnit(question.type),
                question.options.map((option) => option.label),
              )
            : [],
        };
      }),
    };

    /*
     * 直接 `await` 而不是包进 `startTransition`：**要把结果给调用方** ——
     * 「保存并离开」得知道存没存上才决定走不走（R91 · S4）。
     * 等待期的样子由 `state === 'saving'` 表达（顶栏读的就是它），不依赖 transition 的 pending。
     */
    try {
      const result = await saveEditorDraftAction(questionnaireId, payload);

      if (result.ok) {
        setDirty(false);
        setState('idle');

        return true;
      }

      setErrorMessage(result.message);
      setState('error');

      return false;
    } catch {
      // 网络断了、权限被改了、结构被冻结了 —— 都落到这里。
      // 不吞掉：顶栏显示「保存失败」并给重试入口
      setErrorMessage('保存失败，请检查网络后重试');
      setState('error');

      return false;
    }
  }, [questionnaireId, readOnly]);

  /** 放弃本次修改，回到服务端那一份 */
  const discard = useCallback(() => {
    setTitleState(initialTitle);
    setIntroState(initialIntro ?? '');
    setQuestions(toDraftQuestions(initialQuestions));
    setDirty(false);
    setErrorMessage(null);
    setState(readOnly ? 'blocked' : 'idle');
  }, [initialTitle, initialIntro, initialQuestions, readOnly]);

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
      intro,
      questions,
      dirty,
      state,
      errorMessage,
      setTitle: (next) => {
        setTitleState(next);
        setDirty(true);
      },
      setIntro: (next) => {
        setIntroState(next);
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
                    label: `${optionUnit(type)} ${index + 1}`,
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
      addOption: (questionKey) => {
        const optionKey = tempKey('o');

        mutate((list) =>
          list.map((question) =>
            question.key === questionKey
              ? {
                  ...question,
                  // 初始文案**留空**（R94）：新增后焦点直接落在这一格，用户要的是「敲字」，
                  // 而不是「先把『选项 3』删掉」。空着的这格由失焦补位（见 option-editor 的 onBlur），
                  // 整份草稿在保存时还有一道兜底（见本文件 save() 里的 fillOptionLabels）
                  options: [...question.options, { key: optionKey, label: '' }],
                }
              : question,
          ),
        );

        return optionKey;
      },
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
    [questionnaireId, title, intro, questions, dirty, state, errorMessage, mutate, save, discard],
  );

  return <EditorDraftContext.Provider value={value}>{children}</EditorDraftContext.Provider>;
}
