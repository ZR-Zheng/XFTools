import { useState } from 'react';
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

export default function TimeArithmetic() {
  const [type, setType] = useState('duration');
  const [sign, setSign] = useState('plus');
  const [durations, setDurations] = useState({ first: '', second: '' });
  const [times, setTimes] = useState({ first: '23:20', second: '01:10' });
  const clock = type === 'clock';
  const { first, second } = clock ? times : durations;
  const update = clock ? setTimes : setDurations;
  const a = parseDuration(first);
  const b = parseDuration(second);
  const valid = a !== null && b !== null;
  const total = valid
    ? clock
      ? (b - a + msPerDay) % msPerDay
      : a + (sign === 'plus' ? b : -b)
    : null;
  const value = total === null ? '' : clockText(total);
  const notes = clock
    ? '结束时间早于开始时间时，按次日计算。'
    : '格式为 时:分:秒，小时可超过 24，秒可带三位小数。';
  return (
    <ModeGrid
      data={
        value && total !== null
          ? { value, copy: value, rows: [['总毫秒数', String(total)]], notes }
          : undefined
      }
      error={
        !clock && first && second && !valid
          ? '请输入有效时长，如 25:30:00 或 −02:15:00。'
          : undefined
      }
    >
      <h2>时长计算</h2>
      <Field label="计算方式">
        <select
          className="ui-input"
          value={type}
          onChange={(event) => setType(event.target.value)}
        >
          <option value="duration">时长加减</option>
          <option value="clock">两时刻间隔</option>
        </select>
      </Field>
      <Field label={clock ? '开始时间' : '时长 A'}>
        <input
          className="ui-input"
          type={clock ? 'time' : 'text'}
          step={clock ? 1 : undefined}
          placeholder="01:30:00"
          value={first}
          onChange={(event) => update({ first: event.target.value, second })}
        />
      </Field>
      {!clock && (
        <Field label="运算">
          <select
            className="ui-input"
            value={sign}
            onChange={(event) => setSign(event.target.value)}
          >
            <option value="plus">加上</option>
            <option value="minus">减去</option>
          </select>
        </Field>
      )}
      <Field label={clock ? '结束时间' : '时长 B'}>
        <input
          className="ui-input"
          type={clock ? 'time' : 'text'}
          step={clock ? 1 : undefined}
          placeholder="00:45:00"
          value={second}
          onChange={(event) => update({ first, second: event.target.value })}
        />
      </Field>
      <div className="datecalc-inline-actions">
        <button
          className="secondary-button"
          type="button"
          onClick={() => update({ first: second, second: first })}
        >
          交换
        </button>
        <button
          className="secondary-button"
          type="button"
          onClick={() =>
            update(
              clock
                ? { first: '23:20', second: '01:10' }
                : { first: '01:30:00', second: '00:45:00' }
            )
          }
        >
          载入示例
        </button>
      </div>
    </ModeGrid>
  );
}
