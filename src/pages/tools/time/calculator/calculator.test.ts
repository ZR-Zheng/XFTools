import { describe, expect, it } from 'vitest';
import { evaluateExpression, formatFraction } from './arithmetic';
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
