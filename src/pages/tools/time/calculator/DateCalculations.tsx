import { useState } from 'react';
import {
  calendarSpan,
  countWorkdays,
  currentEndpoint,
  dayFacts,
  dayMs,
  nextBirthday,
  printDate,
  readDate,
  readZoned,
  shiftMonths,
  today
} from './calendar';
import { Field, ModeGrid, type ResultData } from './widgets';

type DateSpan = ReturnType<typeof calendarSpan>;
const spanText = ({ years, months, days }: DateSpan) =>
  `${years} 年 ${months} 个月 ${days} 天`;
const shortZones = [
  ['Asia/Shanghai', '北京时间'],
  ['Asia/Tokyo', '东京'],
  ['Europe/London', '伦敦'],
  ['America/New_York', '纽约'],
  ['America/Los_Angeles', '洛杉矶']
] as const;
const otherZones = () =>
  typeof Intl.supportedValuesOf === 'function'
    ? Intl.supportedValuesOf('timeZone').filter(
        (zone) => !shortZones.some(([id]) => id === zone)
      )
    : [];

function DateInput({
  label,
  value,
  onChange,
  onToday
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  onToday?: () => void;
}) {
  return (
    <div className="datecalc-shortcut-field">
      <Field label={label}>
        <input
          type="date"
          className="ui-input"
          min="0001-01-01"
          max="9999-12-31"
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
      </Field>
      {onToday && (
        <button
          type="button"
          className="datecalc-shortcut"
          aria-label={`将${label}设为今天`}
          onClick={onToday}
        >
          今天
        </button>
      )}
    </div>
  );
}

type Endpoint = { date: string; time: string; zone: string };

function EndpointFields({
  label,
  endpoint,
  exact,
  zoned,
  onChange
}: {
  label: string;
  endpoint: Endpoint;
  exact: boolean;
  zoned: boolean;
  onChange: (value: Endpoint) => void;
}) {
  const zone = exact && zoned ? endpoint.zone : 'local';
  return (
    <fieldset className="datecalc-endpoint">
      <legend>{label}</legend>
      <DateInput
        label={label + '日期'}
        value={endpoint.date}
        onChange={(date) => onChange({ ...endpoint, date })}
        onToday={() =>
          onChange({ ...endpoint, date: currentEndpoint(zone).date })
        }
      />
      {exact && (
        <div className="datecalc-shortcut-field">
          <Field label={label + '时间'}>
            <input
              className="ui-input"
              type="time"
              step={1}
              value={endpoint.time}
              onChange={(event) =>
                onChange({ ...endpoint, time: event.target.value })
              }
            />
          </Field>
          <button
            type="button"
            className="datecalc-shortcut"
            aria-label={`将${label}设为现在`}
            onClick={() => onChange({ ...endpoint, ...currentEndpoint(zone) })}
          >
            现在
          </button>
        </div>
      )}
      {exact && zoned && (
        <Field label={label + '时区'}>
          <select
            className="ui-input"
            value={endpoint.zone}
            onChange={(event) =>
              onChange({ ...endpoint, zone: event.target.value })
            }
          >
            <option value="local">本地时区</option>
            <option value="UTC">UTC</option>
            <optgroup label="常用时区">
              {shortZones.map(([zone, name]) => (
                <option key={zone} value={zone}>
                  {name}
                </option>
              ))}
            </optgroup>
            <AdditionalZones />
          </select>
        </Field>
      )}
    </fieldset>
  );
}

function AdditionalZones() {
  const [zones] = useState(otherZones);
  return (
    zones.length > 0 && (
      <optgroup label="其他时区">
        {zones.map((zone) => (
          <option key={zone}>{zone}</option>
        ))}
      </optgroup>
    )
  );
}

