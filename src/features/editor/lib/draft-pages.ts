export type PageAwareQuestion = { key: string; pageIndex: number };

/**
 * 拖动排序后重算分页（用户复测 #5）。
 *
 * 原先 `reorderQuestions` 只重排数组、**不动 `pageIndex`**：画布按数组顺序画，
 * 作答页却按 `pageIndex` 分组 —— 把第 3 页的题拖到第 1 页，画布上它在第一页，
 * 作答者却在「第三部分」看到它。两处看到的是两份不同的问卷。
 *
 * 规则两条：
 * 1. **落点归属**：跟「前一道题」同一页（拖到最前则跟后一道题）。这与拖拽的直觉一致：
 *    插到某个位置，就并入那个位置所在的页。
 * 2. **页号归一**：相邻 `pageIndex` 不同即一个新分页，编号收成 0..n-1 ——
 *    某页最后一道题被拖走时那一页会整体消失，不收号就会在页码里留一个空洞。
 *
 * 纯函数，单独成文件：这是「画布顺序 = 作答顺序」的唯一保证，必须能穷举。
 */
export function reorderQuestionsWithPages<T extends PageAwareQuestion>(
  list: readonly T[],
  keys: readonly string[],
  movedKey: string,
): T[] {
  const byKey = new Map(list.map((question) => [question.key, question]));
  const reordered = keys.flatMap((key) => {
    const question = byKey.get(key);
    return question ? [question] : [];
  });

  // 键集合对不上（并发改动 / 调用方传错）：原样返回，绝不悄悄丢题
  if (reordered.length !== list.length) return [...list];

  const movedIndex = reordered.findIndex((question) => question.key === movedKey);
  if (movedIndex === -1) return reordered;

  const anchor = movedIndex > 0 ? reordered[movedIndex - 1] : reordered[1];
  const pageIndex = anchor ? anchor.pageIndex : reordered[movedIndex]!.pageIndex;

  const adjusted = reordered.map((question) =>
    question.key === movedKey ? { ...question, pageIndex } : question,
  );

  let page = 0;

  return adjusted.map((question, index) => {
    if (index > 0 && question.pageIndex !== adjusted[index - 1]!.pageIndex) page += 1;

    return question.pageIndex === page ? question : { ...question, pageIndex: page };
  });
}
