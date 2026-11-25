import { expect, test } from '@playwright/test';

test.use({
  actionTimeout: 10000,
  launchOptions: { ignoreDefaultArgs: ['--hide-scrollbars'] }
});

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

test('The full scientific keypad fits on a phone, and physical and on-screen keys work without a title', async ({
  page
}) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await page.goto('/time/calculator');
  await expect(
    page.getByRole('region', { name: '计算器', exact: true })
  ).toBeVisible();
  await expect(page.locator('.tool-page-header')).toHaveCount(0);
  const brand = await page.locator('.launcher-brand-mark').boundingBox();
  const workspace = await page
    .getByRole('region', { name: '计算器', exact: true })
    .boundingBox();
  expect(Math.abs(workspace!.x - brand!.x)).toBeLessThan(1);
  await page.keyboard.press('Shift+Numpad2');
  await page.keyboard.press('NumpadAdd');
  await page.keyboard.press('Shift+Numpad3');
  await page.keyboard.press('NumpadEnter');
  const result = page
    .getByLabel('算式结果', { exact: true })
    .filter({ visible: true });
  await expect(result).toHaveText('5');
  await page.keyboard.press('NumpadMultiply');
  await page.keyboard.press('Digit4');
  await page.keyboard.press('NumpadEnter');
  await expect(result).toHaveText('20');

  await page.getByRole('button', { name: '科学计算', exact: true }).click();
  const science = page.getByRole('region', { name: '科学计算', exact: true });
  await expect(
    science.getByRole('group', { name: '计算器键盘', exact: true })
  ).toBeInViewport({ ratio: 1 });
  await page.screenshot({
    path: '.tmp/screenshots/scientific-calculator-mobile.png'
  });
  const expression = science.getByRole('textbox', { name: '算式' });
  await expression.fill('30');
  await science.getByRole('button', { name: '正弦', exact: true }).click();
  await expect(expression).toHaveValue('sin(30)');
  await expect(result).toHaveText('0.5');
  await science.getByRole('button', { name: '弧度 RAD' }).click();
  await expression.fill('sin(pi/2)');
  await expression.press('NumpadEnter');
  await expect(result).toHaveText('1');
  await expression.fill('sqrt(-1)');
  await expression.press('NumpadEnter');
  const error = science.getByRole('alert');
  await expect(error).toContainText('无定义');
  await expect(error).toHaveCSS('color', 'rgb(122, 24, 18)');
  await expect(error).toHaveCSS('background-color', 'rgb(255, 241, 238)');
  await expect(error).toBeInViewport({ ratio: 1 });
  await expect(
    science.getByRole('group', { name: '计算器键盘', exact: true })
  ).toBeInViewport({ ratio: 1 });
  await page.screenshot({
    path: '.tmp/screenshots/scientific-calculator-error.png'
  });
  await expression.fill('sin(pi/2)');
  await expression.press('NumpadEnter');
  await expect(result).toHaveText('1');
  await page.setViewportSize({ width: 1280, height: 720 });
  await expect(
    science.getByRole('group', { name: '计算器键盘', exact: true })
  ).toBeInViewport({ ratio: 1 });
  await page.screenshot({
    path: '.tmp/screenshots/scientific-calculator-desktop.png'
  });
  await page.getByRole('button', { name: '数字大写', exact: true }).click();
  await page.getByLabel('输入数字').fill('12');
  await page.keyboard.press('Digit3');
  await expect(page.getByLabel('输入数字')).toHaveValue('123');
});

