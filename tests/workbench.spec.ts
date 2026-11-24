import { expect, test } from '@playwright/test';
import { PDFDocument } from 'pdf-lib';
test('Chinese launcher has one catalog and filters by action', async ({
  page
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('lang', 'zh-CN');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('工具箱');
  await expect(page.locator('.tool-grid .tile-link')).toHaveCount(7);
  for (const removed of ['图片转 WebP', '批量缩放'])
    await expect(
      page.getByRole('link', { name: removed, exact: true })
    ).toHaveCount(0);
  await expect(page.locator('.launcher-heading')).toHaveCount(0);
  await expect(
    page.locator('.launcher-bar').getByRole('searchbox')
  ).toBeVisible();
  await expect(
    page.locator('.launcher-card :is(.tile-icon, .launcher-card-arrow)')
  ).toHaveCount(0);
  await expect(page.locator('iframe')).toHaveCount(0);
  await page
    .getByRole('searchbox', { name: '搜索工具', exact: true })
    .fill('合并PDF');
  await expect(page.locator('.tool-grid .tool-tile').first()).toContainText(
    'PDF 编辑器'
  );
  await expect
    .poll(() => new URL(page.url()).searchParams.get('q'))
    .toBe('合并PDF');
  await page.getByRole('button', { name: '清除搜索' }).click();
  await expect(page.locator('.tool-grid .tile-link')).toHaveCount(7);
  await page
    .getByRole('searchbox', { name: '搜索工具', exact: true })
    .fill('音乐工作台');
  await expect(page.locator('.tool-grid .tile-link')).toHaveText(/音频编辑器/);
  expect(errors).toEqual([]);
});

test('Task shortcuts open the exact mode and the workspace returns to the launcher', async ({
  page,
  context
}) => {
  await page.goto('/');
  const search = page.getByRole('searchbox', { name: '搜索工具', exact: true });
  await expect(search).toBeVisible();
  await page.keyboard.press('Control+k');
  await expect(search).toBeFocused();
  await search.fill('拆分PDF');
  await expect(
    page.getByRole('link', { name: '拆分 PDF', exact: true })
  ).toBeVisible();
  const [opened] = await Promise.all([
    context.waitForEvent('page'),
    search.press('Enter')
  ]);
  await expect(opened).toHaveURL(/\/pdf\/workspace\?mode=split$/);
  await expect(
    opened.getByRole('complementary', { name: '提取选中页', exact: true })
  ).toBeVisible();
  await opened.getByRole('link', { name: '返回工具箱', exact: true }).click();
  await expect(
    opened.getByRole('heading', { name: '工具箱', exact: true })
  ).toBeVisible();
  await expect(search).toHaveValue('拆分PDF');
  await search.press('Escape');
  await expect(search).toHaveValue('');
  await page.getByRole('link', { name: '时长换算', exact: true }).click();
  await expect(page).toHaveURL(/\/time\/calculator\?view=duration$/);
});
test('Compact light shell has no status or version footer', async ({
  page
}) => {
  await page.addInitScript(() => {
    localStorage.setItem('lang', 'en');
    localStorage.setItem('theme', 'dark');
  });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/categories/pdf');
  await expect(page.locator('html')).toHaveAttribute('lang', 'zh-CN');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await expect(page.locator('.topbar')).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: /Language|语言|切换.*主题/ })
  ).toHaveCount(0);
  await expect(page.getByRole('contentinfo')).toHaveCount(0);
  await expect(page.getByText('浏览器本地处理', { exact: true })).toHaveCount(
    0
  );
  await expect(page.getByText(/^v\d+\.\d+\.\d+$/)).toHaveCount(0);
  await expect(page.getByRole('main')).not.toContainText(/浏览器|本地处理|MIT/);
  await page.reload();
  await expect(
    page.getByRole('heading', { level: 1, name: 'PDF 工具', exact: true })
  ).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  expect(
    await page.evaluate(() => [
      localStorage.getItem('lang'),
      localStorage.getItem('theme')
    ])
  ).toEqual([null, null]);
  await page.screenshot({
    path: '.tmp/screenshots/shell-pdf-desktop.png',
    fullPage: false
  });
});

