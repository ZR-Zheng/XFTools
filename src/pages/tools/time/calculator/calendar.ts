import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

dayjs.extend(utc);
dayjs.extend(timezone);

export const dayMs = 86_400_000;
const weekdays = [
  '星期日',
  '星期一',
  '星期二',
  '星期三',
  '星期四',
  '星期五',
  '星期六'
];
const pad = (value: number) => String(value).padStart(2, '0');
const dateLabel = (year: number, month: number, day: number) =>
  `${String(year).padStart(4, '0')}-${pad(month)}-${pad(day)}`;

export function today() {
  const date = new Date();
  return dateLabel(date.getFullYear(), date.getMonth() + 1, date.getDate());
}

export function readDate(value: string): number | null {
  if (!/^\d{4}-\d\d-\d\d$/.test(value) || value.startsWith('0000')) return null;
  const date = new Date(value + 'T00:00:00Z');
  return Number.isFinite(+date) && date.toISOString().slice(0, 10) === value
    ? +date
    : null;
}

export function printDate(value: number) {
  const date = new Date(value);
  return Number.isFinite(+date) &&
    date.getUTCFullYear() >= 1 &&
    date.getUTCFullYear() <= 9999
    ? date.toISOString().slice(0, 10)
    : '';
}

function utcDate(year: number, month: number, day: number) {
  const date = new Date(0);
  date.setUTCFullYear(year, month, day);
  return +date;
}

export function shiftMonths(value: number, amount: number) {
  const date = new Date(value);
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth() + amount;
  const last = new Date(utcDate(year, month + 1, 0)).getUTCDate();
  return utcDate(year, month, Math.min(last, date.getUTCDate()));
}

export function calendarSpan(start: number, end: number) {
  const from = new Date(start);
  const to = new Date(end);
  let months =
    (to.getUTCFullYear() - from.getUTCFullYear()) * 12 +
    to.getUTCMonth() -
    from.getUTCMonth();
  if (shiftMonths(start, months) > end) months--;
  const days = (end - shiftMonths(start, months)) / dayMs;
  return { years: Math.floor(months / 12), months: months % 12, days };
}

export function dayFacts(value: number) {
  const weekday = new Date(value).getUTCDay();
  const thursday = value + (3 - ((weekday + 6) % 7)) * dayMs;
  const weekYear = new Date(thursday).getUTCFullYear();
  const week =
    1 + Math.floor((thursday - utcDate(weekYear, 0, 1)) / (7 * dayMs));
  return { weekday: weekdays[weekday], weekYear, week };
}

export function nextBirthday(birth: number, reference: number) {
  const offset =
    12 *
    (new Date(reference).getUTCFullYear() - new Date(birth).getUTCFullYear());
  const birthday = shiftMonths(birth, offset);
  return birthday >= reference ? birthday : shiftMonths(birth, offset + 12);
}

export function countWorkdays(
  start: number,
  end: number,
  workSaturday: boolean,
  exclusions: ReadonlySet<number>
) {
  const first = Math.min(start, end);
  const last = Math.max(start, end);
  const length = 1 + (last - first) / dayMs;
  const weekday = new Date(first).getUTCDay();
  const isWorkday = (day: number) => day > 0 && (day < 6 || workSaturday);
  let days = Math.floor(length / 7) * (workSaturday ? 6 : 5);
  for (let index = 0; index < length % 7; index++)
    if (isWorkday((weekday + index) % 7)) days++;
  for (const excluded of exclusions)
    if (
      excluded >= first &&
      excluded <= last &&
      isWorkday(new Date(excluded).getUTCDay())
    )
      days--;
  return { days, rest: length - days, length };
}

export function readZoned(
  date: string,
  time: string,
  zone: string
): number | null {
  if (readDate(date) === null || !/^\d{2}:\d{2}(?::\d{2})?$/.test(time))
    return null;
  const wall = `${date} ${time.length === 5 ? time + ':00' : time}`;
  try {
    const value =
      zone === 'local' ? dayjs(wall.replace(' ', 'T')) : dayjs.tz(wall, zone);
    return value.isValid() && value.format('YYYY-MM-DD HH:mm:ss') === wall
      ? value.valueOf()
      : null;
  } catch {
    return null;
  }
}
