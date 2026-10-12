import type { QuestionType } from '@/config/constants';

import type { QuestionConfig } from '../api/questionnaires';

/**
 * 草稿里「选项 / 行 / 列」这三串**有序文本项**的规则（R99）。
 *
 * 抽到这个纯模块里有两个理由：
 * - **可测**：「空文案怎么补占位」是真实逻辑（补得不好就会重名），得能单测；
 * - **同源**：界面（添加 / 失焦补位 / 占位提示）与保存兜底必须说同一套话 ——
 *   各写一遍就会出现「界面上看着是『选项 3』、存进去却是别的」。
 */

/**
 * 这一串文本项在这道题里叫什么：矩阵题是「行」，其余是「选项」。
 *
 * 存在的意义是**只写一遍**：新建题的默认项、添加按钮的占位文案、输入框的无障碍名
 * 都要说同一个词，各写一遍就会出现「添加」给的是「选项 3」、而输入框自称「行文案」。
 */
export function optionUnit(type: QuestionType) {
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
 * 一串文案的**保存兜底**：空着的那几格补成占位（`选项 3` / `列 2`），非空的顺带 trim。
 *
 * 为什么需要它：新增的选项与列初始是空的，补位发生在**失焦**时；而「光标还在空输入框里
 * 直接按 Ctrl+S」不会失焦 —— 那份草稿会因为 `min(1)` 被 schema 拒掉，
 * 选项那边报出来的还是 zod 的英文原话。
 *
 * 与 `title` 那句 `trim() || '未命名题目'` 是同一条规矩：
 * **空着的字段由保存兜底，界面不替用户改内容**。
 * 逐格补而不是一次算完：两格同时空着时要拿到两个**不同**的占位（文案不允许重名，R92 · N7）。
 */
export function fillEmptyLabels(unit: string, labels: readonly string[]) {
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
