import { describe, expect, it } from 'vitest';

import { escapeCsvCell, toCsv } from '@/lib/csv';

/**
 * 「转义后第 1 个字符不是 `=`」是最关键的一条断言：引号本身不阻止 Excel 求值，
 * 只有前置单引号能把它按文本处理。
 */
describe('escapeCsvCell', () => {
  it.each([
    ["=cmd|'/c calc'!A0", '公式'],
    ['+1+1', '加号开头'],
    ['-2+3', '减号开头'],
    ['@SUM(A1)', 'at 开头'],
    ['\t=1+1', '制表符开头'],
    ['\r=1+1', '回车开头'],
  ])('中和以危险字符开头的值：%s（%s）', (value) => {
    const escaped = escapeCsvCell(value);

    expect(escaped.startsWith('"\'')).toBe(true);
    // 去掉外层引号后，第一个字符必须是单引号而不是危险字符
    expect(escaped.slice(1, 2)).toBe("'");
  });

  it('双引号翻倍', () => {
    expect(escapeCsvCell('他说"好"')).toBe('"他说""好"""');
  });

  it('逗号与换行原样留在引号里', () => {
    expect(escapeCsvCell('一班,二班')).toBe('"一班,二班"');
    expect(escapeCsvCell('第一行\n第二行')).toBe('"第一行\n第二行"');
  });

  it('普通中文与空字符串照常加引号', () => {
    expect(escapeCsvCell('轻问卷')).toBe('"轻问卷"');
    expect(escapeCsvCell('')).toBe('""');
  });

  it('公式拦截不改变非危险值的语义（值本身含单引号也不加码）', () => {
    expect(escapeCsvCell("'已转义")).toBe('"\'已转义"');
    expect(escapeCsvCell('3 天')).toBe('"3 天"');
  });
});

describe('toCsv', () => {
  it('以 BOM 开头、以 CRLF 结尾，行间用 CRLF 连接', () => {
    const csv = toCsv([
      ['a', 'b'],
      ['c', 'd'],
    ]);

    expect(csv.startsWith('\uFEFF')).toBe(true);
    expect(csv.endsWith('\r\n')).toBe(true);
    expect(csv.slice(1)).toBe('"a","b"\r\n"c","d"\r\n');
  });

  it('表头与内容一起过转义：注入值不会落在单元格首位', () => {
    const csv = toCsv([['姓名'], ['=1+1']]);

    expect(csv).toBe('\uFEFF"姓名"\r\n"\'=1+1"\r\n');
  });
});