export function DateDifference({
  initiallyExact = false
}: {
  initiallyExact?: boolean;
}) {
  const [exact, setExact] = useState(initiallyExact);
  const [zoned, setZoned] = useState(initiallyExact);
  const [inclusive, setInclusive] = useState(false);
  const [start, setStart] = useState<Endpoint>(() => ({
    date: today(),
    time: '00:00',
    zone: 'local'
  }));
  const [end, setEnd] = useState<Endpoint>(() => ({
    date: today(),
    time: '12:00',
    zone: 'local'
  }));
  const a = exact
    ? readZoned(start.date, start.time, zoned ? start.zone : 'local')
    : readDate(start.date);
  const b = exact
    ? readZoned(end.date, end.time, zoned ? end.zone : 'local')
    : readDate(end.date);
  let data: ResultData | undefined;
  if (a !== null && b !== null) {
    const elapsed = Math.abs(b - a);
    if (exact) {
      const total = Math.round(elapsed / 1000);
      const days = Math.floor(total / 86400);
      const hours = Math.floor(total / 3600) % 24;
      const minutes = Math.floor(total / 60) % 60;
      data = {
        value: `${days} 天 ${hours} 小时 ${minutes} 分 ${total % 60} 秒`,
        rows: [
          ['总秒数', String(total)],
          ['总分钟数', String(Number((total / 60).toFixed(4)))],
          ['总小时数', String(Number((total / 3600).toFixed(6)))]
        ]
      };
    } else {
      const days = elapsed / dayMs;
      const count = days + Number(inclusive);
      data = {
        value: String(count),
        unit: '天',
        rows: [
          [
            '按日历拆分',
            spanText(
              calendarSpan(
                Math.min(a, b),
                Math.max(a, b) + Number(inclusive) * dayMs
              )
            )
          ],
          ['按整周拆分', `${Math.floor(count / 7)} 周 ${count % 7} 天`]
        ]
      };
    }
  }
  return (
    <ModeGrid
      data={data}
      error={
        !data && start.date && end.date
          ? exact
            ? '请输入有效的日期和时间。夏令时跳过的本地时刻无法换算。'
            : '请输入有效的日期。'
          : undefined
      }
    >
      <h2>日期差</h2>
      <div className="datecalc-inline-actions">
        <label className="datecalc-check">
          <input
            type="checkbox"
            checked={exact}
            onChange={(event) => setExact(event.target.checked)}
          />
          包含时间
        </label>
        {exact && (
          <label className="datecalc-check">
            <input
              type="checkbox"
              checked={zoned}
              onChange={(event) => setZoned(event.target.checked)}
            />
            分别设置时区
          </label>
        )}
      </div>
      <div className="datecalc-endpoint-grid">
        <EndpointFields
          label="开始"
          endpoint={start}
          exact={exact}
          zoned={zoned}
          onChange={setStart}
        />
        <EndpointFields
          label="结束"
          endpoint={end}
          exact={exact}
          zoned={zoned}
          onChange={setEnd}
        />
      </div>
      <div className="datecalc-inline-actions">
        <button
          type="button"
          className="secondary-button"
          onClick={() => {
            setStart(end);
            setEnd(start);
          }}
        >
          交换起止
        </button>
        {!exact && (
          <label className="datecalc-check">
            <input
              type="checkbox"
              checked={inclusive}
              onChange={(event) => setInclusive(event.target.checked)}
            />{' '}
            计入首尾两天
          </label>
        )}
      </div>
    </ModeGrid>
  );
}

const dateShiftFields = [
  ['years', '年数'],
  ['months', '月数'],
  ['weeks', '周数'],
  ['days', '天数']
] as const;
const timeShiftFields = [
  ['hours', '小时数'],
  ['minutes', '分钟数'],
  ['seconds', '秒数']
] as const;

export function DateShift() {
  const [base, setBase] = useState(today);
  const [exact, setExact] = useState(false);
  const [clock, setClock] = useState('00:00');
  const [direction, setDirection] = useState('forward');
  const [parts, setParts] = useState({
    years: '',
    months: '',
    weeks: '',
    days: '',
    hours: '',
    minutes: '',
    seconds: ''
  });
  const fields = exact
    ? [...dateShiftFields, ...timeShiftFields]
    : dateShiftFields;
  const valid = fields.every(([key]) => /^\d{1,7}$/.test(parts[key] || '0'));
  const start = readDate(base);
  const moment = exact ? readZoned(base, clock, 'UTC') : start;
  const sign = direction === 'forward' ? 1 : -1;
  const target =
    start !== null && moment !== null && valid
      ? shiftMonths(
          start,
          sign * (Number(parts.years) * 12 + Number(parts.months))
        ) +
        sign * (Number(parts.weeks) * 7 + Number(parts.days)) * dayMs +
        (moment - start) +
        (exact
          ? sign *
            (Number(parts.hours) * 3600 +
              Number(parts.minutes) * 60 +
              Number(parts.seconds)) *
            1000
          : 0)
      : NaN;
  const date = printDate(target);
  const value =
    date && exact
      ? `${date} ${new Date(target).toISOString().slice(11, 19)}`
      : date;
  const details = date
    ? dayFacts(Math.floor(target / dayMs) * dayMs)
    : undefined;
  return (
    <ModeGrid
      data={
        value && details
          ? {
              value,
              copy: value,
              rows: [
                ['星期', details.weekday],
                ['ISO 周', `${details.weekYear} 年第 ${details.week} 周`]
              ],
              notes: '推算后如无对应日期，取该月最后一天。'
            }
          : undefined
      }
      error={
        !valid
          ? '推算的各项数值须为非负整数。'
          : exact && base && moment === null
            ? '请输入有效的起始日期与时间。'
            : base && !value
              ? '结果超出支持的日期范围。'
              : undefined
      }
    >
      <h2>日期推算</h2>
      <DateInput
        label="起始日期"
        value={base}
        onChange={setBase}
        onToday={() => setBase(today())}
      />
      <label className="datecalc-check">
        <input
          type="checkbox"
          checked={exact}
          onChange={(event) => setExact(event.target.checked)}
        />
        包含时间
      </label>
      {exact && (
        <div className="datecalc-shortcut-field">
          <Field label="起始时间">
            <input
              type="time"
              className="ui-input"
              step={1}
              value={clock}
              onChange={(event) => setClock(event.target.value)}
            />
          </Field>
          <button
            type="button"
            className="datecalc-shortcut"
            onClick={() => {
              const now = currentEndpoint();
              setBase(now.date);
              setClock(now.time);
            }}
          >
            现在
          </button>
        </div>
      )}
      <Field label="推算方向">
        <select
          className="ui-input"
          value={direction}
          onChange={(event) => setDirection(event.target.value)}
        >
          <option value="forward">加上（未来）</option>
          <option value="backward">减去（过去）</option>
        </select>
      </Field>
      <div className="datecalc-period-grid">
        {fields.map(([key, label]) => (
          <Field label={label} key={key}>
            <input
              className="ui-input"
              type="number"
              min="0"
              step="1"
              inputMode="numeric"
              placeholder="0"
              value={parts[key]}
              onChange={(event) =>
                setParts({ ...parts, [key]: event.target.value })
              }
            />
          </Field>
        ))}
      </div>
    </ModeGrid>
  );
}

