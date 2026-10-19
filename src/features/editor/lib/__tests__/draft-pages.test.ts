import { describe, expect, it } from 'vitest';

import { reorderQuestionsWithPages } from '../draft-pages';

/**
 * 拖动排序之后，画布顺序与作答页的分页必须仍然一致（用户复测 #5）。
 * 下面每条断言都用 `key:pageIndex` 的形式写出来，一眼能看出「谁去了第几页」。
 */
const q = (key: string, pageIndex: number) => ({ key, pageIndex });
const shape = (list: { key: string; pageIndex: number }[]) =>
  list.map((item) => `${item.key}:${item.pageIndex}`).join(',');

describe('reorderQuestionsWithPages', () => {
  it('同页内换位：pageIndex 不变', () => {
    const list = [q('a', 0), q('b', 0)];

    expect(shape(reorderQuestionsWithPages(list, ['b', 'a'], 'a'))).toBe('b:0,a:0');
  });

  it('把第 2 页的题拖到第 1 页：它落到第 1 页，后面仍是第 2 页', () => {
    const list = [q('a', 0), q('b', 0), q('c', 1), q('d', 1)];

    // 拖 c 到 a 与 b 之间：它并入第 1 页，d 仍是第 2 页的第一道
    expect(shape(reorderQuestionsWithPages(list, ['a', 'c', 'b', 'd'], 'c'))).toBe(
      'a:0,c:0,b:0,d:1',
    );
  });

  it('拖到最前面：跟随后一道题所在的那一页', () => {
    const list = [q('a', 0), q('b', 0), q('c', 1)];

    expect(shape(reorderQuestionsWithPages(list, ['c', 'a', 'b'], 'c'))).toBe('c:0,a:0,b:0');
  });

  it('某页唯一一道题被拖走：那一页消失，页号不留空洞', () => {
    const list = [q('a', 0), q('b', 1)];

    expect(shape(reorderQuestionsWithPages(list, ['b', 'a'], 'b'))).toBe('b:0,a:0');
  });

  it('把一页的第一道拖走：剩下的题仍自成一页（页号重新连续）', () => {
    const list = [q('a', 0), q('b', 0), q('c', 1), q('d', 1), q('e', 2)];

    expect(shape(reorderQuestionsWithPages(list, ['a', 'c', 'b', 'd', 'e'], 'c'))).toBe(
      'a:0,c:0,b:0,d:1,e:2',
    );
  });

  it('键集合对不上时原样返回，不丢题', () => {
    const list = [q('a', 0), q('b', 0)];

    expect(shape(reorderQuestionsWithPages(list, ['a'], 'a'))).toBe('a:0,b:0');
  });
});
