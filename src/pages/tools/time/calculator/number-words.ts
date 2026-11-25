const chineseDigits = '零壹贰叁肆伍陆柒捌玖';
const chinesePlaces = ['', '拾', '佰', '仟'];
const chineseScales = ['', '万', '亿', '万亿', '京', '垓'];
const englishDigits = [
  'ZERO',
  'ONE',
  'TWO',
  'THREE',
  'FOUR',
  'FIVE',
  'SIX',
  'SEVEN',
  'EIGHT',
  'NINE',
  'TEN',
  'ELEVEN',
  'TWELVE',
  'THIRTEEN',
  'FOURTEEN',
  'FIFTEEN',
  'SIXTEEN',
  'SEVENTEEN',
  'EIGHTEEN',
  'NINETEEN'
];
const englishTens = [
  '',
  '',
  'TWENTY',
  'THIRTY',
  'FORTY',
  'FIFTY',
  'SIXTY',
  'SEVENTY',
  'EIGHTY',
  'NINETY'
];
const englishScales = [
  '',
  'THOUSAND',
  'MILLION',
  'BILLION',
  'TRILLION',
  'QUADRILLION',
  'QUINTILLION',
  'SEXTILLION'
];
const maxIntegerDigits = Math.min(
  chineseScales.length * 4,
  englishScales.length * 3
);

function groupsOf(integer: string, size: number) {
  const groups: string[] = [];
  for (let end = integer.length; end > 0; end -= size) {
    groups.unshift(integer.slice(Math.max(0, end - size), end));
  }
  return groups;
}

function chineseGroup(group: string) {
  let words = '';
  let zero = false;
  for (let index = 0; index < group.length; index++) {
    const digit = Number(group[index]);
    if (!digit) {
      zero = !!words;
      continue;
    }
    if (zero) words += chineseDigits[0];
    words += chineseDigits[digit] + chinesePlaces[group.length - index - 1];
    zero = false;
  }
  return words;
}

function chineseInteger(integer: string) {
  const groups = groupsOf(integer, 4);
  let words = '';
  let skipped = false;
  for (const [index, group] of groups.entries()) {
    const part = chineseGroup(group);
    if (!part) {
      skipped = true;
      continue;
    }
    if (words && (skipped || group.startsWith('0'))) words += chineseDigits[0];
    words += part + chineseScales[groups.length - index - 1];
    skipped = false;
  }
  return words || chineseDigits[0];
}

function englishGroup(value: number, british: boolean) {
  const words: string[] = [];
  const rest = value % 100;
  if (value >= 100) {
    words.push(englishDigits[Math.floor(value / 100)], 'HUNDRED');
    if (british && rest) words.push('AND');
  }
  if (rest >= 20) {
    const tens = englishTens[Math.floor(rest / 10)];
    words.push(rest % 10 ? `${tens}-${englishDigits[rest % 10]}` : tens);
  } else if (rest) words.push(englishDigits[rest]);
  return words.join(' ');
}

function englishInteger(integer: string, british = false) {
  const groups = groupsOf(integer, 3);
  const words = groups.flatMap((group, index) => {
    const value = Number(group);
    if (!value) return [];
    const part = englishGroup(value, british);
    const scale = englishScales[groups.length - index - 1];
    if (scale) return [part, scale];
    return british && index > 0 && value < 100 ? ['AND', part] : [part];
  });
  return words.join(' ') || englishDigits[0];
}

type ParsedNumber = { integer: string; fraction: string; negative: boolean };
type InvalidNumber = { error: string };

