import { describe, expect, it } from 'vitest';
import { evaluateExpression, formatFraction } from './arithmetic';
import { evaluateScientific } from './scientific';
import { convertChequeWords, convertNumberWords } from './number-words';
import {
  calendarSpan,
  countWorkdays,
  dayFacts,
  nextBirthday,
  printDate,
  readDate,
  readZoned,
  shiftMonths
} from './calendar';

const date = (label: string) => readDate(label)!;

describe('calculator arithmetic', () => {
  it.each([
    ['0.1 + 0.2', '0.3'],
    ['（2＋3）×−4', '-20'],
    ['200 + 10%', '220'],
    ['200 − 10%', '180'],
    ['200 × 85%', '170'],
    ['1 ÷ 3', '0.333333333333333333'],
    ['1 ÷ 0.00000000000000000001', '100000000000000000000']
  ])('evaluates %s', (expression, result) => {
    expect(formatFraction(evaluateExpression(expression))).toBe(result);
  });
  it('uses the exact previous result and reports malformed expressions', () => {
    expect(
      formatFraction(evaluateExpression('Ans × 3', evaluateExpression('1 / 3')))
    ).toBe('1');
    expect(() => evaluateExpression('1/0')).toThrow('除数不能为零');
    expect(() => evaluateExpression('1+(2')).toThrow();
  });
});

describe('scientific calculations', () => {
  it.each([
    ['2^3^2', 'DEG', '512'],
    ['-2²', 'DEG', '-4'],
    ['2^-3 + 3!', 'DEG', '6.125'],
    ['sin(30) + cos(90)', 'DEG', '0.5'],
    ['atan(1)', 'DEG', '45'],
    ['cos(π/2)', 'RAD', '0'],
    ['sqrt(2.25) - 1.5', 'RAD', '0'],
    ['cbrt(-8) + log(100) + abs(-1e-4)', 'DEG', '0.0001'],
    ['2(1 + 3)', 'DEG', '8']
  ] as const)('evaluates %s in %s', (expression, angle, result) => {
    expect(formatFraction(evaluateScientific(expression, angle))).toBe(result);
  });
  it('reports undefined real operations and preserves the exact previous answer', () => {
    expect(() => evaluateScientific('tan(90)', 'DEG')).toThrow('正切无定义');
    expect(() => evaluateScientific('sqrt(-2)', 'RAD')).toThrow('无定义');
    expect(() => evaluateScientific('2.5!', 'DEG')).toThrow('非负整数');
    expect(
      formatFraction(
        evaluateScientific('Ans * 3', 'DEG', evaluateScientific('1/3', 'DEG'))
      )
    ).toBe('1');
  });
});

describe('number words', () => {
  it.each([
    ['0', '零', 'ZERO'],
    [
      '1,234.50',
      '壹仟贰佰叁拾肆点伍零',
      'ONE THOUSAND TWO HUNDRED THIRTY-FOUR POINT FIVE ZERO'
    ],
    [
      '−１，００２．０５０',
      '负壹仟零贰点零伍零',
      'MINUS ONE THOUSAND TWO POINT ZERO FIVE ZERO'
    ],
    ['-.0070', '负零点零零柒零', 'MINUS ZERO POINT ZERO ZERO SEVEN ZERO'],
    ['-00.00', '零点零零', 'ZERO POINT ZERO ZERO'],
    ['100010001', '壹亿零壹万零壹', 'ONE HUNDRED MILLION TEN THOUSAND ONE'],
    [
      '9007199254740993',
      '玖仟零柒万亿壹仟玖佰玖拾贰亿伍仟肆佰柒拾肆万零玖佰玖拾叁',
      'NINE QUADRILLION SEVEN TRILLION ONE HUNDRED NINETY-NINE BILLION TWO HUNDRED FIFTY-FOUR MILLION SEVEN HUNDRED FORTY THOUSAND NINE HUNDRED NINETY-THREE'
    ]
  ])('converts %s without losing digits', (input, chinese, english) => {
    expect(convertNumberWords(input)).toEqual({ chinese, english });
  });

  it('rejects ambiguous inputs and integers beyond the supported scales', () => {
    expect(convertNumberWords('  ')).toBeNull();
    for (const input of [
      '12,34.5',
      '1.0.2',
      '10²',
      '1 + 2',
      '1' + '0'.repeat(24)
    ]) {
      expect(convertNumberWords(input)).toHaveProperty('error');
    }
  });
});

