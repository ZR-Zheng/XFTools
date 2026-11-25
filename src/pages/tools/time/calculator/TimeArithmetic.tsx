import { useState } from 'react';
import { formatFraction } from './arithmetic';
import { currentEndpoint } from './calendar';
import { Field, ModeGrid } from './widgets';

const msPerDay = 86_400_000n;

function parseDuration(value: string) {
  const match = value
    .trim()
    .replace('−', '-')
    .match(/^([+-]?)(\d{1,12}):([0-5]\d)(?::([0-5]\d)(?:\.(\d{1,3}))?)?$/);
  if (!match) return null;
  const [, sign, hours, minutes, seconds = '0', fraction = '0'] = match;
  const absolute =
    BigInt(hours) * 3_600_000n +
    BigInt(minutes) * 60_000n +
    BigInt(seconds) * 1000n +
    BigInt(fraction.padEnd(3, '0'));
  return sign === '-' ? -absolute : absolute;
}

function clockText(value: bigint) {
  const absolute = value < 0n ? -value : value;
  const suffix = absolute % 1000n;
  const two = (n: bigint) => String(n).padStart(2, '0');
  return (
    (value < 0n ? '−' : '') +
    two(absolute / 3_600_000n) +
    ':' +
    two((absolute / 60_000n) % 60n) +
    ':' +
    two((absolute / 1000n) % 60n) +
    (suffix ? '.' + String(suffix).padStart(3, '0').replace(/0+$/, '') : '')
  );
}

const units = [
  ['days', '天', msPerDay],
  ['hours', '小时', 3_600_000n],
  ['minutes', '分', 60_000n],
  ['seconds', '秒', 1000n]
] as const;
type DurationParts = Record<(typeof units)[number][0], string>;
const emptyParts: DurationParts = {
  days: '',
  hours: '',
  minutes: '',
  seconds: ''
};

function durationValue(parts: DurationParts) {
  let total = 0n;
  for (const [key, , unit] of units) {
    const value = parts[key].trim().replace('−', '-');
    if (!value) continue;
    const match = /^([+-]?)(\d{0,12})(?:\.(\d{1,3}))?$/.exec(value);
    if (!match || !(match[2] || match[3])) return null;
    const [, sign, integer, fraction = ''] = match;
    const absolute =
      BigInt(integer || '0') * unit +
      (BigInt(fraction.padEnd(3, '0')) * unit) / 1000n;
    total += sign === '-' ? -absolute : absolute;
  }
  return total;
}

function durationParts(value: bigint): DurationParts {
  const absolute = value < 0n ? -value : value;
  const unitValue = (part: bigint) =>
    part ? String(value < 0n ? -part : part) : '';
  return {
    days: unitValue(absolute / msPerDay),
    hours: unitValue((absolute / 3_600_000n) % 24n),
    minutes: unitValue((absolute / 60_000n) % 60n),
    seconds:
      value % 60_000n
        ? formatFraction({ numerator: value % 60_000n, denominator: 1000n })
        : ''
  };
}

function DurationFields({
  label,
  value,
  onChange
}: {
  label: string;
  value: DurationParts;
  onChange: (value: DurationParts) => void;
}) {
  return (
    <fieldset
      className="datecalc-endpoint"
      onPaste={(event) => {
        const pasted = parseDuration(event.clipboardData.getData('text'));
        if (pasted === null) return;
        event.preventDefault();
        onChange(durationParts(pasted));
      }}
    >
      <legend>{label}</legend>
      <div className="datecalc-period-grid">
        {units.map(([key, unit]) => (
          <Field key={key} label={unit}>
            <input
              className="ui-input"
              type="text"
              inputMode="decimal"
              aria-label={`${label}${unit}`}
              placeholder="0"
              value={value[key]}
              onChange={(event) =>
                onChange({ ...value, [key]: event.target.value })
              }
            />
          </Field>
        ))}
      </div>
    </fieldset>
  );
}

const sampleTimes = { first: '23:20', second: '01:10' };

