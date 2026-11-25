import {
  expressionLimit,
  fraction,
  formatFraction,
  operate,
  zero,
  type Fraction
} from './arithmetic';

export type AngleUnit = 'DEG' | 'RAD';
const numeric = /^(\d+(?:\.\d*)?|\.\d+)(?:e([+-]?\d+))?$/i;
const invalid = () => new Error('请检查函数、运算符、括号和数字。');
const toNumber = (value: Fraction) => Number(formatFraction(value));

function decimalFraction(literal: string): Fraction {
  const [, number, exponent = '0'] = numeric.exec(literal)!;
  const [whole, digits = ''] = number.split('.');
  const scale = digits.length - Number(exponent);
  if (Math.abs(scale) > 512) throw new Error('指数超出可计算范围。');
  const value = BigInt(whole + digits);
  return scale < 0
    ? fraction(value * 10n ** BigInt(-scale))
    : fraction(value, 10n ** BigInt(scale));
}

function approximate(value: number): Fraction {
  if (!Number.isFinite(value))
    throw new Error('结果超出范围，或此函数在该数值下无定义。');
  const result = decimalFraction(Math.abs(value).toPrecision(15));
  return value < 0 ? { ...result, numerator: -result.numerator } : result;
}

function power(base: Fraction, exponent: Fraction) {
  const { numerator, denominator } = exponent;
  if (denominator !== 1n)
    return approximate(toNumber(base) ** toNumber(exponent));
  const magnitude = numerator < 0n ? -numerator : numerator;
  if (magnitude > 2048n) throw new Error('整数指数过大，请减小指数。');
  const top = base.numerator ** magnitude;
  const bottom = base.denominator ** magnitude;
  return numerator < 0n ? fraction(bottom, top) : fraction(top, bottom);
}

function factorial(value: Fraction) {
  if (value.denominator !== 1n || value.numerator < 0n)
    throw new Error('阶乘需要非负整数。');
  if (value.numerator > 250n) throw new Error('阶乘结果位数过多。');
  let result = 1n;
  for (let next = 2n; next <= value.numerator; next++) result *= next;
  return fraction(result);
}

const functions = {
  sqrt: Math.sqrt,
  cbrt: Math.cbrt,
  log: Math.log10,
  ln: Math.log,
  exp: Math.exp,
  sin: Math.sin,
  cos: Math.cos,
  tan: Math.tan,
  asin: Math.asin,
  acos: Math.acos,
  atan: Math.atan
} as const;

function call(name: string, value: Fraction, angle: AngleUnit) {
  if (name === 'abs')
    return {
      ...value,
      numerator: value.numerator < 0n ? -value.numerator : value.numerator
    };
  if (!Object.hasOwn(functions, name)) throw new Error('无法识别此科学函数。');
  let input = toNumber(value);
  if (name === 'sin' || name === 'cos' || name === 'tan') {
    if (angle === 'DEG') {
      const quarter = 90n * value.denominator;
      const reduced = value.numerator % (quarter * 4n);
      if (reduced % quarter === 0n) {
        const index = Number((reduced / quarter + 4n) % 4n);
        if (name === 'sin') return fraction([0n, 1n, 0n, -1n][index]);
        if (name === 'cos') return fraction([1n, 0n, -1n, 0n][index]);
        if (index % 2 === 0) return zero;
        throw new Error('该角度的正切无定义。');
      }
      input =
        (toNumber({ numerator: reduced, denominator: value.denominator }) *
          Math.PI) /
        180;
    } else if (name === 'tan' && Math.abs(Math.cos(input)) < 1e-15)
      throw new Error('该角度的正切无定义。');
    else if (name === 'sin' || name === 'cos') {
      const quarters = input / (Math.PI / 2);
      if (Number.isSafeInteger(quarters)) {
        const index = ((quarters % 4) + 4) % 4;
        return fraction(
          (name === 'sin' ? [0n, 1n, 0n, -1n] : [1n, 0n, -1n, 0n])[index]
        );
      }
    }
  }
  const result = functions[name as keyof typeof functions](input);
  return approximate(
    angle === 'DEG' && ['asin', 'acos', 'atan'].includes(name)
      ? (result * 180) / Math.PI
      : result
  );
}

export function evaluateScientific(
  expression: string,
  angle: AngleUnit,
  answer?: Fraction
) {
  const source = expression
    .replace(/²/g, '^2')
    .replace(/³/g, '^3')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/−/g, '-')
    .replace(/×/g, '*')
    .replace(/÷/g, '/')
    .replace(/√/g, 'sqrt');
  if (source.length > expressionLimit)
    throw new Error('算式过长，请分步计算。');
  const tokens =
    source.match(/(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?|[a-z]+|π|\S/gu) ?? [];
  let cursor = 0;
  type Term = { value: Fraction; percent?: boolean };

  function grouped() {
    const value = sum();
    if (tokens[cursor++] !== ')') throw invalid();
    return value;
  }

  function primary(): Fraction {
    const token = tokens[cursor++];
    if (token === '(') return grouped();
    if (token === 'ans' && answer) return answer;
    if (token === 'π' || token === 'pi')
      return decimalFraction(String(Math.PI));
    if (token === 'e') return decimalFraction(String(Math.E));
    if (token && numeric.test(token)) return decimalFraction(token);
    if (!token || !/^[a-z]+$/.test(token) || tokens[cursor++] !== '(')
      throw invalid();
    return call(token, grouped(), angle);
  }

  function unary(): Term {
    const head = tokens[cursor];
    if (head === '+' || head === '-') {
      cursor++;
      const term = unary();
      return head === '-'
        ? { ...term, value: operate(zero, term.value, '-') }
        : term;
    }
    let value = primary();
    while (tokens[cursor] === '!') {
      cursor++;
      value = factorial(value);
    }
    const percent = tokens[cursor] === '%';
    if (percent) {
      cursor++;
      value = operate(value, fraction(100n), '/');
    }
    if (tokens[cursor] === '^') {
      cursor++;
      return { value: power(value, unary().value) };
    }
    return { value, percent };
  }

  function product() {
    let term = unary();
    for (;;) {
      const token = tokens[cursor];
      if (token === '*' || token === '/') {
        cursor++;
        term = { value: operate(term.value, unary().value, token) };
      } else if (token && /^(?:\(|π|[a-z]+)$/.test(token)) {
        term = { value: operate(term.value, unary().value, '*') };
      } else return term;
    }
  }

  function sum() {
    let value = product().value;
    while (tokens[cursor] === '+' || tokens[cursor] === '-') {
      const operator = tokens[cursor++];
      const right = product();
      value = operate(
        value,
        right.percent ? operate(value, right.value, '*') : right.value,
        operator
      );
    }
    return value;
  }

  const value = sum();
  if (cursor !== tokens.length) throw invalid();
  return value;
}