describe('cheque amounts', () => {
  it.each([
    ['0', '人民币零元整'],
    ['1,409.50', '人民币壹仟肆佰零玖元伍角整'],
    ['16,409.02', '人民币壹万陆仟肆佰零玖元零贰分'],
    ['107,000.53', '人民币壹拾万柒仟元零伍角叁分']
  ])('formats %s as Chinese yuan', (input, chinese) => {
    expect(convertChequeWords(input, 'CNY')).toMatchObject({ chinese });
  });

  it.each([
    ['1.01', '壹元零壹分', 'ONE HONG KONG DOLLAR AND ONE CENT ONLY'],
    ['2,006', '貳仟零陸元正', 'TWO THOUSAND AND SIX HONG KONG DOLLARS ONLY'],
    [
      '12,345.67',
      '壹萬貳仟參佰肆拾伍元陸角柒分',
      'TWELVE THOUSAND THREE HUNDRED AND FORTY-FIVE HONG KONG DOLLARS AND SIXTY-SEVEN CENTS ONLY'
    ]
  ])(
    'formats %s in both Hong Kong cheque styles',
    (input, chinese, english) => {
      expect(convertChequeWords(input, 'HKD')).toMatchObject({
        chinese,
        english
      });
    }
  );

  it('uses two cents digits for USD and keeps the amount exact', () => {
    expect(convertChequeWords('1,234.500', 'USD')).toEqual({
      figures: 'USD 1,234.50',
      english: 'ONE THOUSAND TWO HUNDRED THIRTY-FOUR AND 50/100'
    });
    expect(convertChequeWords('17', 'USD')).toMatchObject({
      english: 'SEVENTEEN AND 00/100'
    });
    expect(convertChequeWords('.05', 'USD')).toMatchObject({
      english: 'ZERO AND 05/100'
    });
  });

  it('rejects negative amounts and fractions smaller than a cent', () => {
    expect(convertChequeWords('-1.25', 'HKD')).toHaveProperty(
      'error',
      '支票金额须为非负数。'
    );
    expect(convertChequeWords('1.005', 'CNY')).toHaveProperty(
      'error',
      '支票金额只能精确到分，请核对小数位。'
    );
  });
});

describe('calendar calculations', () => {
  it('validates dates and clamps month arithmetic at the end of the month', () => {
    expect(readDate('2023-02-29')).toBeNull();
    expect(printDate(shiftMonths(date('2024-01-31'), 1))).toBe('2024-02-29');
    expect(printDate(shiftMonths(date('2024-03-31'), -1))).toBe('2024-02-29');
    expect(dayFacts(date('2021-01-01'))).toEqual({
      weekday: '星期五',
      weekYear: 2020,
      week: 53
    });
  });
  it('handles leap-day birthdays without reporting twelve months as an age remainder', () => {
    const birth = date('2020-02-29');
    expect(calendarSpan(birth, date('2024-02-28'))).toEqual({
      years: 3,
      months: 11,
      days: 30
    });
    expect(printDate(nextBirthday(birth, date('2025-02-01')))).toBe(
      '2025-02-28'
    );
  });
  it('counts both range boundaries and applies custom exclusions once', () => {
    const start = date('2024-01-01');
    const end = date('2024-01-07');
    const excluded = new Set([start, end]);
    expect(countWorkdays(start, end, false, excluded)).toEqual({
      days: 4,
      rest: 3,
      length: 7
    });
    expect(countWorkdays(end, start, true, excluded)).toEqual({
      days: 5,
      rest: 2,
      length: 7
    });
  });
  it('resolves time-zone offsets for the date chosen and rejects skipped summer-time hours', () => {
    const noon = '12:00';
    expect(readZoned('2024-07-01', noon, 'America/New_York')).toBe(
      readZoned('2024-07-01', '16:00', 'UTC')
    );
    expect(readZoned('2024-01-01', noon, 'America/New_York')).toBe(
      readZoned('2024-01-01', '17:00', 'UTC')
    );
    expect(readZoned('2024-03-10', '02:30', 'America/New_York')).toBeNull();
  });
});
