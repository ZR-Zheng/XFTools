import { expect, test } from '@playwright/test';
import { PDFDocument } from 'pdf-lib';
test('Chinese default, search, categories and no upstream embeds', async ({
  page
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('lang', 'zh-CN');
  await expect(page.getByRole('heading', { level: 1 })).toContainText(
    'XFTools'
  );
  await expect(page.locator('iframe')).toHaveCount(0);
  await page
    .getByRole('searchbox', { name: '搜索工具', exact: true })
    .fill('合并 PDF');
  await expect(page.locator('.tool-grid .tool-tile').first()).toContainText(
    'PDF 工作台'
  );
  await expect
    .poll(() => new URL(page.url()).searchParams.get('q'))
    .toBe('合并 PDF');
  await page.getByRole('button', { name: '清除搜索' }).click();
  await page.locator('.sidebar a[href="/categories/pdf"]').click();
  await expect(page.locator('.tool-grid .tool-tile').first()).toBeVisible();
  expect(errors).toEqual([]);
});
test('Chinese-only light shell removes old preferences and aligns footer status with version', async ({
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
  const bottom = page.locator('.sidebar .sidebar-bottom');
  await expect(bottom.locator('.sidebar-processing')).toHaveText(
    '浏览器本地处理'
  );
  await expect(page.getByText('浏览器本地处理', { exact: true })).toHaveCount(
    1
  );
  await expect(page.getByRole('main')).not.toContainText(/浏览器|本地处理|MIT/);
  await expect(page.locator('.app-footer')).not.toContainText(
    /MIT|浏览器|本地处理/
  );
  const status = await bottom.locator('.sidebar-processing').boundingBox();
  const version = await bottom.locator('.version').boundingBox();
  expect(
    Math.abs(status.y + status.height / 2 - (version.y + version.height / 2))
  ).toBeLessThan(1);
  expect(version.x).toBeGreaterThan(status.x + status.width);
  expect(version.y + version.height).toBeLessThanOrEqual(900);
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
  await expect(page.locator('.brand').first()).toHaveAttribute(
    'aria-label',
    'XFTools'
  );
  await expect(page.locator('.brand-light').first()).toHaveText('Tools');
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
  for (const path of ['/favorites', '/recent', '/categories/pdf']) {
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
  await page.goto('/favorites');
  await expect(
    page.getByRole('main').getByRole('heading', { level: 1, name: '我的收藏' })
  ).toBeVisible();
  await page.screenshot({ path: '.tmp/screenshots/favorites-zh.png' });
});

test('Chinese tool descriptions, examples and source labels remain consistent', async ({
  page
}) => {
  await page.goto('/string/uppercase');
  await page.locator('.tool-support-details > summary').click();
  await expect(
    page.getByRole('heading', {
      name: '将文本转为大写',
      exact: true
    })
  ).toBeVisible();
  await expect(
    page.getByText('将文本中的字母统一转换为大写。', { exact: true })
  ).toBeVisible();
});

test('Favorites update across navigation and can be removed', async ({
  page
}) => {
  await page.goto('/');
  const tile = page.locator('.tool-grid .tool-tile').first();
  const title = await tile.locator('h3').innerText();
  await tile.getByRole('button', { name: /添加收藏/ }).click();
  await page.locator('.sidebar a[href="/favorites"]').click();
  await expect(page.locator('.tool-grid')).toContainText(title);
  await page
    .locator('.tool-grid')
    .getByRole('button', { name: /取消收藏/ })
    .click();
  await expect(
    page.getByRole('heading', { name: '把顺手的工具，收进这里' })
  ).toBeVisible();
});
test('Text tool still computes and appears in recent tools', async ({
  page
}) => {
  await page.goto('/string/uppercase');
  await expect(page.getByTestId('text-input')).toBeVisible();
  await page.getByTestId('text-input').fill('hello');
  await expect(page.getByTestId('text-result')).toHaveValue('HELLO');
  await page.screenshot({ path: '.tmp/screenshots/tool-zh.png' });
  await page.locator('.sidebar a[href="/recent"]').click();
  await expect(
    page.locator('.tool-grid a[href="/string/uppercase"]')
  ).toBeVisible();
});
test('Image editor still loads after uploading an image', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/image-generic/editor');
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
    page.getByText('色彩调整', { exact: true }).first()
  ).toBeVisible();
  await expect(page.getByText('Finetune', { exact: true })).toHaveCount(0);
  await page.screenshot({ path: '.tmp/screenshots/image-editor-zh.png' });
  await page.getByRole('button', { name: '旋转 90°', exact: true }).click();
  await expect
    .poll(() =>
      page
        .locator('.image-canvas-stage canvas')
        .evaluate((canvas: HTMLCanvasElement) => [canvas.width, canvas.height])
    )
    .toEqual([16, 32]);
  await page.getByLabel('文字内容', { exact: true }).fill('XFTools');
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: '下载图片', exact: true }).click();
  expect((await download).suggestedFilename()).toBe('sample-edited.png');
  expect(errors).toEqual([]);
});

test('Tool categories follow function and keep existing links', async ({
  page
}) => {
  await page.goto('/categories/pdf');
  await expect(page.locator('.tool-grid a')).toHaveCount(1);
  await expect(
    page.locator('.tool-grid a[href="/pdf/workspace"]')
  ).toBeVisible();
  await page.goto('/pdf/protect-pdf');
  await expect(page.getByLabel('输出格式与操作')).toHaveValue('protect');
  await page.goto('/categories/converters');
  await expect(
    page.locator('.tool-grid a[href="/number/byte-converter"]')
  ).toBeVisible();
});