test('Switching to number spelling keeps the calculator aligned when a scrollbar appears', async ({
  page
}) => {
  await page.setViewportSize({ width: 1120, height: 420 });
  await page.goto('/time/calculator');
  await page.addStyleTag({
    content: 'html::-webkit-scrollbar { width: 16px; }'
  });
  const nav = page.getByRole('navigation', { name: '计算类别' });
  const geometry = () =>
    nav.evaluate((element) => {
      const { x, y, width } = element.getBoundingClientRect();
      const root = document.documentElement;
      return {
        x,
        y,
        width,
        height: root.scrollHeight,
        scrollable: root.scrollHeight > root.clientHeight
      };
    });
  const basic = nav.getByRole('button', { name: '普通计算', exact: true });
  const words = nav.getByRole('button', { name: '数字大写', exact: true });
  const expression = page.getByRole('textbox', { name: '算式' });
  await expect(expression).toBeVisible();
  const compact = (await geometry()).height;
  await words.click();
  await page
    .getByRole('textbox', { name: '输入数字' })
    .fill(`1.${'0'.repeat(250)}1`);
  const expanded = (await geometry()).height;
  expect(expanded).toBeGreaterThan(compact);
  await basic.click();
  await expect(expression).toBeVisible();
  await page.setViewportSize({
    width: 1120,
    height: Math.floor((compact + expanded) / 2)
  });
  const before = await geometry();
  expect(before.scrollable, JSON.stringify({ compact, expanded, before })).toBe(
    false
  );
  await words.click();
  await expect(page.getByRole('textbox', { name: '输入数字' })).toBeVisible();
  const after = await geometry();
  expect(after.scrollable).toBe(true);
  expect(after.x).toBeCloseTo(before.x);
  expect(after.y).toBeCloseTo(before.y);
  expect(after.width).toBeCloseTo(before.width);
});

test('Calendar modes preserve inputs and calculate leap months, age and workdays on a phone', async ({
  page
}) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/time/calculator');
  await page.getByRole('button', { name: '日期', exact: true }).click();
  await page.getByRole('button', { name: '日期推算', exact: true }).click();
  await page.getByLabel('起始日期', { exact: true }).fill('2024-01-31');
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
  await page.getByLabel('计算日期', { exact: true }).fill('2025-02-01');
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
  await expect(page.getByRole('status', { name: '计算结果值' })).toHaveText(
    '4'
  );
  await page.getByRole('button', { name: '日期推算', exact: true }).click();
  await expect(page.getByLabel('起始日期', { exact: true })).toHaveValue(
    '2024-01-31'
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth
    )
  ).toBe(true);
});

test('Spells and copies numbers in both languages, including a calculator result', async ({
  page,
  context
}) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto('/time/calculator');
  await page.getByRole('textbox', { name: '算式' }).fill('1000 + 2.05');
  await page.getByRole('button', { name: '转成大写', exact: true }).click();
  await expect(page).toHaveURL(/\/time\/calculator\?view=number-words$/);
  const input = page.getByRole('textbox', { name: '输入数字' });
  const chinese = page.getByLabel('中文大写结果', { exact: true });
  const english = page.getByLabel('英文大写结果', { exact: true });
  await expect(input).toHaveValue('1002.05');
  await expect(chinese).toHaveText('壹仟零贰点零伍');
  await expect(english).toHaveText('ONE THOUSAND TWO POINT ZERO FIVE');

  await page.setViewportSize({ width: 375, height: 812 });
  await input.fill('-1,234.50');
  const chineseCopy = page.getByRole('button', {
    name: '复制中文',
    exact: true
  });
  const englishCopy = page.getByRole('button', {
    name: '复制英文',
    exact: true
  });
  await chineseCopy.click();
  await expect
    .poll(() => page.evaluate(() => navigator.clipboard.readText()))
    .toBe('负壹仟贰佰叁拾肆点伍零');
  await englishCopy.click();
  await expect
    .poll(() => page.evaluate(() => navigator.clipboard.readText()))
    .toBe('MINUS ONE THOUSAND TWO HUNDRED THIRTY-FOUR POINT FIVE ZERO');

  await page.getByRole('button', { name: '日期', exact: true }).click();
  await page.getByRole('button', { name: '数字大写', exact: true }).click();
  await expect(input).toHaveValue('-1,234.50');
  await input.fill('12,34.50');
  await expect(page.getByRole('alert')).toContainText('请输入有效数字');
  await expect(chineseCopy).toBeDisabled();
  await expect(englishCopy).toBeDisabled();
  await page.getByRole('button', { name: '填入示例' }).click();
  await expect(chinese).toHaveText('壹仟贰佰叁拾肆点伍零');
  await input.fill('9007199254740993');
  await expect(english).toHaveText(/NINE QUADRILLION .* NINETY-THREE/);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth
    )
  ).toBe(true);
  await page.getByRole('button', { name: '清空输入' }).click();
  await expect(chinese).toHaveText('—');
  await expect(englishCopy).toBeDisabled();
});

