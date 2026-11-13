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
    '好用的工具'
  );
  await expect(page.locator('iframe')).toHaveCount(0);
  await page
    .getByRole('searchbox', { name: '搜索工具', exact: true })
    .fill('Base64');
  await expect(page.locator('.tool-grid .tool-tile').first()).toContainText(
    /base64/i
  );
  await expect(page).toHaveURL(/q=Base64/);
  await page.getByRole('button', { name: '清除搜索' }).click();
  await page.locator('.sidebar a[href="/categories/pdf"]').click();
  await expect(page.locator('.tool-grid .tool-tile').first()).toBeVisible();
  expect(errors).toEqual([]);
});
test('English and theme preferences survive reload', async ({ page }) => {
  await page.goto('/');
  const language = page.getByRole('button', { name: '语言 / Language' });
  await language.click();
  await expect(page.getByRole('menu')).toBeVisible();
  await expect(
    page.getByRole('menuitemradio', { name: '简体中文' })
  ).toHaveAttribute('aria-checked', 'true');
  await page.getByRole('menuitemradio', { name: 'English' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toContainText(
    'Everyday tools'
  );
  await page.getByRole('button', { name: 'Switch to dark theme' }).click();
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await language.focus();
  await page.keyboard.press('ArrowDown');
  await expect(page.getByRole('menu')).toBeVisible();
  await page.screenshot({ path: '.tmp/screenshots/language-en-dark.png' });
  await page.keyboard.press('Escape');
  await expect(page.getByRole('menu')).not.toBeVisible();
  await expect(language).toBeFocused();
  await language.click();
  await page.getByRole('menuitemradio', { name: '简体中文' }).click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'zh-CN');
  await page.getByRole('button', { name: '切换浅色主题' }).click();
  await language.click();
  await expect(page.locator('.language-menu-paper')).toHaveCSS('opacity', '1');
  await page.screenshot({ path: '.tmp/screenshots/language-zh-light.png' });
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
    'YOUR PERSONAL WORKSPACE'
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

test('Chinese tool descriptions and examples update when changing language', async ({
  page
}) => {
  await page.goto('/string/base64');
  await expect(
    page.getByRole('heading', {
      name: '使用 Base64 编码 UTF-8 文本',
      exact: true
    })
  ).toBeVisible();
  await expect(
    page.getByText('使用 Base64 对简单文本进行编码。', { exact: true })
  ).toBeVisible();
  await page.getByRole('button', { name: '语言 / Language' }).click();
  await page.getByRole('menuitemradio', { name: 'English' }).click();
  await expect(
    page.getByRole('heading', {
      name: 'Encode data in UTF-8 with Base64',
      exact: true
    })
  ).toBeVisible();
  await page.getByRole('button', { name: '语言 / Language' }).click();
  await page.getByRole('menuitemradio', { name: '简体中文' }).click();
  await expect(
    page.getByRole('heading', {
      name: '使用 Base64 编码 UTF-8 文本',
      exact: true
    })
  ).toBeVisible();
  await page.goto('/string/url-editor');
  await expect(page.getByRole('heading', { level: 1 })).not.toContainText(
    'URL Editor'
  );
  await expect(
    page.getByText('解析网址', { exact: true }).first()
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
  await page.goto('/string/base64');
  await expect(page.getByTestId('text-input')).toBeVisible();
  await page.getByTestId('text-input').fill('hello');
  await expect(page.getByTestId('text-result')).toHaveValue('aGVsbG8=');
  await page.screenshot({ path: '.tmp/screenshots/tool-zh.png' });
  await page.locator('.sidebar a[href="/recent"]').click();
  await expect(
    page.locator('.tool-grid a[href="/string/base64"]')
  ).toBeVisible();
});
test('Image editor still loads after uploading an image', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/image-generic/editor');
  const png = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 32;
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
    page.getByText('精细调整', { exact: true }).first()
  ).toBeVisible();
  await expect(page.getByText('Finetune', { exact: true })).toHaveCount(0);
  await page.screenshot({ path: '.tmp/screenshots/image-editor-zh.png' });
  expect(errors).toEqual([]);
});
test('PDF worker matches the viewer and renders an uploaded PDF', async ({
  page
}) => {
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
  await expect(page.locator('.react-pdf__Page canvas').first()).toBeVisible({
    timeout: 20000
  });
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
  await page.locator('.MuiDrawer-paper a[href="/favorites"]').click();
  await expect(
    page.getByRole('heading', { level: 1, name: '我的收藏' })
  ).toBeVisible();
  await page.screenshot({ path: '.tmp/screenshots/mobile-zh.png' });
  await page.goto('/this-page-does-not-exist');
  await expect(
    page.getByRole('heading', { level: 1, name: '这个页面走丢了' })
  ).toBeVisible();
});
