import { useId, useState } from 'react';
import {
  chequeCurrencies,
  convertChequeWords,
  convertNumberWords,
  type ChequeCurrency
} from './number-words';
import { CopyResult, Field } from './widgets';

function WordResult({
  title,
  value,
  copyLabel,
  lang,
  cheque
}: {
  title: string;
  value?: string;
  copyLabel: string;
  lang?: string;
  cheque?: { title: string; value?: string; copyLabel: string; lang: string };
}) {
  return (
    <section className="datecalc-card" aria-label={title}>
      <div className="datecalc-result-heading">
        <h2>{title}</h2>
        <CopyResult value={value ?? ''} label={copyLabel} />
      </div>
      <output
        className="datecalc-word-output"
        aria-label={`${title}结果`}
        lang={lang}
      >
        {value ?? '—'}
      </output>
      {cheque && (
        <div>
          <div className="datecalc-result-heading datecalc-cheque-copy">
            <h3>{cheque.title}</h3>
            <CopyResult value={cheque.value ?? ''} label={cheque.copyLabel} />
          </div>
          <output
            className="datecalc-word-output"
            aria-label={`${cheque.title}结果`}
            lang={cheque.lang}
          >
            {cheque.value ?? '—'}
          </output>
        </div>
      )}
    </section>
  );
}

export default function NumberWords({
  numberInput,
  onNumberInput
}: {
  numberInput: string;
  onNumberInput: (value: string) => void;
}) {
  const hintId = useId();
  const errorId = useId();
  const [currency, setCurrency] = useState<ChequeCurrency>('HKD');
  const result = convertNumberWords(numberInput);
  const error = result && 'error' in result ? result.error : undefined;
  const words = result && !('error' in result) ? result : undefined;
  const writtenCheque = words && convertChequeWords(numberInput, currency);
  const chequeWords =
    writtenCheque && 'figures' in writtenCheque ? writtenCheque : undefined;
  const chequeError =
    writtenCheque && 'error' in writtenCheque ? writtenCheque.error : undefined;

  return (
    <div className="datecalc-panes datecalc-number-words">
      <section className="datecalc-card datecalc-fields" aria-label="数字输入">
        <Field label="输入数字">
          <input
            className="ui-input"
            inputMode="decimal"
            autoComplete="off"
            spellCheck={false}
            aria-invalid={!!error}
            aria-describedby={error ? `${hintId} ${errorId}` : hintId}
            placeholder="例如 1,234.50"
            value={numberInput}
            onChange={(event) => onNumberInput(event.target.value)}
          />
        </Field>
        <p id={hintId} className="datecalc-note">
          支持负数、小数和逗号千分位。
        </p>
        {error && (
          <p id={errorId} className="tool-inline-error" role="alert">
            {error}
          </p>
        )}
        <div className="datecalc-inline-actions">
          <button
            type="button"
            className="secondary-button"
            onClick={() => onNumberInput('1,234.50')}
          >
            填入示例
          </button>
          <button
            type="button"
            className="secondary-button"
            disabled={!numberInput}
            onClick={() => onNumberInput('')}
          >
            清空输入
          </button>
        </div>
        <Field label="支票币种">
          <select
            className="ui-input"
            value={currency}
            onChange={(event) =>
              setCurrency(event.target.value as ChequeCurrency)
            }
          >
            {Object.entries(chequeCurrencies).map(([code, label]) => (
              <option key={code} value={code}>
                {label}
              </option>
            ))}
          </select>
        </Field>
        <p className="datecalc-note" aria-live="polite">
          {chequeWords ? (
            <>
              支票金额{' '}
              <strong className="datecalc-cheque-figures">
                {chequeWords.figures}
              </strong>
            </>
          ) : (
            (chequeError ?? '支票金额精确到分。')
          )}
        </p>
      </section>
      <div className="datecalc-word-results">
        <WordResult
          title="中文大写"
          value={words?.chinese}
          copyLabel="复制中文"
          cheque={
            currency !== 'USD'
              ? {
                  title: '中文支票写法',
                  value: chequeWords?.chinese,
                  copyLabel: '复制中文支票',
                  lang: currency === 'HKD' ? 'zh-HK' : 'zh-CN'
                }
              : undefined
          }
        />
        <WordResult
          title="英文大写"
          value={words?.english}
          copyLabel="复制英文"
          lang="en-US"
          cheque={
            currency !== 'CNY'
              ? {
                  title: '英文支票写法',
                  value: chequeWords?.english,
                  copyLabel: '复制英文支票',
                  lang: currency === 'HKD' ? 'en-HK' : 'en-US'
                }
              : undefined
          }
        />
      </div>
    </div>
  );
}