test('Number spelling follows time and formats cheque amounts by currency on mobile', async ({
  page,
  context
}) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/time/calculator');
  const nav = page.getByRole('navigation', { name: '计算类别' });
  await expect(nav.getByRole('button')).toHaveText([
    '普通计算',
    '科学计算',
    '日期',
    '时间',
    '数字大写'
  ]);
  await nav.getByRole('button', { name: '数字大写' }).click();
  const amount = page.getByLabel('输入数字', { exact: true });
  const currency = page.getByLabel('支票币种');
  const chinese = page.getByLabel('中文支票写法结果', { exact: true });
  const english = page.getByLabel('英文支票写法结果', { exact: true });
  const copyEnglish = page.getByRole('button', {
    name: '复制英文支票',
    exact: true
  });
  await amount.fill('1,234.50');
  await expect(currency).toHaveValue('HKD');
  await expect(chinese).toHaveText('壹仟貳佰參拾肆元伍角正');
  await expect(english).toHaveText(
    'ONE THOUSAND TWO HUNDRED AND THIRTY-FOUR HONG KONG DOLLARS AND FIFTY CENTS ONLY'
  );
  await expect(page.getByLabel('中文大写结果', { exact: true })).toHaveText(
    '壹仟贰佰叁拾肆点伍零'
  );

  await currency.selectOption('CNY');
  await expect(chinese).toHaveText('人民币壹仟贰佰叁拾肆元伍角整');
  await expect(english).toHaveCount(0);
  await currency.selectOption('USD');
  await expect(chinese).toHaveCount(0);
  await expect(page.getByText('USD 1,234.50', { exact: true })).toBeVisible();
  await copyEnglish.click();
  await expect
    .poll(() => page.evaluate(() => navigator.clipboard.readText()))
    .toBe('ONE THOUSAND TWO HUNDRED THIRTY-FOUR AND 50/100');

  await amount.fill('1.005');
  await expect(page.getByText(/只能精确到分/)).toBeVisible();
  await expect(copyEnglish).toBeDisabled();
  await expect(page.getByLabel('英文大写结果', { exact: true })).toHaveText(
    'ONE POINT ZERO ZERO FIVE'
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth
    )
  ).toBe(true);

  await nav.getByRole('button', { name: '普通计算' }).click();
  await page.getByLabel('算式', { exact: true }).fill('-2.5');
  await page.getByRole('button', { name: '转成大写' }).click();
  await expect(page.getByLabel('中文大写结果', { exact: true })).toHaveText(
    '负贰点伍'
  );
});

