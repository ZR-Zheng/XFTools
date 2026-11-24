import { expect, test } from '@playwright/test';

test.use({ actionTimeout: 10000 });

test('The calculator supports keyboard entry, percent, memory and saved history', async ({
  page
}) => {
  await page.goto('/time/calculator');
  const calculator = page.getByRole('region', {
    name: '普通计算',
    exact: true
  });
  const expression = page.getByRole('textbox', { name: '算式' });
  const result = calculator.getByLabel('算式结果');
  await expression.fill('0.1 + 0.2');
  await expression.press('Enter');
  await expect(result).toHaveText('0.3');
  await calculator.getByTitle('加到记忆').click();
  await calculator.getByRole('button', { name: '清空算式' }).click();
  await calculator.getByTitle('读取记忆').click();
  await expect(result).toHaveText('0.3');
  await expression.fill('200-15%');
  await calculator.getByRole('button', { name: '等于' }).click();
  await expect(result).toHaveText('170');
  await page.screenshot({
    path: '.tmp/screenshots/date-calculator-desktop.png',
    animations: 'disabled'
  });
  await page.reload();
  const history = page.getByRole('region', { name: '计算历史' });
  await history.getByRole('button', { name: /200-15%/ }).click();
  await expect(expression).toHaveValue('170');
  await expression.fill('1/0');
  await expression.press('Enter');
  await expect(page.getByRole('alert')).toContainText('除数不能为零');
});

test('Calendar modes preserve inputs and calculate leap months, age and workdays on a phone', async ({
  page
}) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/time/calculator');
  await page.getByRole('button', { name: '日期', exact: true }).click();
  await page.getByRole('button', { name: '日期推算', exact: true }).click();
  await page.getByLabel('起始日期').fill('2024-01-31');
  await page.getByLabel('月数', { exact: true }).fill('1');
  await expect(
    page.getByLabel('计算结果值').filter({ visible: true })
  ).toHaveText('2024-02-29');
  await page.screenshot({
    path: '.tmp/screenshots/date-calculator-mobile.png',
    animations: 'disabled',
    fullPage: true
  });
  await page.getByRole('button', { name: '年龄', exact: true }).click();
  await page.getByLabel('出生日期').fill('2020-02-29');
  await page.getByLabel('计算日期').fill('2025-02-01');
  await expect(page.getByText(/2025-02-28 · 星期五/)).toBeVisible();
  await page.getByRole('button', { name: '工作日', exact: true }).click();
  await page
    .getByLabel('开始日期', { exact: true })
    .filter({ visible: true })
    .fill('2024-01-01');
  await page
    .getByLabel('结束日期', { exact: true })
    .filter({ visible: true })
    .fill('2024-01-07');
  await page.getByLabel('排除日期（可选）').fill('2024-01-01');
  await expect(page.getByRole('status', { name: '计算结果值' })).toHaveText('4');
  await page.getByRole('button', { name: '日期推算', exact: true }).click();
  await expect(page.getByLabel('起始日期')).toHaveValue('2024-01-31');
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth
    )
  ).toBe(true);
});

test('Old date links enter the matching mode and the workspace handles elapsed time across midnight', async ({
  page
}) => {
  await page.goto('/time/time-between-dates');
  await expect(page).toHaveURL(
    /\/time\/calculator\?view=difference&precision=time$/
  );
  await expect(page.getByLabel('计算精度')).toHaveValue('time');
  await page.getByLabel('开始日期').fill('2024-07-01');
  await page.getByLabel('结束日期').fill('2024-07-01');
  await page.getByLabel('开始时间').fill('12:00');
  await page.getByLabel('结束时间').fill('16:00');
  await page.getByLabel('开始时区').selectOption('America/New_York');
  await page.getByLabel('结束时区').selectOption('UTC');
  await expect(page.getByLabel('计算结果值')).toHaveText(
    '0 天 0 小时 0 分 0 秒'
  );
  await page.getByRole('button', { name: '时间', exact: true }).click();
  const modes = page.getByRole('navigation', { name: '时间计算模式' });
  await expect(modes.getByRole('button', { name: '时长计算' })).toHaveAttribute(
    'aria-pressed',
    'true'
  );
  await page
    .getByRole('combobox', { name: '计算方式', exact: true })
    .selectOption('clock');
  await expect(page.getByText('01:50:00', { exact: true })).toBeVisible();
  await modes.getByRole('button', { name: 'Cron 解析' }).click();
  await page.getByTestId('text-input').fill('*/5 * * * *');
  await expect(page.getByTestId('text-result')).toHaveValue(/5/);
});
