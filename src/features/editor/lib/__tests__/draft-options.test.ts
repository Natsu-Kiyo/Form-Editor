import { describe, expect, it } from 'vitest';

import { fillEmptyLabels, nextFreeOptionLabel, optionUnit } from '../draft-options';

/**
 * 文案规则的单测（R9-2）。
 *
 * 这两条以前是 `editor-draft.tsx` 里的私有函数，**测不到** ——
 * 而它们恰恰是「保存兜底」那条路径的全部逻辑（R9-1 的 🟡 就藏在这一带）。
 */

describe('optionUnit', () => {
  it('矩阵题的那串文本项叫「行」，其余叫「选项」', () => {
    expect(optionUnit('MATRIX')).toBe('行');
    expect(optionUnit('SINGLE')).toBe('选项');
    expect(optionUnit('DROPDOWN')).toBe('选项');
  });
});

describe('nextFreeOptionLabel', () => {
  it('从 1 开始取第一个没被占用的编号', () => {
    expect(nextFreeOptionLabel('选项', ['选项 1', '选项 2'])).toBe('选项 3');
    expect(nextFreeOptionLabel('行', ['行 1'])).toBe('行 2');
  });

  it('删掉中间一个再添加：把空出来的编号补上，而不是撞名', () => {
    expect(nextFreeOptionLabel('选项', ['选项 1', '选项 3'])).toBe('选项 2');
  });

  it('比较前先 trim（带空格的文案不该被当成另一个）', () => {
    expect(nextFreeOptionLabel('选项', [' 选项 1 '])).toBe('选项 2');
  });
});

describe('fillEmptyLabels', () => {
  it('空的补占位，非空的 trim', () => {
    expect(fillEmptyLabels('选项', [' 满意 ', '', '一般'])).toEqual(['满意', '选项 1', '一般']);
  });

  it('两格同时空着 → 两个**不同**的占位（重名会被 schema 拦下）', () => {
    expect(fillEmptyLabels('选项', ['', ''])).toEqual(['选项 1', '选项 2']);
  });

  it('矩阵的列用「列」这个词', () => {
    expect(fillEmptyLabels('列', ['满意', ''])).toEqual(['满意', '列 1']);
  });
});
