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

import { MATRIX_DEFAULT_COLUMNS, MATRIX_LIMITS } from '@/config/constants';
import { hasOptionList } from '@/lib/questionnaire-structure';

import { saveEditorDraftAction } from '../actions/save-draft';
import type { EditorQuestion, EditableQuestionType, QuestionConfig } from '../api/questionnaires';
import { reorderQuestionsWithPages } from '../lib/draft-pages';
import { optionUnit } from '../lib/draft-options';
import {
  renameShowIfReferences,
  resolveShowIf,
  settleShowIf,
  withFilledLabels,
} from '../lib/draft-show-if';

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

/* 显示条件的规则在 `lib/draft-show-if.ts`：草稿侧（settleShowIf）与保存侧（resolveShowIf）
   必须同源，两者各写一套就会出现「画布显示着、保存后却没了」 */

let tempCounter = 0;

function tempKey(prefix: string) {
  tempCounter += 1;
  return `${prefix}-tmp-${tempCounter}`;
}

/** 新建选择题先给两个选项 —— 一个没有选项的单选题没法作答（矩阵的「行」同理，见 addQuestion） */
const DEFAULT_OPTION_COUNT = 2;

/* 选项 / 行 / 列的文案规则（optionUnit、nextFreeOptionLabel、fillEmptyLabels、
   draftMatrixColumns）都在 `lib/draft-options.ts`：界面与保存兜底必须同源，且要能单测 */

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
  /** 拖动排序。`movedKey` = 被拖动的那道题：它的 `pageIndex` 要跟着落点重算（用户复测 #5） */
  reorderQuestions: (keys: string[], movedKey: string) => void;
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

  /**
   * 「草稿改过几次」的单调计数（审查 #5）。
   *
   * 保存是异步的：快照发出去之后输入框仍然可编辑。请求回来时若这个数变了，
   * 说明等待期间又改了东西 —— 那几笔**不在**刚存下去的 payload 里，
   * 这时清 dirty 就等于把它们伪装成「已保存」，离开拦截也会随之失效。
   */
  const revisionRef = useRef(0);

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

  /**
   * 一有改动就收掉「保存失败」（R96）。
   *
   * 那条状态说的是**上一次尝试**；用户改了内容之后它已经过期，
   * 继续挂着（而且原因被清空成 null）只会让人以为「现在这份也存不上」。
   */
  const clearSaveError = useCallback(() => {
    setErrorMessage(null);
    setState((current) => (current === 'error' ? 'idle' : current));
  }, []);

  const mutate = useCallback(
    (updater: (list: DraftQuestion[]) => DraftQuestion[]) => {
      /*
       * 每次结构改动都过一遍 `settleShowIf`（R98）：条件是跨题引用，
       * 删题 / 删选项 / 拖动 / 改题型都可能让它失效 —— 逐个改动点去补必然漏。
       * 在这里统一收口，画布上看到的就是**保存下去的那份**（不再出现
       * 「界面写着有条件的，存下去是无条件」）。
       */
      setQuestions((list) => settleShowIf(updater(list)));
      revisionRef.current += 1;
      setDirty(true);
      clearSaveError();
    },
    [clearSaveError],
  );

  const save = useCallback(async (): Promise<boolean> => {
    if (readOnly) return false;

    setState('saving');
    setErrorMessage(null);

    /*
     * **先兜底、再取两处**（R99）：空文案（新增后还没输、或光标还没离开）在这里统一补成占位，
     * 于是「选项字段」与「显示条件」读的是**同一份**文案 ——
     * 各读各的就会出现 R9-1：把被条件引用的选项清空后按 Ctrl+S，
     * 选项字段是补好的「选项 1」，条件里的引用还是空串，schema 便报
     * 「显示条件引用了已不存在的选项」，而那个选项明明就在那儿（只是空的）。
     * 列也在这一份里补齐（矩阵的列同样是「空着就保存」的情形）。
     */
    const list = withFilledLabels(questionsRef.current);

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
          config,
          // 矩阵的「行」存在 options 里，不能像文本题那样丢掉（见 lib/questionnaire-structure 的 hasOptionList）。
          // 文案已经在上面的 `withFilledLabels` 里补齐、trim 过了
          options: hasOptionList(question.type)
            ? question.options.map((option) => option.label)
            : [],
        };
      }),
    };

    /*
     * 直接 `await` 而不是包进 `startTransition`：**要把结果给调用方** ——
     * 「保存并离开」得知道存没存上才决定走不走（R91 · S4）。
     * 等待期的样子由 `state === 'saving'` 表达（顶栏读的就是它），不依赖 transition 的 pending。
     */
    // 发请求这一刻的版本号：返回后只有「还是这一版」才配宣布已保存（审查 #5）
    const revisionAtSave = revisionRef.current;

    try {
      const result = await saveEditorDraftAction(questionnaireId, payload);

      if (result.ok) {
        /*
         * 等待期间的修改**不在**刚存下去的 payload 里。若仍然清掉 dirty，
         * 顶栏会显示「已保存」、离开拦截也会放行，那几笔改动静默丢失。
         * 保持 dirty 并返回 false：弹层不关、用户可以再存一次（Ctrl+S 也一样）。
         */
        const unchanged = revisionRef.current === revisionAtSave;

        if (unchanged) setDirty(false);
        setState('idle');

        return unchanged;
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
        revisionRef.current += 1;
        setDirty(true);
        clearSaveError();
      },
      setIntro: (next) => {
        setIntroState(next);
        revisionRef.current += 1;
        setDirty(true);
        clearSaveError();
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
      // 删题时「依赖它」的条件由 mutate 里的 settleShowIf 一并收掉（依赖题找不到 → 条件作废），
      // 这里只负责把题删掉 —— 规则只写一处，才不会出现「删题清掉了、拖走却留着」
      removeQuestion: (key) => mutate((list) => list.filter((question) => question.key !== key)),
      /*
       * 拖动排序必须同时改 `pageIndex`（用户复测 #5）：只重排数组的话，
       * 画布按数组顺序画、作答页按 pageIndex 分组 —— 跨页拖动后两处会看到不同的顺序。
       * 规则（落点归属 + 页号归一）在 `lib/draft-pages.ts`，有单测。
       */
      reorderQuestions: (keys, movedKey) =>
        mutate((list) => reorderQuestionsWithPages(list, keys, movedKey)),
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
        mutate((list) => {
          const owner = list.find((question) => question.key === questionKey);
          const oldLabel = owner?.options.find((option) => option.key === optionKey)?.label;

          /*
           * 改名要**先**把引用改指到新名字（R98）：否则接下来那句 `settleShowIf`
           * 会把它当成「引用的选项没了」直接收掉 —— 而用户只是改了个错别字。
           */
          const renamed =
            oldLabel !== undefined && oldLabel !== label
              ? renameShowIfReferences(list, questionKey, oldLabel, label)
              : list;

          return renamed.map((question) =>
            question.key === questionKey
              ? {
                  ...question,
                  options: question.options.map((option) =>
                    option.key === optionKey ? { ...option, label } : option,
                  ),
                }
              : question,
          );
        }),
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
    [
      questionnaireId,
      title,
      intro,
      questions,
      dirty,
      state,
      errorMessage,
      mutate,
      clearSaveError,
      save,
      discard,
    ],
  );

  return <EditorDraftContext.Provider value={value}>{children}</EditorDraftContext.Provider>;
}
