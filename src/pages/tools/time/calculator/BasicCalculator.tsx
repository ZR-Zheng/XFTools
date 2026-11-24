import { useState, type KeyboardEvent } from 'react';
import {
  evaluateExpression,
  expressionLimit,
  formatFraction,
  operate,
  zero,
  type Fraction
} from './arithmetic';
import { CopyResult } from './widgets';

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

function readHistory(): Entry[] {
  try {
    const saved = JSON.parse(localStorage.getItem(historyKey) ?? '[]');
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

export default function BasicCalculator() {
  const [expression, setExpression] = useState('');
  const [answer, setAnswer] = useState<Fraction>();
  const [memory, setMemory] = useState<Fraction>();
  const [error, setError] = useState('');
  const [settled, setSettled] = useState(false);
  const [history, setHistory] = useState(readHistory);
  let preview: Fraction | undefined;
  if (expression.trim() && !settled) {
    try {
      preview = evaluateExpression(expression, answer);
    } catch {
      /* Wait until the expression is complete. */
    }
  }
  const value = settled ? answer : preview;
  const result = value ? formatFraction(value) : '';

  function save(next: Entry[]) {
    setHistory(next);
    try {
      localStorage.setItem(historyKey, JSON.stringify(next));
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
      const next = evaluateExpression(expression, answer);
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
    if (key === '⌫')
      return edit(
        expression.endsWith('Ans')
          ? expression.slice(0, -3)
          : expression.slice(0, -1)
      );
    if (key === '=') return equal();
    const continuing = /^[+−×÷%]$/.test(key);
    edit((settled ? (continuing ? 'Ans' : '') : expression) + key);
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

  function keyboard(event: KeyboardEvent<HTMLElement>) {
    if (
      event.ctrlKey ||
      event.metaKey ||
      event.altKey ||
      event.nativeEvent.isComposing
    )
      return;
    const key = event.key;
    if (key === 'Escape') {
      event.preventDefault();
      press('AC');
      return;
    }
    if (event.target instanceof HTMLInputElement) {
      if (key === 'Enter' || key === '=') {
        event.preventDefault();
        equal();
      } else if (settled && /^[\d.()+*/%-]$/.test(key)) {
        event.preventDefault();
        press(key.replace('-', '−').replace('*', '×').replace('/', '÷'));
      }
      return;
    }
    if (key === 'Enter' && event.target instanceof HTMLButtonElement) return;
    if (/^[\d.()%=+*/-]$/.test(key) || key === 'Backspace' || key === 'Enter') {
      event.preventDefault();
      press(
        key === 'Enter'
          ? '='
          : key === 'Backspace'
            ? '⌫'
            : key.replace('-', '−').replace('*', '×').replace('/', '÷')
      );
    }
  }

  return (
    <div className="datecalc-panes datecalc-keypad-layout" onKeyDown={keyboard}>
      <section className="datecalc-card datecalc-keypad" aria-label="普通计算">
        <div className="datecalc-display">
          <label>
            <span className="sr-only">算式</span>
            <input
              value={expression}
              maxLength={expressionLimit}
              onChange={(event) => edit(event.target.value)}
              inputMode="decimal"
              autoComplete="off"
              spellCheck={false}
              placeholder="输入算式"
            />
          </label>
          <output aria-label="算式结果" aria-live="polite">
            {result || '0'}
          </output>
          {error && (
            <p role="alert" className="tool-inline-error">
              {error}
            </p>
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
        <div className="datecalc-keys" role="group" aria-label="计算器键盘">
          {keys.map(([key, label], index) => (
            <button
              key={key}
              className={
                index < 4 || index % 4 === 3 ? 'datecalc-operation' : undefined
              }
              type="button"
              aria-label={label}
              onClick={() => press(key)}
            >
              {key}
            </button>
          ))}
          <button
            className="primary-button datecalc-equal"
            type="button"
            aria-label="等于"
            onClick={equal}
          >
            =
          </button>
        </div>
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
        <CopyResult value={result} />
      </section>
    </div>
  );
}