test('XFTools branding, removed notices and one page heading', async ({
  page
}) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/XFTools/);
  await expect(page.locator('.launcher-brand')).toHaveAttribute(
    'aria-label',
    'XFTools'
  );
  for (const notice of [
    '在你的设备上处理',
    '你的日常效率，从这里开始',
    'YOUR PERSONAL WORKSPACE',
    'YOUR EVERYDAY TOOLKIT',
    '图像、文档、文本与数据，一个工作台就够了。找到趁手的工具，把时间留给更重要的事。',
    '从这些实用工具开始',
    '无需注册，即开即用',
    '为每一种日常需求，找到合适的工具'
  ]) {
    await expect(page.getByText(notice, { exact: true })).toHaveCount(0);
  }
  for (const path of ['/categories/pdf', '/time/calculator']) {
    await page.goto(path);
    const main = page.getByRole('main');
    const heading = await main.getByRole('heading', { level: 1 }).innerText();
    await expect(
      main.getByRole('heading', { name: heading, exact: true })
    ).toHaveCount(1);
    await expect(
      main.getByText('YOUR PERSONAL WORKSPACE', { exact: true })
    ).toHaveCount(0);
  }
});

test('Chinese examples and descriptions are shown in the support section', async ({
  page
}) => {
  await page.goto('/time/check-leap-years');
  await page.locator('.tool-support-details > summary').click();
  await expect(
    page.getByRole('heading', {
      name: '查找 2 月 29 日的生日',
      exact: true
    })
  ).toBeVisible();
  await expect(page.getByText(/^我们的一位朋友出生在闰年/)).toBeVisible();
});

test('Toolbox has no favorites or recent-tool state', async ({ page }) => {
  await page.goto('/');
  await expect(
    page.getByRole('link', { name: /我的收藏|最近使用/ })
  ).toHaveCount(0);
  await expect(page.getByRole('button', { name: /收藏/ })).toHaveCount(0);
  await page.getByRole('link', { name: '计算器', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: '计算器', exact: true })
  ).toBeVisible();
  await expect(page.getByRole('button', { name: /收藏/ })).toHaveCount(0);
  const stored = await page.evaluate(() =>
    ['bookmarkedTools', 'recentTools'].map((key) => localStorage.getItem(key))
  );
  expect(stored).toEqual([null, null]);
  for (const removed of ['/favorites', '/recent']) {
    await page.goto(removed);
    await expect(
      page.getByRole('heading', { name: '这个页面走丢了' })
    ).toBeVisible();
  }
});
test('Image editor still loads after uploading an image', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/image-generic/editor');
  await expect(page).toHaveURL(/\/image\/workspace\?tab=edit$/);
  const png = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 16;
    const context = canvas.getContext('2d')!;
    context.fillStyle = '#285ee8';
    context.fillRect(0, 0, 32, 32);
    return canvas.toDataURL('image/png').split(',')[1];
  });
  await page.locator('input[type="file"]').setInputFiles({
    name: 'sample.png',
    mimeType: 'image/png',
    buffer: Buffer.from(png, 'base64')
  });
  await expect(page.locator('canvas').first()).toBeVisible({ timeout: 20000 });
  await expect(
    page.getByRole('button', { name: '调色', exact: true })
  ).toBeVisible();
  await page.screenshot({ path: '.tmp/screenshots/image-editor-zh.png' });
  await page.getByRole('button', { name: '旋转', exact: true }).click();
  await page.getByRole('button', { name: '右转 90°', exact: true }).click();
  await expect(page.locator('.iw-view-size')).toHaveText('16 × 32 px');
  await page.getByRole('button', { name: '水印', exact: true }).click();
  await page.getByLabel('水印文字', { exact: true }).fill('XFTools');
  await page.getByRole('button', { name: '导出', exact: true }).click();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: '下载图片', exact: true }).click();
  expect((await download).suggestedFilename()).toBe('sample-edited.png');
  expect(errors).toEqual([]);
});