test('Removed categories and tools are absent from the workspace and old links', async ({
  page
}) => {
  await page.addInitScript(() => {
    const history = ['csv/csv-to-json', 'string/bcrypt', 'pdf/merge-pdf'];
    localStorage.setItem('bookmarkedTools', history.join(','));
    localStorage.setItem('recentTools', JSON.stringify(history));
  });
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
    'security'
  ]) {
    await expect(page.locator(`a[href="/categories/${category}"]`)).toHaveCount(
      0
    );
  }
  const search = page.getByRole('searchbox', { name: '搜索工具', exact: true });
  for (const query of ['Base64', 'CSV', 'bcrypt', '密码生成器']) {
    await search.fill(query);
    await expect(page.locator('.tool-grid .tile-link')).toHaveCount(0);
    await expect(
      page.getByRole('heading', { name: '还没有找到工具' })
    ).toBeVisible();
  }
  for (const route of ['/favorites', '/recent']) {
    await page.goto(route);
    await expect(page.locator('.tool-grid .tile-link')).toHaveCount(1);
    await expect(page.locator('.tool-grid .tile-link')).toHaveAttribute(
      'href',
      '/pdf/workspace'
    );
  }
  for (const category of ['encoding', 'csv', 'security']) {
    await page.goto(`/categories/${category}`);
    await expect(
      page.getByRole('heading', { name: '没有找到这个分类' })
    ).toBeVisible();
  }
  for (const route of [
    '/string/base64',
    '/image-generic/qr-code',
    '/xml/xml-validator',
    '/json/prettify',
    '/number/generic-calc/ohms-law',
    '/string/url-editor',
    '/list/sort',
    '/number/sum',
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

test('Native radio controls change the text splitting operation', async ({
  page
}) => {
  await page.goto('/string/split');
  await page.getByTestId('text-input').fill('hello world');
  const chunks = page.getByRole('radio', { name: '使用多个块', exact: true });
  await chunks.check();
  await expect(chunks).toBeChecked();
  await expect(page.getByTestId('text-result')).toHaveValue(
    'hel\\nlo \\nwor\\nld'
  );
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

test('Media tools wait for all source files before processing', async ({
  page
}) => {
  const requests: string[] = [];
  page.on('request', (request) => requests.push(request.url()));
  await page.goto('/video/add-audio');
  const process = page.getByTestId('process-tool');
  await expect(process).toBeDisabled();
  await page.locator('.flow-input input[type="file"]').setInputFiles({
    name: 'video.webm',
    mimeType: 'video/webm',
    buffer: Buffer.from([0x1a, 0x45, 0xdf, 0xa3])
  });
  await expect(process).toBeDisabled();
  await page.locator('.flow-settings input[type="file"]').setInputFiles({
    name: 'audio.wav',
    mimeType: 'audio/wav',
    buffer: Buffer.alloc(44)
  });
  await expect(process).toBeEnabled();
  // Observe beyond the former one-second automatic conversion timer.
  await page.waitForTimeout(1200);
  expect(requests.some((url) => /ffmpeg-core|\.wasm/.test(url))).toBe(false);
  await expect(process).toBeEnabled();
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
  await page.getByRole('button', { name: '导出设置' }).click();
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
test('Responsive layouts, reduced motion, drawer and 404', async ({ page }) => {
  for (const width of [375, 768, 1024, 1440]) {
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
  await page.getByRole('button', { name: '打开导航' }).click();
  await page.locator('.ui-drawer a[href="/favorites"]').click();
  await expect(
    page.getByRole('heading', { level: 1, name: '我的收藏' })
  ).toBeVisible();
  await page.screenshot({ path: '.tmp/screenshots/mobile-zh.png' });
  await page.goto('/this-page-does-not-exist');
  await expect(
    page.getByRole('heading', { level: 1, name: '这个页面走丢了' })
  ).toBeVisible();
});

test('Mobile drawer aligns status and version and restores navigation focus', async ({
  page
}) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/categories/pdf');
  await expect(
    page.getByRole('heading', { level: 1, name: 'PDF 工具', exact: true })
  ).toBeVisible();
  const menu = page.getByRole('button', { name: '打开导航', exact: true });
  await menu.click();
  const drawer = page.locator('.ui-drawer');
  const status = drawer.locator('.sidebar-processing'),
    version = drawer.locator('.version');
  await expect(status).toBeVisible();
  await expect(
    drawer.getByRole('button', { name: /主题|Language/ })
  ).toHaveCount(0);
  const a = await status.boundingBox(),
    b = await version.boundingBox();
  expect(Math.abs(a.y + a.height / 2 - (b.y + b.height / 2))).toBeLessThan(1);
  expect(b.y + b.height).toBeLessThanOrEqual(812);
  await page.screenshot({ path: '.tmp/screenshots/shell-mobile-drawer.png' });
  await page.keyboard.press('Escape');
  await expect(drawer).not.toBeVisible();
  await expect(menu).toBeFocused();
  await page.screenshot({ path: '.tmp/screenshots/shell-mobile.png' });
});