export function AgeCalculator() {
  const [birth, setBirth] = useState('');
  const [reference, setReference] = useState(today);
  const a = readDate(birth);
  const b = readDate(reference);
  let data: ResultData | undefined;
  if (a !== null && b !== null && a <= b) {
    const span = calendarSpan(a, b);
    const birthday = nextBirthday(a, b);
    const birthdayText = printDate(birthday);
    data = {
      value: String(span.years),
      unit: '周岁',
      rows: [
        ['详细年龄', `${span.years} 岁 ${span.months} 个月 ${span.days} 天`],
        ['已度过', `${(b - a) / dayMs} 天`],
        [
          '下次生日',
          birthdayText
            ? `${birthdayText} · ${dayFacts(birthday).weekday}`
            : '超出日期范围'
        ],
        ...(birthdayText
          ? [['距下次生日', `${(birthday - b) / dayMs} 天`] as const]
          : [])
      ],
      notes: birth.endsWith('-02-29')
        ? '平年的生日按 2 月 28 日计算。'
        : undefined
    };
  }
  return (
    <ModeGrid
      data={data}
      error={
        a !== null && b !== null && a > b
          ? '出生日期不能晚于计算日期。'
          : undefined
      }
    >
      <h2>年龄计算</h2>
      <DateInput label="出生日期" value={birth} onChange={setBirth} />
      <DateInput
        label="计算日期"
        value={reference}
        onChange={setReference}
        onToday={() => setReference(today())}
      />
    </ModeGrid>
  );
}

export function WorkdayCalculator() {
  const [start, setStart] = useState(today);
  const [end, setEnd] = useState(today);
  const [weekend, setWeekend] = useState('both');
  const [holidays, setHolidays] = useState('');
  const a = readDate(start);
  const b = readDate(end);
  const entries = holidays
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map(readDate);
  const invalid = entries.some((date) => date === null);
  const result =
    a !== null && b !== null && !invalid
      ? countWorkdays(
          a,
          b,
          weekend === 'sunday',
          new Set(entries.filter((date) => date !== null))
        )
      : undefined;
  return (
    <ModeGrid
      data={
        result
          ? {
              value: String(result.days),
              unit: '工作日',
              rows: [
                ['休息日', `${result.rest} 天`],
                ['范围共计', `${result.length} 天`]
              ],
              notes: '统计包含首尾两天，按所选休息安排和手动排除的日期计算。'
            }
          : undefined
      }
      error={
        invalid ? '请按 YYYY-MM-DD 格式填写排除日期，每行一个。' : undefined
      }
    >
      <h2>工作日计算</h2>
      <div className="datecalc-endpoint-grid">
        <DateInput
          label="开始日期"
          value={start}
          onChange={setStart}
          onToday={() => setStart(today())}
        />
        <DateInput
          label="结束日期"
          value={end}
          onChange={setEnd}
          onToday={() => setEnd(today())}
        />
      </div>
      <Field label="休息安排">
        <select
          className="ui-input"
          value={weekend}
          onChange={(event) => setWeekend(event.target.value)}
        >
          <option value="both">周六、周日休息</option>
          <option value="sunday">仅周日休息</option>
        </select>
      </Field>
      <Field label="排除日期（可选）">
        <textarea
          className="ui-input"
          rows={3}
          placeholder="YYYY-MM-DD，每行一个"
          value={holidays}
          onChange={(event) => setHolidays(event.target.value)}
        />
      </Field>
    </ModeGrid>
  );
}