test('Calendar shortcuts and date-time offsets can be calculated inline', async ({
  page
}) => {
  await page.goto('/time/calculator?view=difference');
  const start = page.getByLabel('开始日期', { exact: true });
  const end = page.getByLabel('结束日期', { exact: true });
  const value = page.getByRole('status', { name: '计算结果值' });
  const today = await start.inputValue();
  await start.fill('2024-02-28');
  await end.fill('2024-03-01');
  await expect(value).toHaveText('2');
  await page.getByRole('checkbox', { name: '计入首尾两天' }).check();
  await expect(value).toHaveText('3');
  await page.getByRole('button', { name: '交换起止' }).click();
  await expect(start).toHaveValue('2024-03-01');
  await page.getByRole('button', { name: '将开始日期设为今天' }).click();
  await expect(start).toHaveValue(today);
  await page.getByRole('checkbox', { name: '包含时间' }).check();
  await expect(page.getByLabel('开始时间', { exact: true })).toBeVisible();
  const startZone = page.getByRole('combobox', {
    name: '开始时区',
    exact: true
  });
  await expect(startZone).toHaveCount(0);
  await page.getByRole('checkbox', { name: '分别设置时区' }).check();
  await expect(startZone).toBeVisible();

  await page.getByRole('button', { name: '日期推算', exact: true }).click();
  await page.getByLabel('起始日期', { exact: true }).fill('2024-01-31');
  await page.getByLabel('月数', { exact: true }).fill('1');
  await page.getByRole('checkbox', { name: '包含时间' }).check();
  await page.getByLabel('起始时间', { exact: true }).fill('23:45');
  await page.getByLabel('分钟数', { exact: true }).fill('30');
  await expect(value).toHaveText('2024-03-01 00:15:00');
});

test('Time arithmetic accepts duration fields and pasted time, and counts explicit overnight intervals', async ({
  page
}) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/time/calculator?view=time-math');
  const value = page.getByRole('status', { name: '计算结果值' });
  await page.getByRole('textbox', { name: '时长 A天' }).fill('1');
  await page.getByRole('textbox', { name: '时长 A小时' }).fill('.5');
  await page.getByRole('textbox', { name: '时长 B秒' }).evaluate((field) => {
    const clipboardData = new DataTransfer();
    clipboardData.setData('text/plain', '00:15:00.25');
    field.dispatchEvent(
      new ClipboardEvent('paste', {
        clipboardData,
        bubbles: true,
        cancelable: true
      })
    );
  });
  await expect(value).toHaveText('24:45:00.25');
  await page.getByRole('button', { name: '减去', exact: true }).click();
  await expect(value).toHaveText('24:14:59.75');
  await page.getByRole('button', { name: '两时刻间隔', exact: true }).click();
  const overnight = page.getByRole('checkbox', { name: '次日结束' });
  await expect(overnight).toBeChecked();
  await expect(value).toHaveText('01:50:00');
  await page.getByLabel('开始时间', { exact: true }).fill('09:00');
  await page.getByLabel('结束时间', { exact: true }).fill('09:00');
  await overnight.check();
  await expect(value).toHaveText('24:00:00');
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
  await expect(
    page.getByRole('checkbox', { name: '包含时间', exact: true })
  ).toBeChecked();
  await expect(
    page.getByRole('checkbox', { name: '分别设置时区' })
  ).toBeChecked();
  await page.getByLabel('开始日期', { exact: true }).fill('2024-07-01');
  await page.getByLabel('结束日期', { exact: true }).fill('2024-07-01');
  await page.getByLabel('开始时间', { exact: true }).fill('12:00');
  await page.getByLabel('结束时间', { exact: true }).fill('16:00');
  await page
    .getByRole('combobox', { name: '开始时区', exact: true })
    .selectOption('America/New_York');
  await page
    .getByRole('combobox', { name: '结束时区', exact: true })
    .selectOption('UTC');
  await expect(page.getByLabel('计算结果值')).toHaveText(
    '0 天 0 小时 0 分 0 秒'
  );
  await page.getByRole('button', { name: '时间', exact: true }).click();
  const modes = page.getByRole('navigation', { name: '时间计算模式' });
  await expect(modes.getByRole('button', { name: '时长计算' })).toHaveAttribute(
    'aria-pressed',
    'true'
  );
  await page.getByRole('button', { name: '两时刻间隔', exact: true }).click();
  await expect(page.getByText('01:50:00', { exact: true })).toBeVisible();
  await modes.getByRole('button', { name: 'Cron 解析' }).click();
  await page.getByTestId('text-input').fill('*/5 * * * *');
  await expect(page.getByTestId('text-result')).toHaveValue(/5/);
});
