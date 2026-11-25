import { useEffect, useEffectEvent, useRef, useState } from 'react';
import {
  evaluateExpression,
  expressionLimit,
  formatFraction,
  operate,
  zero,
  type Fraction
} from './arithmetic';
import { CopyResult } from './widgets';
import { evaluateScientific, type AngleUnit } from './scientific';

const historyKey = 'xftools.calculator.history';
type Entry = { formula: string; result: string };
const keys = [
  ['AC', '清空算式'],
  ['⌫', '删除最后一位'],
  ['(', '左括号'],
  [')', '右括号'],
  ['7', '7'],
  ['8', '8'],
  ['9', '9'],
  ['÷', '除以'],
  ['4', '4'],
  ['5', '5'],
  ['6', '6'],
  ['×', '乘以'],
  ['1', '1'],
  ['2', '2'],
  ['3', '3'],
  ['−', '减去'],
  ['0', '0'],
  ['.', '小数点'],
  ['%', '百分比'],
  ['+', '加上']
] as const;

const scientificKeys = [
  ['sin(', 'sin', '正弦'],
  ['cos(', 'cos', '余弦'],
  ['tan(', 'tan', '正切'],
  ['^', 'xʸ', '乘方'],
  ['asin(', 'sin⁻¹', '反正弦'],
  ['acos(', 'cos⁻¹', '反余弦'],
  ['atan(', 'tan⁻¹', '反正切'],
  ['^2', 'x²', '平方'],
  ['sqrt(', '√x', '平方根'],
  ['cbrt(', '∛x', '立方根'],
  ['abs(', '|x|', '绝对值'],
  ['!', 'x!', '阶乘'],
  ['log(', 'log', '常用对数'],
  ['ln(', 'ln', '自然对数'],
  ['exp(', 'eˣ', '自然指数'],
  ['×10^', '×10ˣ', '科学记数法'],
  ['π', 'π', '圆周率'],
  ['e', 'e', '自然常数']
] as const;
const operators = ['÷', '×', '−', '+'];
const digitKeys = keys.slice(4).filter(([key]) => !operators.includes(key));
const numpad = new Map([
  ['NumpadAdd', '+'],
  ['NumpadSubtract', '-'],
  ['NumpadMultiply', '*'],
  ['NumpadDivide', '/'],
  ['NumpadEnter', '='],
  ['NumpadComma', '.'],
  ['NumpadEqual', '=']
]);

function readHistory(key: string): Entry[] {
  try {
    const saved = JSON.parse(localStorage.getItem(key) ?? '[]');
    return Array.isArray(saved)
      ? saved
          .filter(
            (item) =>
              item &&
              typeof item.formula === 'string' &&
              typeof item.result === 'string' &&
              item.formula.length <= 1024 &&
              item.result.length <= 1024
          )
          .slice(0, 12)
      : [];
  } catch {
    return [];
  }
}

const display = (value: string, answer?: string) =>
  value.replaceAll('Ans', () => (answer ? `(${answer})` : 'Ans'));

