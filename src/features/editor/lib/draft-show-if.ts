import { SHOW_IF_SOURCE_TYPES } from '@/config/constants';

/*
 * 类型是**只读引用**（`import type`，编译后整行消失）：这个模块要能被单测直接导入，
 * 而 `../components/editor-draft` 会牵进 React 与 server action —— 运行时导入它跑不起来。
 * 这里只用到形状，不必为此把草稿类型搬一次家。
 */
import type { DraftQuestion, DraftShowIf } from '../components/editor-draft';

/**
 * 显示条件与草稿结构的同步（R98）。
 *
 * 条件是**跨题引用**：它指向「前面某道题的某些选项」，而那个选项随时可能被改名、删除，
 * 依赖的题也可能被删掉、拖动或改题型。**只要结构动了，条件就可能失效。**
 * 这个文件只负责两件事：
 *
 * 1. `settleShowIf()` —— 草稿侧：结构改完之后立刻把失效的条件收拾掉；
 * 2. `resolveShowIf()` —— 保存侧：把草稿条件翻译成 payload（依赖 key → 序号）。
 *
 * 两者必须**同源**（共用下面的 `inspect()`）。它们曾经各写一套，后果很具体：
 * 草稿里留着一条永远不成立的条件、保存时却被静默丢掉 —— 画布上写着
 * 「当 Q1 选了『周一下午』时显示」，存下去的却是「一直显示」，用户只有刷新才会发现。
 */

/** 这条条件在当前结构下「还站得住」时的信息 */
type Inspection = {
  /** 依赖题在列表里的下标 —— 也就是 payload 里的 `questionIndex` */
  questionIndex: number;
  /** 依赖题**当前**可用的选项文案 */
  available: Set<string>;
};

/**
 * 三条结构层面的硬规则（与用户填了什么无关）：
 * - 依赖题还在，且**排在本题前面**（条件只向前看，环路与求值顺序问题因此不可能存在）；
 * - 依赖题是选择类（没有选项就谈不上命中）；
 * - 引用到的文案至少还剩一个（「一个都没勾」是另一种情况，另行处理）。
 */
function inspect(question: DraftQuestion, index: number, list: DraftQuestion[]): Inspection | null {
  const showIf = question.showIf;
  if (!showIf) return null;

  const questionIndex = list.findIndex((item) => item.key === showIf.dependsOnKey);
  if (questionIndex < 0 || questionIndex >= index) return null;

  const dependsOn = list[questionIndex]!;
  if (!SHOW_IF_SOURCE_TYPES.includes(dependsOn.type)) return null;

  return { questionIndex, available: new Set(dependsOn.options.map((option) => option.label)) };
}

/** 引用的选项里，还剩哪些（保持草稿里的勾选顺序） */
function surviving(showIf: DraftShowIf, available: Set<string>): string[] {
  return showIf.options.filter((option) => available.has(option));
}

/**
 * 把已经失效的条件收拾掉（R98）：依赖题没了 / 被拖到本题后面 / 不再是选择类 → 整条作废；
 * 引用的选项被删 → 只留还存在的，**一个都不剩才连条件一起丢掉**。
 *
 * 为什么在 `mutate()` 里对所有改动统一跑一遍，而不是逐个改动点去补：
 * 条件是跨题引用，**任何一次结构改动都可能让它失效**（删题、删选项、拖动、改题型），
 * 逐个点去补必然漏。改名那条要另算（见 `renameShowIfReferences`）——
 * 改名的意图是「还是这个选项」，不能当失效处理。
 *
 * 没变的对象**原样返回引用**（`===` 相等）：这个函数每次击键都会跑，
 * 无谓的重建会让整棵树重新渲染。
 */
export function settleShowIf(list: DraftQuestion[]): DraftQuestion[] {
  return list.map((question, index) => {
    const showIf = question.showIf;
    if (!showIf) return question;

    const inspection = inspect(question, index, list);
    if (!inspection) return { ...question, showIf: null };

    // 用户勾了 0 个：那是「还没配完」的中间态，保留下来让 payload schema 给出明确报错
    if (showIf.options.length === 0) return question;

    const options = surviving(showIf, inspection.available);
    if (options.length === showIf.options.length) return question;
    if (options.length === 0) return { ...question, showIf: null };

    return { ...question, showIf: { ...showIf, options } };
  });
}

/**
 * 选项**改名**时，把引用它的条件一并改指到新名字（R98）。
 *
 * 与「删除」区别对待是刻意的：改名的意图几乎总是「还是这个选项」
 * （「周一下午」改成「周一上午」），删除才是「不要它了」。
 * 原先两者都被当成「引用失效」丢掉 —— 用户改个错别字，条件就在保存时静默消失。
 */
export function renameShowIfReferences(
  list: DraftQuestion[],
  questionKey: string,
  oldLabel: string,
  newLabel: string,
): DraftQuestion[] {
  if (oldLabel === newLabel) return list;

  return list.map((question) => {
    const showIf = question.showIf;
    if (!showIf || showIf.dependsOnKey !== questionKey) return question;
    if (!showIf.options.includes(oldLabel)) return question;

    return {
      ...question,
      // 去重：新名字可能本来就已经在这份条件里了（用户先勾了两个，再把其中一个改成另一个的名字）
      showIf: {
        ...showIf,
        options: [...new Set(showIf.options.map((item) => (item === oldLabel ? newLabel : item)))],
      },
    };
  });
}

/**
 * 草稿 → payload 的显示条件：依赖 key 换回序号。
 *
 * 这里的过滤与 `settleShowIf` 同一套规则，**不是重复劳动**：草稿可能来自
 * `toDraftQuestions` 载入的旧数据、也可能在别处被改过；这一层的职责是
 * 「交给 schema 的东西一定是干净的」。
 * 外部来源（JSON 导入、历史模板 payload）不经过这里，由 payload schema 的跨题校验拦。
 */
export function resolveShowIf(question: DraftQuestion, list: DraftQuestion[], index: number) {
  const showIf = question.showIf;
  if (!showIf) return undefined;

  const inspection = inspect(question, index, list);
  if (!inspection) return undefined;

  // 原本就是空（用户勾到 0 个）：原样带出去，让 payload schema 给出明确报错
  if (showIf.options.length === 0) {
    return { questionIndex: inspection.questionIndex, options: [] };
  }

  const options = surviving(showIf, inspection.available);

  return options.length > 0 ? { questionIndex: inspection.questionIndex, options } : undefined;
}
