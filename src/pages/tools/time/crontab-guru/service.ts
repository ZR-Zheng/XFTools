import cronstrue from 'cronstrue';
import 'cronstrue/locales/zh_CN';
import { isValidCron } from 'cron-validator';

const getLanguage = (): string => localStorage.getItem('lang') === 'zh' ? 'zh_CN' : 'en';

export function explainCrontab(expr: string): string {
  return cronstrue.toString(expr, { locale: getLanguage() });
}

export function validateCrontab(expr: string): boolean {
  return isValidCron(expr, { seconds: false, allowBlankDay: true });
}

export function main(input: string): string {
  if (!input?.trim()) return '';

  return input
    .split('\n')
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed) return '';
      if (!validateCrontab(trimmed))
        return `Invalid crontab expression: "${trimmed}"`;
      return explainCrontab(trimmed);
    })
    .join('\n');
}