function parseNumber(input: string): ParsedNumber | InvalidNumber | null {
  const number = input
    .trim()
    .replace(/[０-９＋－，．−]/g, (char) =>
      char === '−' ? '-' : String.fromCharCode(char.charCodeAt(0) - 0xfee0)
    );
  if (!number) return null;
  if (number.length > 1024) return { error: '输入过长，请缩短后重试。' };
  const match = /^([+-]?)(\d{1,3}(?:,\d{3})+|\d*)(?:\.(\d*))?$/.exec(number);
  if (!match || !(match[2] || match[3])) {
    return { error: '请输入有效数字，例如 1,234.50。' };
  }

  const [, sign, whole, fraction = ''] = match;
  const integer = whole.replaceAll(',', '').replace(/^0+(?=\d)/, '') || '0';
  if (integer.length > maxIntegerDigits) {
    return { error: `整数部分最多支持 ${maxIntegerDigits} 位。` };
  }
  const negative = sign === '-' && (integer !== '0' || /[1-9]/.test(fraction));
  return { integer, fraction, negative };
}

type NumberWords = { chinese: string; english: string };

export function convertNumberWords(
  input: string
): NumberWords | InvalidNumber | null {
  const number = parseNumber(input);
  if (!number || 'error' in number) return number;
  const { integer, fraction, negative } = number;
  // Keep the written decimal digits, including any leading and trailing zeros.
  const digits = Array.from(fraction, Number);
  const chineseDecimal = fraction
    ? '点' + digits.map((digit) => chineseDigits[digit]).join('')
    : '';
  const englishDecimal = fraction
    ? ' POINT ' + digits.map((digit) => englishDigits[digit]).join(' ')
    : '';
  return {
    chinese: (negative ? '负' : '') + chineseInteger(integer) + chineseDecimal,
    english:
      (negative ? 'MINUS ' : '') + englishInteger(integer) + englishDecimal
  };
}

export const chequeCurrencies = {
  HKD: '港元 HKD（中英文）',
  CNY: '人民币 CNY（中文）',
  USD: '美元 USD（英文）'
} as const;
export type ChequeCurrency = keyof typeof chequeCurrencies;

type ChequeWords = {
  figures: string;
  chinese?: string;
  english?: string;
};

const hongKongCharacters: Record<string, string> = {
  贰: '貳',
  叁: '參',
  陆: '陸',
  万: '萬',
  亿: '億'
};

function chineseCheque(integer: string, cents: string, hongKong: boolean) {
  const jiao = Number(cents[0]);
  const fen = Number(cents[1]);
  const whole = chineseInteger(integer) + '元';
  const zeroBeforeJiao =
    !hongKong && integer.at(-5) === '0' && integer.endsWith('0');
  const jiaoWords = jiao
    ? (zeroBeforeJiao ? '零' : '') + chineseDigits[jiao] + '角'
    : fen
      ? '零'
      : '';
  const end = fen ? chineseDigits[fen] + '分' : hongKong ? '正' : '整';
  const amount = whole + jiaoWords + end;
  if (!hongKong) return '人民币' + amount;
  return amount.replace(
    /[贰叁陆万亿]/g,
    (character) => hongKongCharacters[character]
  );
}

export function convertChequeWords(
  input: string,
  currency: ChequeCurrency
): ChequeWords | InvalidNumber | null {
  const number = parseNumber(input);
  if (!number || 'error' in number) return number;
  const { integer, fraction, negative } = number;
  if (negative) return { error: '支票金额须为非负数。' };
  if (/[1-9]/.test(fraction.slice(2))) {
    return { error: '支票金额只能精确到分，请核对小数位。' };
  }
  const cents = fraction.slice(0, 2).padEnd(2, '0');
  const figures = `${currency} ${groupsOf(integer, 3).join(',')}.${cents}`;
  if (currency === 'CNY')
    return { figures, chinese: chineseCheque(integer, cents, false) };
  if (currency === 'USD')
    return { figures, english: `${englishInteger(integer)} AND ${cents}/100` };

  const dollars = `${englishInteger(integer, true)} HONG KONG ${integer === '1' ? 'DOLLAR' : 'DOLLARS'}`;
  const minor = Number(cents);
  const centWords = minor
    ? ` AND ${englishGroup(minor, true)} ${minor === 1 ? 'CENT' : 'CENTS'}`
    : '';
  return {
    figures,
    chinese: chineseCheque(integer, cents, true),
    english: `${dollars}${centWords} ONLY`
  };
}
