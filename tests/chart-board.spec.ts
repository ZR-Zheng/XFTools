import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';

test.use({ actionTimeout: 10000 });

test('The chart board opens from the toolbox, imports data and saves an SVG', async ({
  page,
  context
}) => {
  await page.goto('/');
  await page.getByRole('searchbox', { name: '搜索工具' }).fill('折线图');
  const launch = page.getByRole('link', {
    name: '统计图画板 · 在新标签页打开'
  });
  const [tab] = await Promise.all([
    context.waitForEvent('page'),
    launch.click()
  ]);
  await expect(tab).toHaveURL(/\/charts\/board$/);
  await expect(tab.getByRole('link', { name: '返回工具箱' })).toHaveCount(0);
  await expect(tab.getByRole('button', { name: '添加收藏' })).toHaveCount(0);
  const frame = tab.frameLocator('iframe[title="统计图画板"]');
  await expect(
    frame.getByRole('heading', { name: '统计图画板' })
  ).toBeVisible();

  const editData = frame.getByRole('button', { name: '编辑数据' });
  const panel = frame.getByRole('complementary', { name: '图表数据' });
  if ((await editData.getAttribute('aria-expanded')) !== 'true') {
    await editData.click();
  }
  await expect(panel).toBeVisible();
  await panel
    .getByRole('group', { name: '导入和导出数据' })
    .locator('input[type="file"]')
    .setInputFiles({
      name: 'example.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from('日期,数量\n周一,12\n周二,18\n周三,15\n')
    });
  await panel.getByRole('button', { name: '替换当前表格' }).click();
  await expect(panel.getByRole('textbox', { name: '周一，数量' })).toHaveValue(
    '12'
  );
  await panel.getByRole('button', { name: '关闭数据面板' }).click();
  await frame.getByRole('button', { name: '导出图片' }).click();
  const [download] = await Promise.all([
    tab.waitForEvent('download'),
    frame.getByRole('button', { name: 'SVG 矢量图' }).click()
  ]);
  expect(download.suggestedFilename()).toMatch(/\.svg$/);
  expect(await readFile(await download.path(), 'utf8')).toContain('周一');

  await frame.getByRole('button', { name: /^图表类型/ }).click();
  await frame.getByRole('menuitemradio', { name: '象形图' }).click();
  await frame.getByRole('button', { name: '象形图设置' }).click();
  await frame.getByLabel('图标用法').selectOption('shared');
  await frame.getByRole('button', { name: /^图标：/ }).click();
  const chunk = tab.waitForResponse(
    /\/line-chart-assistant\/assets\/pictograph-animals-.*\.js$/
  );
  await frame.getByRole('button', { name: '动物', exact: true }).click();
  expect((await chunk).ok()).toBe(true);
  await expect(
    frame
      .getByRole('region', { name: '动物', exact: true })
      .getByRole('button')
      .first()
  ).toBeVisible();

  await tab.setViewportSize({ width: 375, height: 812 });
  const bounds = await tab.locator('iframe[title="统计图画板"]').boundingBox();
  expect(bounds).toMatchObject({ x: 0, y: 0, width: 375, height: 812 });
  await expect(
    frame.getByRole('heading', { name: '统计图画板' })
  ).toBeVisible();
});

test('Refreshing the board reads a replacement build with relative assets', async ({
  page
}) => {
  await page.goto('/charts/board');
  const frame = page.frameLocator('iframe[title="统计图画板"]');
  await expect(
    frame.getByRole('heading', { name: '统计图画板' })
  ).toBeVisible();

  await page.route('**/line-chart-assistant/index.html', async (route) => {
    const original = await readFile(
      'public/line-chart-assistant/index.html',
      'utf8'
    );
    const body = original
      .replaceAll('"/assets/', '"./assets/')
      .replace(
        '</head>',
        '<meta name="chart-build" content="replacement"></head>'
      );
    await route.fulfill({ contentType: 'text/html; charset=utf-8', body });
  });
  await page.reload();
  await expect(frame.locator('meta[name="chart-build"]')).toHaveAttribute(
    'content',
    'replacement'
  );
  await expect(
    frame.getByRole('heading', { name: '统计图画板' })
  ).toBeVisible();
});