test('Tool categories follow function and keep existing links', async ({
  page
}) => {
  await page.goto('/categories/pdf');
  await expect(page.locator('.tool-grid .tile-link')).toHaveCount(1);
  await expect(
    page.locator('.tool-grid a[href="/pdf/workspace"]')
  ).toBeVisible();
  await page.goto('/pdf/protect-pdf');
  await expect(
    page.getByRole('complementary', { name: '密码保护 PDF', exact: true })
  ).toBeVisible();
  await expect(page.getByLabel('打开密码')).toBeVisible();
  await page.goto('/categories/png');
  await expect(page).toHaveURL(/\/categories\/image-generic$/);
  await expect(
    page.locator('.tool-grid a[href="/image/workspace"]')
  ).toBeVisible();
  await expect(page.locator('.tool-grid a[href="/pdf/workspace"]')).toHaveCount(
    0
  );
  await page.goto('/categories/converters');
  await expect(
    page.locator('.tool-grid a[href="/converters/workspace"]')
  ).toBeVisible();
  await expect(
    page.locator(
      '.tool-grid a[href^="/image/"], .tool-grid a[href^="/pdf/"], .tool-grid a[href^="/video/"], .tool-grid a[href^="/audio/"]'
    )
  ).toHaveCount(0);
  await expect(
    page.locator('.tool-grid a[href="/number/byte-converter"]')
  ).toHaveCount(0);
});

test('Removed categories and tools are absent from the workspace and old links', async ({
  page
}) => {
  await page.goto('/');
  for (const category of [
    'encoding',
    'xml',
    'json',
    'calculator',
    'network',
    'list',
    'number',
    'csv',
    'security',
    'string',
    'png'
  ]) {
    await expect(page.locator(`a[href="/categories/${category}"]`)).toHaveCount(
      0
    );
  }
  const search = page.getByRole('searchbox', { name: '搜索工具', exact: true });
  for (const query of [
    'Base64',
    'CSV',
    'bcrypt',
    '密码生成器',
    'OCR',
    '字节单位换算',
    '将文本转为大写'
  ]) {
    await search.fill(query);
    await expect(page.locator('.tool-grid .tile-link')).toHaveCount(0);
    await expect(
      page.getByRole('heading', { name: '还没有找到工具' })
    ).toBeVisible();
  }
  for (const category of ['encoding', 'csv', 'security', 'string']) {
    await page.goto(`/categories/${category}`);
    await expect(
      page.getByRole('heading', { name: '没有找到这个分类' })
    ).toBeVisible();
  }
  for (const route of [
    '/string/base64',
    '/string/uppercase',
    '/string/split',
    '/image-generic/qr-code',
    '/image-generic/image-to-text',
    '/xml/xml-validator',
    '/json/prettify',
    '/number/generic-calc/ohms-law',
    '/string/url-editor',
    '/list/sort',
    '/number/sum',
    '/number/byte-converter',
    '/csv/csv-to-json',
    '/csv/change-csv-separator',
    '/string/table-text-converter',
    '/string/bcrypt',
    '/string/password-generator'
  ]) {
    await page.goto(route);
    await expect(
      page.getByRole('heading', { name: '这个页面走丢了' })
    ).toBeVisible();
  }
});

test('PDF processing waits for an explicit action and produces a download', async ({
  page
}) => {
  const pdf = await PDFDocument.create();
  pdf.addPage([100, 200]);
  const bytes = Buffer.from(await pdf.save());
  const secondPdf = await PDFDocument.create();
  secondPdf.addPage([200, 100]);
  await page.goto('/pdf/merge-pdf');
  const process = page.getByTestId('process-tool');
  await expect(process).toBeDisabled();
  await page.locator('input[type="file"]').setInputFiles([
    { name: 'one.pdf', mimeType: 'application/pdf', buffer: bytes },
    {
      name: 'two.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from(await secondPdf.save())
    }
  ]);
  await expect(process).toBeEnabled();
  await page.getByRole('button', { name: '上移 two.pdf', exact: true }).click();
  await expect(
    page.locator('.flow-result').getByRole('button', { name: /下载/ })
  ).toBeDisabled();
  await process.click();
  const download = page.waitForEvent('download');
  await page
    .locator('.flow-result')
    .getByRole('button', { name: /下载/ })
    .click();
  const saved = await download;
  const filePath = await saved.path();
  const { readFile } = await import('node:fs/promises');
  const merged = await PDFDocument.load(await readFile(filePath!));
  expect(merged.getPageCount()).toBe(2);
  expect(merged.getPage(0).getSize()).toEqual({ width: 200, height: 100 });
});