export default function TimeArithmetic() {
  const [type, setType] = useState('duration');
  const [sign, setSign] = useState('plus');
  const [durations, setDurations] = useState({
    first: emptyParts,
    second: emptyParts
  });
  const [times, setTimes] = useState(sampleTimes);
  const [nextDay, setNextDay] = useState<boolean | null>(null);
  const clock = type === 'clock';
  const a = clock ? parseDuration(times.first) : durationValue(durations.first);
  const b = clock
    ? parseDuration(times.second)
    : durationValue(durations.second);
  const hasDuration =
    Object.values(durations.first).some(Boolean) ||
    Object.values(durations.second).some(Boolean);
  const overnight = nextDay ?? (a !== null && b !== null && b < a);
  const total =
    a !== null && b !== null && (clock || hasDuration)
      ? clock
        ? b - a + (overnight ? msPerDay : 0n)
        : a + (sign === 'plus' ? b : -b)
      : null;
  const reversed = clock && total !== null && total < 0n;
  const value = total === null || reversed ? '' : clockText(total);
  const error = reversed
    ? '请选择次日结束，或交换开始和结束时间。'
    : !clock && (a === null || b === null)
      ? '请填写有效数值，最多三位小数。'
      : undefined;
  return (
    <ModeGrid
      data={
        value && total !== null
          ? {
              value,
              copy: value,
              rows: [
                [
                  '总秒数',
                  formatFraction({ numerator: total, denominator: 1000n })
                ],
                ['总毫秒数', String(total)]
              ]
            }
          : undefined
      }
      error={error}
    >
      <h2>时长计算</h2>
      <div
        className="datecalc-modes datecalc-mode-picker"
        role="group"
        aria-label="计算方式"
      >
        <button
          type="button"
          aria-pressed={!clock}
          onClick={() => setType('duration')}
        >
          时长加减
        </button>
        <button
          type="button"
          aria-pressed={clock}
          onClick={() => setType('clock')}
        >
          两时刻间隔
        </button>
      </div>
      {clock ? (
        <>
          <div className="datecalc-endpoint-grid">
            {(
              [
                ['first', '开始时间'],
                ['second', '结束时间']
              ] as const
            ).map(([key, label]) => (
              <div className="datecalc-shortcut-field" key={key}>
                <Field label={label}>
                  <input
                    className="ui-input"
                    type="time"
                    step={1}
                    value={times[key]}
                    onChange={(event) =>
                      setTimes({ ...times, [key]: event.target.value })
                    }
                  />
                </Field>
                <button
                  type="button"
                  className="datecalc-shortcut"
                  aria-label={`将${label}设为现在`}
                  onClick={() =>
                    setTimes({ ...times, [key]: currentEndpoint().time })
                  }
                >
                  现在
                </button>
              </div>
            ))}
          </div>
          <label className="datecalc-check">
            <input
              type="checkbox"
              checked={overnight}
              onChange={(event) => setNextDay(event.target.checked)}
            />{' '}
            次日结束
          </label>
        </>
      ) : (
        <>
          <DurationFields
            label="时长 A"
            value={durations.first}
            onChange={(first) => setDurations({ ...durations, first })}
          />
          <div
            className="datecalc-modes datecalc-mode-picker"
            role="group"
            aria-label="运算"
          >
            <button
              type="button"
              aria-pressed={sign === 'plus'}
              onClick={() => setSign('plus')}
            >
              加上
            </button>
            <button
              type="button"
              aria-pressed={sign === 'minus'}
              onClick={() => setSign('minus')}
            >
              减去
            </button>
          </div>
          <DurationFields
            label="时长 B"
            value={durations.second}
            onChange={(second) => setDurations({ ...durations, second })}
          />
          <p className="datecalc-note">
            可分项填写，或将 01:30:00 粘贴到任一时长输入框。
          </p>
        </>
      )}
      <div className="datecalc-inline-actions">
        <button
          className="secondary-button"
          type="button"
          onClick={() => {
            if (clock) {
              setTimes({ first: times.second, second: times.first });
              setNextDay(null);
            } else
              setDurations({
                first: durations.second,
                second: durations.first
              });
          }}
        >
          交换
        </button>
        <button
          className="secondary-button"
          type="button"
          onClick={() => {
            if (clock) {
              setTimes(sampleTimes);
              setNextDay(null);
            } else
              setDurations({
                first: { ...emptyParts, hours: '1', minutes: '30' },
                second: { ...emptyParts, minutes: '45' }
              });
          }}
        >
          载入示例
        </button>
      </div>
    </ModeGrid>
  );
}
