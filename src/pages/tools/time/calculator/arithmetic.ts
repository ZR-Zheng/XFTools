export interface Fraction {
  numerator: bigint;
  denominator: bigint;
}

export const zero: Fraction = { numerator: 0n, denominator: 1n };
const magnitudeLimit = 10n ** 512n;

export function fraction(numerator: bigint, denominator = 1n): Fraction {
  if (denominator === 0n) throw new Error('除数不能为零。');
  let a = numerator < 0n ? -numerator : numerator;
  let b = denominator < 0n ? -denominator : denominator;
  while (b !== 0n) [a, b] = [b, a % b];
  const divisor = denominator < 0n ? -a : a;
  const result = {
    numerator: numerator / divisor,
    denominator: denominator / divisor
  };
  if (
    result.numerator > magnitudeLimit ||
    result.numerator < -magnitudeLimit ||
    result.denominator > magnitudeLimit
  )
    throw new Error('结果位数过多，请缩小数值后重试。');
  return result;
}

export function operate(a: Fraction, b: Fraction, operator: string): Fraction {
  const { numerator: x, denominator: y } = a;
  const { numerator: u, denominator: v } = b;
  switch (operator) {
    case '+':
      return fraction(x * v + u * y, y * v);
    case '-':
      return fraction(x * v - u * y, y * v);
    case '*':
      return fraction(x * u, y * v);
    case '/':
      return fraction(x * v, y * u);
    default:
      throw new Error('算式包含未知运算符。');
  }
}

export const expressionLimit = 180;
const hundred = fraction(100n);
const invalid = () => new Error('请检查运算符、括号和数字。');

export function evaluateExpression(
  expression: string,
  previous?: Fraction
): Fraction {
  const text = expression
    .normalize('NFKC')
    .replace(/[−×÷]/g, (character) =>
      character === '−' ? '-' : character === '×' ? '*' : '/'
    );
  if (text.length > expressionLimit) throw new Error('算式过长，请分步计算。');
  const segments = [
    ...text.matchAll(/\d+(?:\.\d*)?|\.\d+|Ans|[+\-*/()%]|\s+|./gu)
  ]
    .map(([token]) => token)
    .filter((token) => token.trim());
  let cursor = 0;
  type Term = { value: Fraction; percent?: boolean };

  function primary(): Term {
    const token = segments[cursor++];
    if (token === '+' || token === '-') {
      const term = primary();
      return token === '-'
        ? { ...term, value: operate(zero, term.value, '-') }
        : term;
    }
    let term: Term;
    if (token === '(') {
      term = sum();
      if (segments[cursor++] !== ')') throw invalid();
    } else if (token === 'Ans' && previous) {
      term = { value: previous };
    } else if (token && /^(?:\d+(?:\.\d*)?|\.\d+)$/.test(token)) {
      const [whole, digits = ''] = token.split('.');
      term = {
        value: fraction(BigInt(whole + digits), 10n ** BigInt(digits.length))
      };
    } else throw invalid();
    if (segments[cursor] === '%') {
      cursor++;
      return { value: operate(term.value, hundred, '/'), percent: true };
    }
    return term;
  }

  function product(): Term {
    let left = primary();
    while (segments[cursor] === '*' || segments[cursor] === '/') {
      const operator = segments[cursor++];
      left = { value: operate(left.value, primary().value, operator) };
    }
    return left;
  }

  function sum(): Term {
    let left = product();
    while (segments[cursor] === '+' || segments[cursor] === '-') {
      const operator = segments[cursor++];
      const right = product();
      const operand = right.percent
        ? operate(left.value, right.value, '*')
        : right.value;
      left = { value: operate(left.value, operand, operator) };
    }
    return left;
  }

  const result = sum().value;
  if (cursor !== segments.length) throw invalid();
  return result;
}

export function formatFraction(value: Fraction): string {
  const negative = value.numerator < 0n;
  const number = negative ? -value.numerator : value.numerator;
  const whole = number / value.denominator;
  const remainder = number % value.denominator;
  if (!remainder) return (negative ? '-' : '') + String(whole);
  let denominator = value.denominator;
  let twos = 0;
  let fives = 0;
  while (denominator % 2n === 0n) {
    denominator /= 2n;
    twos++;
  }
  while (denominator % 5n === 0n) {
    denominator /= 5n;
    fives++;
  }
  // Terminating decimals retain all digits. Round repeating decimals for display.
  const exponent =
    number < value.denominator
      ? Math.max(0, String(value.denominator).length - String(number).length)
      : 0;
  const precision = denominator === 1n ? Math.max(twos, fives) : 18 + exponent;
  const unit = 10n ** BigInt(precision);
  const rounded =
    (number * unit * 2n + value.denominator) / (value.denominator * 2n);
  const decimal = String(rounded % unit)
    .padStart(precision, '0')
    .replace(/0+$/, '');
  return (
    (negative && rounded !== 0n ? '-' : '') +
    String(rounded / unit) +
    (decimal ? '.' + decimal : '')
  );
}