test('PDF form entry saves an editable field', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const pdf = await PDFDocument.create();
  pdf.addPage([300, 300]);
  await page.goto('/pdf/form-pdf');
  await page.locator('input[type="file"]').setInputFiles({
    name: 'sample.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from(await pdf.save())
  });
  await expect(page.locator('.pdf-reader-sheet canvas').first()).toBeVisible({
    timeout: 20000
  });
  await page.getByRole('button', { name: '文本框', exact: true }).click();
  await page
    .locator('.pdf-place-target')
    .first()
    .click({ position: { x: 25, y: 25 } });
  await page.getByLabel('默认值', { exact: true }).fill('XFTools');
  await page.getByRole('button', { name: '保存属性', exact: true }).click();
  await page.getByRole('button', { name: '保存 PDF', exact: true }).click();
  await page.getByTestId('process-tool').click();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: '下载 PDF', exact: true }).click();
  const resultPath = await (await download).path();
  const { readFile } = await import('node:fs/promises');
  const saved = await PDFDocument.load(await readFile(resultPath!));
  const form = saved.getForm();
  expect(form.getFields()).toHaveLength(1);
  expect(form.getTextField(form.getFields()[0].getName()).getText()).toBe(
    'XFTools'
  );
  await page.setViewportSize({ width: 375, height: 812 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth
    )
  ).toBe(true);
  expect(errors).toEqual([]);
});
test('Responsive layouts, direct mobile navigation and 404', async ({
  page
}) => {
  for (const width of [320, 375, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth
      )
    ).toBe(true);
  }
  await page.screenshot({
    path: '.tmp/screenshots/home-zh.png',
    fullPage: false
  });
  await page.setViewportSize({ width: 375, height: 812 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  const grid = page.locator('.launcher-grid');
  await expect(grid).toBeVisible();
  const search = page.locator('.launcher-bar').getByRole('search');
  await expect(search).toBeVisible();
  const mobileSearch = (await search.boundingBox())!;
  const brand = (await page
    .getByRole('link', { name: 'XFTools' })
    .boundingBox())!;
  const cards = (await grid.boundingBox())!;
  expect(mobileSearch.x).toBeGreaterThan(brand.x + brand.width);
  expect(mobileSearch.x + mobileSearch.width).toBeCloseTo(
    cards.x + cards.width
  );
  await page.screenshot({ path: '.tmp/screenshots/launcher-mobile.png' });
  await page.goto('/this-page-does-not-exist');
  await expect(
    page.getByRole('heading', { level: 1, name: '这个页面走丢了' })
  ).toBeVisible();
});

test('Chart artwork shares the same position within its card as other artwork', async ({
  page
}) => {
  for (const width of [1440, 375]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    const tiles = page.locator('.launcher-card');
    await expect(tiles).toHaveCount(7);
    const offsets = await tiles.evaluateAll((cards) =>
      cards.map((card) => {
        const { right, top } = card.getBoundingClientRect();
        const { x, y, width, height } = card
          .querySelector('.tile-art')!
          .getBoundingClientRect();
        return {
          category: card.getAttribute('data-category'),
          x: right - x - width / 2,
          y: y + height / 2 - top
        };
      })
    );
    const chart = offsets.find((offset) => offset.category === 'charts')!;
    for (const offset of offsets) {
      expect(offset.x).toBeCloseTo(chart.x, 0);
      expect(offset.y).toBeCloseTo(chart.y, 0);
    }
  }
});

test('The mobile header returns from tool categories to the catalog', async ({
  page
}) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/categories/pdf');
  await expect(
    page.getByRole('heading', { level: 1, name: 'PDF 工具' })
  ).toBeVisible();
  await page.getByRole('link', { name: 'XFTools' }).click();
  await expect(
    page.getByRole('heading', { level: 1, name: '工具箱' })
  ).toBeVisible();
  await expect(page.getByRole('contentinfo')).toHaveCount(0);
});
