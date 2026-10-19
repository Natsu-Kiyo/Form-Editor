import { describe, expect, it } from 'vitest';

import { stableJson } from '../stable-json';

/**
 * 版本快照的「结构没变就不写」靠它（用户复测 #4）：
 * JSONB 读回来的键序与写入时不同，普通 JSON.stringify 比较永远不会相等。
 */
describe('stableJson', () => {
  it('键序不同算同一个结构（JSONB 会重排键）', () => {
    expect(stableJson({ b: 1, a: 2 })).toBe(stableJson({ a: 2, b: 1 }));
  });

  it('嵌套对象的键序也无关', () => {
    const written = { title: '问卷', config: { showIf: { options: ['a'] }, min: 0 } };
    const readBack = { config: { min: 0, showIf: { options: ['a'] } }, title: '问卷' };

    expect(stableJson(written)).toBe(stableJson(readBack));
  });

  it('数组顺序仍然有意义（题目与选项的顺序就是结构）', () => {
    expect(stableJson({ options: ['甲', '乙'] })).not.toBe(stableJson({ options: ['乙', '甲'] }));
  });

  it('与 JSON.stringify 一样丢掉值为 undefined 的键', () => {
    expect(stableJson({ a: 1, b: undefined })).toBe('{"a":1}');
  });

  it('内容不同就是不同（不会把改动当成没变）', () => {
    expect(stableJson({ a: 1 })).not.toBe(stableJson({ a: 2 }));
    expect(stableJson({ a: 1 })).not.toBe(stableJson({ a: 1, b: 2 }));
  });
});
