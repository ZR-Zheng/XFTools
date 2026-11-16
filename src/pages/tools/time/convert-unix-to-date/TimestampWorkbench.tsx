import { useState } from 'react';
import { useWorkbenchText } from '../../../../i18n/workbench';

export function timestampDate(value: string, unit: 'seconds' | 'milliseconds') {
  if (!value.trim() || !/^-?\d+(\.\d+)?$/.test(value.trim())) return null;
  const date = new Date(Number(value) * (unit === 'seconds' ? 1000 : 1));
  return Number.isFinite(date.getTime()) ? date : null;
}
function dateInputValue(date: Date, utc: boolean) {
  const offsetDate = utc
    ? date
    : new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return offsetDate.toISOString().slice(0, 23);
}
export default function TimestampWorkbench() {
  const { english } = useWorkbenchText();
  const [input, setInput] = useState(''),
    [unit, setUnit] = useState<'seconds' | 'milliseconds'>('seconds');
  const [utc, setUtc] = useState(true),
    [copied, setCopied] = useState('');
  const date = timestampDate(input, unit);
  const values: [string, string][] = date
    ? [
        [english ? 'Unix seconds' : 'Unix 秒', String(date.getTime() / 1000)],
        [english ? 'Unix milliseconds' : 'Unix 毫秒', String(date.getTime())],
        ['UTC / ISO 8601', date.toISOString()],
        [
          english ? 'Local time' : '本地时间',
          date.toLocaleString(english ? 'en-GB' : 'zh-CN', {
            timeZoneName: 'short',
            hour12: false
          })
        ]
      ]
    : [];
  return (
    <section className="specialized-workbench timestamp-workbench">
      <div className="timestamp-inputs">
        <div>
          <label>
            {english ? 'Unix timestamp' : 'Unix 时间戳'}
            <input
              type="text"
              inputMode="decimal"
              value={input}
              placeholder={unit === 'seconds' ? '1721287227' : '1721287227000'}
              onChange={(e) => {
                setInput(e.target.value);
                setCopied('');
              }}
            />
          </label>
          <div className="timestamp-input-actions">
            <select
              aria-label={english ? 'Timestamp unit' : '时间戳单位'}
              value={unit}
              onChange={(e) => {
                const next = e.target.value as typeof unit;
                if (date)
                  setInput(
                    String(date.getTime() / (next === 'seconds' ? 1000 : 1))
                  );
                setUnit(next);
                setCopied('');
              }}
            >
              <option value="seconds">
                {english ? 'Seconds (s)' : '秒（s）'}
              </option>
              <option value="milliseconds">
                {english ? 'Milliseconds (ms)' : '毫秒（ms）'}
              </option>
            </select>
            <button
              type="button"
              className="secondary-button"
              onClick={() => {
                setInput(
                  String(
                    Math.floor(Date.now() / (unit === 'seconds' ? 1000 : 1))
                  )
                );
                setCopied('');
              }}
            >
              {english ? 'Use current time' : '使用当前时间'}
            </button>
          </div>
        </div>
        <div>
          <label>
            {english ? 'Date and time' : '日期和时间'}
            <input
              type="datetime-local"
              step="0.001"
              value={
                date &&
                date.getUTCFullYear() > 0 &&
                date.getUTCFullYear() < 10000
                  ? dateInputValue(date, utc)
                  : ''
              }
              onChange={(e) => {
                if (!e.target.value) {
                  setInput('');
                  return;
                }
                const next = new Date(e.target.value + (utc ? 'Z' : ''));
                if (Number.isFinite(next.getTime()))
                  setInput(
                    String(next.getTime() / (unit === 'seconds' ? 1000 : 1))
                  );
                setCopied('');
              }}
            />
          </label>
          <div className="timestamp-input-actions">
            <select
              aria-label={english ? 'Date timezone' : '日期时区'}
              value={utc ? 'utc' : 'local'}
              onChange={(e) => setUtc(e.target.value === 'utc')}
            >
              <option value="utc">UTC</option>
              <option value="local">
                {english ? 'Local timezone' : '本地时区'}
              </option>
            </select>
            <span>
              {english
                ? 'Edit either field to convert'
                : '修改任一输入即可转换'}
            </span>
          </div>
        </div>
      </div>
      {input && !date && (
        <p className="tool-inline-error" role="alert">
          {english
            ? 'Enter a valid timestamp within the supported date range.'
            : '请输入有效且在日期范围内的时间戳。'}
        </p>
      )}
      {!!values.length && (
        <div className="timestamp-results" aria-live="polite">
          {values.map(([label, value]) => (
            <div key={label}>
              <span>{label}</span>
              <output>{value}</output>
              <button
                type="button"
                aria-label={`${english ? 'Copy' : '复制'} ${label}`}
                onClick={() => {
                  void navigator.clipboard
                    .writeText(value)
                    .then(() => setCopied(label))
                    .catch(() => setCopied(''));
                }}
              >
                {copied === label
                  ? english
                    ? 'Copied'
                    : '已复制'
                  : english
                    ? 'Copy'
                    : '复制'}
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
