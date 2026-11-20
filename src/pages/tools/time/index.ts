import { tool as durationConverter } from './convert-duration/meta';
import { tool as timeConvertUnixToDate } from './convert-unix-to-date/meta';
import { tool as timeCrontabGuru } from './crontab-guru/meta';
import { tool as timeBetweenDates } from './time-between-dates/meta';
import { tool as truncateClockTime } from './truncate-clock-time/meta';
import { tool as checkLeapYear } from './check-leap-years/meta';
import { tool as discordTimestamp } from './discord-timestamp/meta';
import { tool as dateWeekdayCalculator } from './date-weekday-calculator/meta';

export const timeTools = [
  durationConverter,
  truncateClockTime,
  timeBetweenDates,
  timeCrontabGuru,
  checkLeapYear,
  timeConvertUnixToDate,
  discordTimestamp,
  dateWeekdayCalculator
];