export default function BasicCalculator({
  onConvertResult,
  scientific = false
}: {
  onConvertResult: (value: string) => void;
  scientific?: boolean;
}) {
  const [expression, setExpression] = useState('');
  const [answer, setAnswer] = useState<Fraction>();
  const [memory, setMemory] = useState<Fraction>();
  const [error, setError] = useState('');
  const [settled, setSettled] = useState(false);
  const storageKey = scientific ? historyKey + '.scientific' : historyKey;
  const [history, setHistory] = useState(() => readHistory(storageKey));
  const [angle, setAngle] = useState<AngleUnit>('DEG');
  const keyboardArea = useRef<HTMLDivElement>(null);
  const expressionInput = useRef<HTMLInputElement>(null);
  const evaluate = (text: string) =>
    scientific
      ? evaluateScientific(text, angle, answer)
      : evaluateExpression(text, answer);
  let preview: Fraction | undefined;
  if (expression.trim() && !settled) {
    try {
      preview = evaluate(expression);
    } catch {
      /* Wait until the expression is complete. */
    }
  }
  const value = settled ? answer : preview;
  const result = value ? formatFraction(value) : '';

  function save(next: Entry[]) {
    setHistory(next);
    try {
      localStorage.setItem(storageKey, JSON.stringify(next));
    } catch {
      /* Keep the current session usable. */
    }
  }

  function edit(next: string) {
    setExpression(next.slice(0, expressionLimit));
    setError('');
    setSettled(false);
  }

  function equal() {
    if (settled || !expression.trim()) return;
    try {
      const next = evaluate(expression);
      const formula = display(expression, answer && formatFraction(answer));
      save(
        [{ formula, result: formatFraction(next) }, ...history].slice(0, 12)
      );
      setExpression(formula);
      setAnswer(next);
      setError('');
      setSettled(true);
    } catch (exception) {
      setError(
        exception instanceof Error ? exception.message : '无法计算此算式。'
      );
    }
  }

  function press(key: string) {
    if (key === 'AC') return edit('');
    if (key === '=') return equal();
    const input = expressionInput.current;
    const atInput = input && document.activeElement === input;
    const start = atInput
      ? (input.selectionStart ?? expression.length)
      : expression.length;
    const end = atInput ? (input.selectionEnd ?? start) : start;
    function insert(text: string, from = start) {
      edit(expression.slice(0, from) + text + expression.slice(end));
      if (atInput)
        requestAnimationFrame(() =>
          input.setSelectionRange(from + text.length, from + text.length)
        );
    }
    if (key === '⌫') {
      const previous = expression.slice(0, start);
      return insert(
        '',
        start !== end
          ? start
          : Math.max(0, start - (previous.endsWith('Ans') ? 3 : 1))
      );
    }
    const continuing = /^[+−×÷%^!]/.test(key);
    if (scientific && key.endsWith('(')) {
      if (settled) return edit(key + 'Ans)');
      if (start !== end)
        return insert(key + expression.slice(start, end) + ')');
      if (value && start === expression.length)
        return edit(key + expression + ')');
    }
    if (settled) return edit((continuing ? 'Ans' : '') + key);
    insert(key);
  }

  function keyButton(
    key: string,
    label: string,
    visible = key,
    className?: string
  ) {
    return (
      <button
        key={key}
        className={className}
        type="button"
        title={label}
        aria-label={label}
        onMouseDown={(event) => {
          if (document.activeElement === expressionInput.current)
            event.preventDefault();
        }}
        onClick={() => press(key)}
      >
        {visible}
      </button>
    );
  }

  function adjustMemory(operator: '+' | '-') {
    if (!value) return;
    try {
      setMemory(operate(memory ?? zero, value, operator));
      setError('');
    } catch (exception) {
      setError(
        exception instanceof Error ? exception.message : '无法保存到记忆。'
      );
    }
  }

  const keyboard = useEffectEvent((event: KeyboardEvent) => {
    if (
      event.defaultPrevented ||
      event.ctrlKey ||
      event.metaKey ||
      event.altKey ||
      event.isComposing
    )
      return;
    const target = event.target;
    const input = expressionInput.current;
    const editing = target === input && input !== null;
    if (
      target instanceof HTMLElement &&
      !keyboardArea.current?.contains(target) &&
      target !== document.body &&
      target !== document.documentElement &&
      target.id !== 'main-content' &&
      !target.closest('.datecalc-nav')
    )
      return;

    const key =
      event.code === 'NumpadDecimal' && (event.key === ',' || event.key === '.')
        ? '.'
        : (numpad.get(event.code) ?? event.key);
    if (key === 'Escape') {
      event.preventDefault();
      press('AC');
      return;
    }
    if (key === 'Enter' && target instanceof HTMLButtonElement) return;
    if (key === 'Enter' || key === '=') {
      event.preventDefault();
      equal();
      return;
    }
    const printable =
      /^[\d.()%+*/-]$/.test(key) || (scientific && /^[\^!a-zA-Zπ]$/.test(key));
    if (editing && !settled) {
      if (printable && key !== event.key) {
        const start = input.selectionStart ?? expression.length;
        const end = input.selectionEnd ?? start;
        event.preventDefault();
        edit(expression.slice(0, start) + key + expression.slice(end));
        requestAnimationFrame(() =>
          input.setSelectionRange(start + 1, start + 1)
        );
      }
      return;
    }
    if (printable || (!editing && key === 'Backspace')) {
      event.preventDefault();
      press(
        key === 'Backspace'
          ? '⌫'
          : key.replace('-', '−').replace('*', '×').replace('/', '÷')
      );
    }
  });

  useEffect(() => {
    const listener = (event: KeyboardEvent) => keyboard(event);
    document.addEventListener('keydown', listener);
    return () => document.removeEventListener('keydown', listener);
  }, []);

  return (
    <div
      className={`datecalc-panes datecalc-keypad-layout${scientific ? ' datecalc-scientific-layout' : ''}`}
      ref={keyboardArea}
    >
      <section
        className="datecalc-card datecalc-keypad"
        aria-label={scientific ? '科学计算' : '普通计算'}
      >
        <div className="datecalc-display">
          {scientific && (
            <div className="datecalc-angle" role="group" aria-label="角度单位">
              {(['DEG', 'RAD'] as const).map((unit) => (
                <button
                  key={unit}
                  type="button"
                  aria-pressed={unit === angle}
                  aria-label={unit === 'DEG' ? '角度 DEG' : '弧度 RAD'}
                  onClick={() => {
                    if (unit === angle) return;
                    setAngle(unit);
                    setSettled(false);
                    setError('');
                  }}
                >
                  {unit}
                </button>
              ))}
            </div>
          )}
          <label>
            <span className="sr-only">算式</span>
            <input
              ref={expressionInput}
              value={expression}
              maxLength={expressionLimit}
              onChange={(event) => edit(event.target.value)}
              inputMode={scientific ? 'text' : 'decimal'}
              autoComplete="off"
              spellCheck={false}
              placeholder="输入算式"
            />
          </label>
          {error ? (
            <p role="alert" className="datecalc-calculation-error">
              {error}
            </p>
          ) : (
            <output
              aria-label="算式结果"
              aria-live="polite"
              tabIndex={result.length > 24 ? 0 : undefined}
            >
              {result || '0'}
            </output>
          )}
        </div>
        <div className="datecalc-memory" role="group" aria-label="计算器记忆">
          <button
            type="button"
            title="清除记忆"
            disabled={!memory}
            onClick={() => setMemory(undefined)}
          >
            MC
          </button>
          <button
            type="button"
            title="读取记忆"
            disabled={!memory}
            onClick={() =>
              memory &&
              edit((settled ? '' : expression) + `(${formatFraction(memory)})`)
            }
          >
            MR
          </button>
          <button
            type="button"
            title="加到记忆"
            disabled={!value}
            onClick={() => adjustMemory('+')}
          >
            M+
          </button>
          <button
            type="button"
            title="从记忆减去"
            disabled={!value}
            onClick={() => adjustMemory('-')}
          >
            M−
          </button>
        </div>
        {scientific ? (
          <div
            className="datecalc-scientific-board"
            role="group"
            aria-label="计算器键盘"
          >
            <div
              className="datecalc-keys datecalc-scientific-tools"
              role="group"
              aria-label="编辑键"
            >
              {keys
                .slice(0, 4)
                .map(([key, label]) =>
                  keyButton(key, label, key, 'datecalc-operation')
                )}
              {keyButton('Ans', '上次结果', 'Ans', 'datecalc-operation')}
            </div>
            <div className="datecalc-calculation-keys">
              <div
                className="datecalc-keys datecalc-science-keys"
                role="group"
                aria-label="科学函数键盘"
              >
                {scientificKeys.map(([key, text, label]) =>
                  keyButton(key, label, text, 'datecalc-operation')
                )}
              </div>
              <div
                className="datecalc-keys datecalc-digit-keys"
                role="group"
                aria-label="数字键盘"
              >
                {digitKeys.map(([key, label]) => keyButton(key, label))}
              </div>
            </div>
            <div
              className="datecalc-keys datecalc-operator-keys"
              role="group"
              aria-label="运算键"
            >
              {operators.map((key) =>
                keyButton(
                  key,
                  keys.find(([value]) => value === key)![1],
                  key,
                  'datecalc-operation'
                )
              )}
              {keyButton('=', '等于', '=', 'primary-button')}
            </div>
          </div>
        ) : (
          <div className="datecalc-keys" role="group" aria-label="计算器键盘">
            {keys.map(([key, label], index) =>
              keyButton(
                key,
                label,
                key,
                index < 4 || index % 4 === 3 ? 'datecalc-operation' : undefined
              )
            )}
            {keyButton('=', '等于', '=', 'primary-button datecalc-equal')}
          </div>
        )}
      </section>
      <section className="datecalc-card datecalc-history" aria-label="计算历史">
        <div className="datecalc-result-heading">
          <h2>计算历史</h2>
          <button
            className="datecalc-clear-history"
            type="button"
            disabled={!history.length}
            onClick={() => save([])}
          >
            清空历史
          </button>
        </div>
        {!history.length && (
          <p className="datecalc-note">按等号后，算式会出现在这里。</p>
        )}
        {!!history.length && (
          <ul>
            {history.map(({ formula, result }, index) => (
              <li key={index}>
                <button
                  type="button"
                  title="将结果填入算式"
                  onClick={() => edit(result)}
                >
                  <span>{formula}</span>
                  <strong>= {result}</strong>
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="datecalc-inline-actions datecalc-basic-actions">
          <button
            type="button"
            className="secondary-button"
            disabled={!result}
            onClick={() => onConvertResult(result)}
          >
            转成大写
          </button>
          <CopyResult value={result} />
        </div>
      </section>
    </div>
  );
}
