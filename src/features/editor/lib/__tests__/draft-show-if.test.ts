import { describe, expect, it } from 'vitest';

import type { DraftQuestion } from '../../components/editor-draft';
import { renameShowIfReferences, resolveShowIf, settleShowIf } from '../draft-show-if';

/**
 * 显示条件的跨题规则（R98）。
 *
 * 这里守的是「画布上看到的 = 保存下去的那份」：草稿侧 `settleShowIf` 与保存侧
 * `resolveShowIf` 用同一套判断，任何一条**结构变更**都不该让两者分叉。
 * 触发条件全是「用户随手做的一步」：删选项、改名、拖动、改题型。
 */

function question(overrides: Partial<DraftQuestion> & { key: string }): DraftQuestion {
  return {
    type: 'SINGLE',
    title: overrides.key,
    description: null,
    required: false,
    shuffleOptions: false,
    pageIndex: 0,
    config: {},
    showIf: null,
    options: [],
    ...overrides,
  };
}

/**
 * 模拟 `editor-draft.updateOption` 的一次完整改动：**改引用 + 改文案在同一次 mutate 里完成**。
 * 拆开做是不行的：只改引用而文案没跟上，`settleShowIf` 会把它当失效收掉（这正是下面那条用例）。
 */
function renameOption(
  list: DraftQuestion[],
  questionKey: string,
  optionKey: string,
  newLabel: string,
) {
  const owner = list.find((item) => item.key === questionKey)!;
  const oldLabel = owner.options.find((option) => option.key === optionKey)!.label;
  const renamed = renameShowIfReferences(list, questionKey, oldLabel, newLabel);

  return renamed.map((item) =>
    item.key === questionKey
      ? {
          ...item,
          options: item.options.map((option) =>
            option.key === optionKey ? { ...option, label: newLabel } : option,
          ),
        }
      : item,
  );
}

/** Q1 单选（满意 / 不满意）+ Q2 追问，条件：Q1 选了「不满意」*/
function fixture() {
  return [
    question({
      key: 'q1',
      title: '满意吗？',
      options: [
        { key: 'o1', label: '满意' },
        { key: 'o2', label: '不满意' },
      ],
    }),
    question({
      key: 'q2',
      type: 'LONG_TEXT',
      title: '哪里不满意？',
      showIf: { dependsOnKey: 'q1', options: ['不满意'] },
    }),
  ];
}

describe('settleShowIf（草稿侧）', () => {
  it('条件成立时**原样返回引用**（每次击键都会跑，不做无谓重建）', () => {
    const list = fixture();
    const next = settleShowIf(list);

    expect(next[0]).toBe(list[0]);
    expect(next[1]).toBe(list[1]);
  });

  it('引用的选项被删且一个都不剩 → 整条条件作废（画布上立刻消失）', () => {
    const list = fixture();
    list[0]!.options = [{ key: 'o1', label: '满意' }];

    expect(settleShowIf(list)[1]!.showIf).toBeNull();
  });

  it('引用多个选项、只删掉其中一个 → 只留还有效的那个（不整条丢）', () => {
    const list = fixture();
    list[1]!.showIf = { dependsOnKey: 'q1', options: ['满意', '不满意'] };
    list[0]!.options = [{ key: 'o1', label: '满意' }];

    expect(settleShowIf(list)[1]!.showIf).toEqual({ dependsOnKey: 'q1', options: ['满意'] });
  });

  it('依赖题被拖到本题后面 → 条件作废（条件只向前看）', () => {
    const list = fixture();
    const moved = [list[1]!, list[0]!];

    expect(settleShowIf(moved)[0]!.showIf).toBeNull();
  });

  it('依赖题被删 → 条件作废', () => {
    const list = fixture();

    expect(settleShowIf([list[1]!])[0]!.showIf).toBeNull();
  });

  it('依赖题不再是选择类（题型被改过）→ 条件作废', () => {
    const list = fixture();
    list[0]!.type = 'SHORT_TEXT';
    list[0]!.options = [];

    expect(settleShowIf(list)[1]!.showIf).toBeNull();
  });

  it('勾了 0 个是「还没配完」：保留，交给 payload schema 报错', () => {
    const list = fixture();
    list[1]!.showIf = { dependsOnKey: 'q1', options: [] };

    expect(settleShowIf(list)[1]!.showIf).toEqual({ dependsOnKey: 'q1', options: [] });
  });
});

describe('renameShowIfReferences（改名跟着改）', () => {
  it('改名的选项被条件引用 → 引用改指到新名字', () => {
    const next = renameShowIfReferences(fixture(), 'q1', '不满意', '很不满意');

    expect(next[1]!.showIf).toEqual({ dependsOnKey: 'q1', options: ['很不满意'] });
  });

  it('改名之后条件仍然成立（settleShowIf 不会再把它当失效收掉）', () => {
    const settled = settleShowIf(renameOption(fixture(), 'q1', 'o2', '很不满意'));

    expect(settled[0]!.options.map((option) => option.label)).toEqual(['满意', '很不满意']);
    expect(settled[1]!.showIf).toEqual({ dependsOnKey: 'q1', options: ['很不满意'] });
  });

  it('新名字本来就在条件里 → 去重，不出现两个一样的', () => {
    const list = fixture();
    list[1]!.showIf = { dependsOnKey: 'q1', options: ['满意', '不满意'] };

    expect(renameShowIfReferences(list, 'q1', '不满意', '满意')[1]!.showIf).toEqual({
      dependsOnKey: 'q1',
      options: ['满意'],
    });
  });

  it('与自己无关的题原样返回引用', () => {
    const list = fixture();
    const next = renameShowIfReferences(list, 'q1', '满意', '很满意');

    expect(next[0]).toBe(list[0]);
  });
});

describe('resolveShowIf（保存侧）', () => {
  it('把依赖 key 翻成序号', () => {
    expect(resolveShowIf(fixture()[1]!, fixture(), 1)).toEqual({
      questionIndex: 0,
      options: ['不满意'],
    });
  });

  it('与草稿侧同一套规则：依赖题在后面 → 不下发条件', () => {
    const list = fixture();

    expect(resolveShowIf(list[1]!, [list[1]!, list[0]!], 0)).toBeUndefined();
  });

  it('勾了 0 个 → 照样下发空条件（让 schema 给出「至少要勾选一个选项」）', () => {
    const list = fixture();
    list[1]!.showIf = { dependsOnKey: 'q1', options: [] };

    expect(resolveShowIf(list[1]!, list, 1)).toEqual({ questionIndex: 0, options: [] });
  });

  it('引用的选项全没了 → 不下发（与 settleShowIf 同结论）', () => {
    const list = fixture();
    list[0]!.options = [{ key: 'o1', label: '满意' }];

    expect(resolveShowIf(list[1]!, list, 1)).toBeUndefined();
  });
});
