import { expect, test, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { Jimp } from 'jimp';
import JSZip from 'jszip';
import { PDFDocument, PageSizes } from 'pdf-lib';

test('legacy image links select the matching workspace controls and keep URL options', async ({
  page
}) => {
  await page.goto('/categories/image-generic');
  await expect(
    page.locator('.tool-grid .tile-link[href="/image/workspace"]')
  ).toHaveCount(1);
  await expect(
    page.locator('.tool-grid .tile-link[href^="/image-generic/"]')
  ).toHaveCount(0);
  await page.goto('/image-generic/convert?format=png#test');
  await expect(page).toHaveURL(/\/image\/workspace.*#test$/);
  await expect(
    page.getByRole('radio', { name: 'PNG', exact: true })
  ).toBeChecked();
  await page.goto('/image-generic/change-colors');
  await expect(
    page.getByRole('button', { name: '替色与透明' })
  ).toHaveAttribute('aria-pressed', 'true');
  await page
    .getByLabel('选择图片文件')
    .setInputFiles(await fixture(page, 40, 30));
  await expect(page.getByRole('combobox', { name: /^颜色处理/ })).toHaveValue(
    'replace'
  );
  await page.goto('/image-generic/change-opacity');
  await page
    .getByLabel('选择图片文件')
    .setInputFiles(await fixture(page, 40, 30));
  await page
    .getByRole('combobox', { name: /^不透明度方式/ })
    .selectOption('linear');
  await page.getByRole('slider', { name: '图片不透明度' }).press('Home');
  await page.getByLabel('横向起点（px）').fill('10');
  await page.getByLabel('区域宽度（px）').fill('20');
  const faded = await Jimp.read(await downloadImage(page, 'png'));
  expect(faded.getPixelColor(0, 0) & 255).toBe(255);
  expect(faded.getPixelColor(10, 0) & 255).toBeLessThan(10);
  expect(faded.getPixelColor(29, 0) & 255).toBeGreaterThan(245);
  expect(faded.getPixelColor(39, 0) & 255).toBe(255);
  await page.goto('/image-generic/split-to-pages');
  await expect(page.getByRole('tab', { name: '分页打印' })).toHaveAttribute(
    'aria-selected',
    'true'
  );
  await page.goto('/image-generic/remove-background');
  await expect(page.getByRole('tab', { name: '去背景' })).toHaveAttribute(
    'aria-selected',
    'true'
  );
});

test('the old rotation link exports SVG geometry and the watermark link processes PNG files', async ({
  page
}) => {
  await page.goto('/image-generic/rotate');
  await page.getByLabel('选择图片文件').setInputFiles({
    name: 'vector.svg',
    mimeType: 'image/svg+xml',
    buffer: Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="50"><rect width="100" height="50" fill="blue"/></svg>'
    )
  });
  await page.getByRole('button', { name: '右转 90°' }).click();
  await expect(page.locator('.iw-view-size')).toHaveText('50 × 100 px');
  const save = await downloadImage(page, 'svg');
  expect(save.toString()).toContain('viewBox="0 0 50 100"');
  expect(save.toString()).toContain('rotate(90)');
  expect(save.toString()).toContain('<rect');

  await page.goto('/image-generic/watermark');
  const input = await fixture(page, 160, 120);
  await page.getByLabel('选择批量图片').setInputFiles(input);
  await page.getByLabel('使用文件名作为水印').uncheck();
  await page.getByLabel('水印文字').fill('W');
  await page.getByLabel('水印位置').selectOption('center');
  await page.getByRole('button', { name: '添加水印', exact: true }).click();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: '下载', exact: true }).click();
  const marked = await Jimp.read(
    await readFile((await (await download).path())!)
  );
  const original = await Jimp.read(input.buffer);
  expect([marked.width, marked.height]).toEqual([160, 120]);
  expect(marked.bitmap.data.equals(original.bitmap.data)).toBe(false);
});

async function fixture(page: Page, width: number, height: number) {
  const url = await page.evaluate(
    ({ width, height }) => {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d')!;
      const halfWidth = width / 2;
      const halfHeight = height / 2;
      const colors = ['#183044', '#765a38', '#14325a', '#52652c'];
      colors.forEach((color, i) => {
        ctx.fillStyle = color;
        ctx.fillRect(
          (i % 2) * halfWidth,
          Math.floor(i / 2) * halfHeight,
          halfWidth,
          halfHeight
        );
      });
      return canvas.toDataURL();
    },
    { width, height }
  );
  return {
    name: 'source.png',
    mimeType: 'image/png',
    buffer: Buffer.from(url.split(',')[1], 'base64')
  };
}

async function downloadImage(
  page: Page,
  format: 'png' | 'jpg' | 'webp' | 'svg',
  background?: string
) {
  await page.getByRole('button', { name: '导出', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: '导出图片' });
  await dialog.getByLabel('文件名').fill('edited.png');
  await dialog.getByLabel('导出格式').selectOption(format);
  if (background) await dialog.getByLabel('背景色').fill(background);
  const pending = page.waitForEvent('download');
  await dialog.getByRole('button', { name: '下载图片' }).click();
  const download = await pending;
  await expect(dialog).toBeHidden();
  expect(download.suggestedFilename()).toBe(`edited.${format}`);
  return readFile((await download.path())!);
}

test('image workspace opens independently and exports the accumulated canvas edits', async ({
  page,
  context
}) => {
  await page.goto('/categories/image-generic');
  const link = page.getByRole('link', { name: '图片工作台 · 在新标签页打开' });
  await expect(link).toHaveAttribute('href', '/image/workspace');
  const popup = context.waitForEvent('page');
  await link.click();
  const workspace = await popup;
  await expect(workspace).toHaveURL(/\/image\/workspace$/);
  await expect(
    workspace.locator('.sidebar, .app-footer, .tool-page-header')
  ).toHaveCount(0);
  await workspace
    .getByLabel('选择图片文件')
    .setInputFiles(await fixture(workspace, 160, 120));
  const preview = workspace.getByRole('img', { name: '当前图片' });
  const dimensions = workspace.locator('.iw-view-size');
  await expect(dimensions).toHaveText('160 × 120 px');
  const image = (await preview.boundingBox())!;
  await workspace.mouse.move(image.x + 20, image.y + 10);
  await workspace.mouse.down();
  await workspace.mouse.move(image.x + 140, image.y + 90, { steps: 8 });
  await workspace.mouse.up();
  await expect(workspace.getByLabel('裁剪宽度（px）')).toHaveValue('120');
  await expect(workspace.getByLabel('裁剪高度（px）')).toHaveValue('80');

  const tools = workspace.getByRole('group', { name: '选择编辑工具' });
  await tools.getByRole('button', { name: '旋转', exact: true }).click();
  await expect(dimensions).toHaveText('120 × 80 px');
  await workspace.getByRole('button', { name: '右转 90°' }).click();
  await expect(dimensions).toHaveText('80 × 120 px');
  await workspace.getByRole('button', { name: '应用', exact: true }).click();
  await workspace.getByRole('button', { name: '撤销', exact: true }).click();
  await expect(dimensions).toHaveText('120 × 80 px');
  await workspace.getByRole('button', { name: '重做', exact: true }).click();
  await expect(dimensions).toHaveText('80 × 120 px');
  await tools.getByRole('button', { name: '尺寸', exact: true }).click();
  await workspace.getByLabel('宽度（px）', { exact: true }).fill('40');
  await expect(workspace.getByLabel('高度（px）', { exact: true })).toHaveValue(
    '60'
  );
  await tools.getByRole('button', { name: '调色', exact: true }).click();
  await workspace.getByRole('slider', { name: '亮度' }).press('End');
  await tools.getByRole('button', { name: '不透明度', exact: true }).click();
  const opacity = workspace.getByRole('slider', { name: '图片不透明度' });
  const slider = (await opacity.boundingBox())!;
  await opacity.click({
    position: { x: slider.width / 2, y: slider.height / 2 }
  });
  await expect(opacity).toHaveValue('50');
  await tools.getByRole('button', { name: '水印', exact: true }).click();
  await workspace.getByLabel('水印文字').fill('X');
  await workspace
    .getByLabel('水印位置', { exact: true })
    .selectOption('center');
  await workspace.getByRole('slider', { name: '文字大小' }).press('End');
  await expect(dimensions).toHaveText('40 × 60 px');

  const result = await Jimp.read(await downloadImage(workspace, 'png'));
  expect([result.width, result.height]).toEqual([40, 60]);
  const outsideWatermark = result.bitmap.data
    .subarray((4 * result.width + 5) * 4)
    .subarray(0, 4);
  [40, 100, 180, 128].forEach((value, index) =>
    expect(Math.abs(outsideWatermark[index] - value)).toBeLessThanOrEqual(2)
  );
  expect(
    result.bitmap.data.some((value, index) => index % 4 === 3 && value > 170)
  ).toBe(true);
});

test('phone-sized image workspace preserves circle transparency and exports other formats', async ({
  page
}) => {
  await page.setViewportSize({ width: 320, height: 760 });
  await page.goto('/image/workspace');
  await page
    .getByLabel('选择图片文件')
    .setInputFiles(await fixture(page, 80, 60));
  await expect(page.getByRole('img', { name: '当前图片' })).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth
    )
  ).toBe(true);
  await page.getByLabel('裁剪形状').selectOption('circle');
  const png = await Jimp.read(await downloadImage(page, 'png'));
  expect([png.width, png.height]).toEqual([60, 60]);
  expect(png.bitmap.data[3]).toBe(0);
  expect(png.bitmap.data[(30 * 60 + 30) * 4 + 3]).toBe(255);

  const jpeg = await Jimp.read(await downloadImage(page, 'jpg', '#ff0000'));
  expect([jpeg.width, jpeg.height]).toEqual([60, 60]);
  expect(jpeg.bitmap.data[0]).toBeGreaterThan(220);
  expect(jpeg.bitmap.data[1]).toBeLessThan(30);
  expect(jpeg.bitmap.data[2]).toBeLessThan(30);
  const webp = await downloadImage(page, 'webp');
  expect(webp.subarray(0, 4).toString()).toBe('RIFF');
  expect(webp.subarray(8, 12).toString()).toBe('WEBP');

  await page.getByLabel('选择图片文件').setInputFiles({
    name: 'broken.png',
    mimeType: 'image/png',
    buffer: Buffer.from('invalid image')
  });
  await expect(page.getByRole('alert')).toContainText('无法读取图片');
  await expect(page.locator('.iw-filename')).toHaveText('source.png');
  await expect(page.locator('.iw-view-size')).toHaveText('60 × 60 px');
});

test('batch processing shares a queue, preserves the canvas, and archives partial successes', async ({
  page
}) => {
  await page.goto('/image/workspace');
  const original = await fixture(page, 160, 120);
  await page.getByLabel('选择图片文件').setInputFiles(original);
  const dimensions = page.locator('.iw-view-size');
  await expect(dimensions).toHaveText('160 × 120 px');
  await page.getByRole('button', { name: '旋转', exact: true }).click();
  await page.getByRole('button', { name: '右转 90°' }).click();
  await page.getByRole('tab', { name: '批量处理' }).click();
  await page.getByRole('button', { name: '加入当前编辑结果' }).click();
  const jpeg = await (await Jimp.read(original.buffer)).getBuffer('image/jpeg');
  await expect(page.getByRole('list', { name: '图片列表' })).toContainText(
    'source-edited.png'
  );
  await page
    .getByLabel('选择批量图片')
    .setInputFiles([
      original,
      { name: 'photo.jpg', mimeType: 'image/jpeg', buffer: jpeg }
    ]);
  const queue = page.getByRole('list', { name: '图片列表' });
  await expect(queue.getByRole('listitem')).toHaveCount(3);
  const pngMode = page.getByRole('radio', { name: 'PNG 专用' });
  await pngMode.click();
  await expect(pngMode).toBeChecked();
  await page.getByTestId('process-tool').click();
  await expect(
    page.getByRole('status').filter({ hasText: '已完成' })
  ).toHaveText('已完成 2 / 3 张 · 1 张失败');
  const zipDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: '下载全部为 ZIP' }).click();
  const archive = await zipDownload;
  expect(archive.suggestedFilename()).toBe('compressed-pngs.zip');
  const zip = await JSZip.loadAsync(await readFile((await archive.path())!));
  expect(Object.keys(zip.files)).toHaveLength(2);
  const edited = await Jimp.read(
    await zip.file(/source-edited.*\.png$/)[0].async('nodebuffer')
  );
  expect([edited.width, edited.height]).toEqual([120, 160]);
  await expect(dimensions).toHaveText('120 × 160 px');
  await page.getByRole('tab', { name: '图片编辑' }).click();
  await page.getByRole('tab', { name: '批量处理' }).click();
  await expect(queue.getByRole('listitem')).toHaveCount(3);
  await page.getByRole('button', { name: '批量转换' }).click();
  const webpMode = page.getByRole('radio', { name: 'WebP' });
  await webpMode.click();
  await expect(webpMode).toBeChecked();
  await page.getByTestId('process-tool').click();
  await expect(
    page.getByRole('status').filter({ hasText: '已完成' })
  ).toHaveText('已完成 3 / 3 张');
  const webpDownload = page.waitForEvent('download');
  await queue
    .getByRole('button', { name: /下载 source-edited.*\.webp/ })
    .click();
  const bytes = await readFile((await (await webpDownload).path())!);
  expect(bytes.subarray(8, 12).toString()).toBe('WEBP');
  await expect(dimensions).toHaveText('120 × 160 px');
});

test('printing exports the current canvas as tiled A4 pages', async ({
  page
}) => {
  await page.goto('/image/workspace');
  await page
    .getByLabel('选择图片文件')
    .setInputFiles(await fixture(page, 320, 240));
  await expect(page.locator('.iw-view-size')).toHaveText('320 × 240 px');
  await page.getByRole('button', { name: '尺寸', exact: true }).click();
  await page.getByLabel('宽度（px）', { exact: true }).fill('160');
  await page.getByRole('tab', { name: '分页打印' }).click();
  await page.getByLabel('打印分辨率（DPI）').fill('10');
  await expect(page.getByText('预计 6 页')).toBeVisible();
  await page.getByRole('button', { name: '生成打印 PDF' }).click();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: '下载打印 PDF' }).click();
  const pdf = await PDFDocument.load(
    await readFile((await (await download).path())!)
  );
  expect(pdf.getPageCount()).toBe(6);
  expect(pdf.getPage(0).getSize()).toEqual({
    width: PageSizes.A4[0],
    height: PageSizes.A4[1]
  });
  await page
    .getByLabel('选择图片文件')
    .setInputFiles(await fixture(page, 40, 36));
  await expect(page.getByText('预计 1 页')).toBeVisible();
  await expect(page.getByRole('button', { name: '下载打印 PDF' })).toHaveCount(
    0
  );
});

test('cancelling compression preserves the batch queue for a retry', async ({
  page
}) => {
  let release: () => void = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const workerLibrary = '**/browser-image-compression-*.js';
  await page.route(workerLibrary, async (route) => {
    await gate;
    await route.continue().catch(() => {});
  });
  try {
    await page.goto('/image/workspace');
    await page.getByRole('tab', { name: '批量处理' }).click();
    await page
      .getByLabel('选择批量图片')
      .setInputFiles(await fixture(page, 80, 60));
    const queued = page.getByRole('list', { name: '图片列表' });
    await expect(queued.getByRole('listitem')).toHaveCount(1);
    const run = page.getByTestId('process-tool');
    const workerRequest = page.waitForRequest(workerLibrary);
    await run.click();
    await workerRequest;
    await page.getByRole('button', { name: '取消批量任务' }).click();
    await expect(page.getByText('已取消批量任务')).toBeVisible();
    await expect(queued.getByRole('listitem')).toHaveCount(1);
    await expect(queued.getByRole('button', { name: /下载/ })).toHaveCount(0);
    release();
    await page.unroute(workerLibrary);
    await run.click();
    await expect(page.getByText('已完成 1 / 1 张')).toBeVisible();
  } finally {
    release();
  }
});

test('background removal falls back offline and exports an undoable transparent image', async ({
  page,
  context
}) => {
  let modelRequests = 0;
  await context.route('**/resources.json', async (route) => {
    modelRequests++;
    await route.abort();
  });
  await page.goto('/image/workspace');
  const original = new Jimp({ width: 80, height: 60, color: 0xf8f8f8ff });
  original.scan(20, 15, 40, 30, (_x, _y, index) => {
    original.bitmap.data.set([220, 40, 20, 255], index);
  });
  original.setPixelColor(0xf8f8f8ff, 40, 30);
  await page.getByLabel('选择图片文件').setInputFiles({
    name: 'product.png',
    mimeType: 'image/png',
    buffer: await original.getBuffer('image/png')
  });
  await expect(page.locator('.iw-view-size')).toHaveText('80 × 60 px');
  await page.getByRole('tab', { name: '去背景' }).click();
  await page.getByRole('button', { name: '开始去背景' }).click();
  await expect(
    page.getByRole('button', { name: '去背景结果' })
  ).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('status')).toContainText('已用纯色去底处理');
  expect(modelRequests).toBeGreaterThan(0);
  await page.getByRole('button', { name: '处理前' }).click();
  await expect(
    page.getByRole('button', { name: '去背景结果' })
  ).toHaveAttribute('aria-pressed', 'false');
  await page.getByRole('button', { name: '应用到画布' }).click();
  await expect(page.getByRole('tab', { name: '图片编辑' })).toHaveAttribute(
    'aria-selected',
    'true'
  );
  const transparent = await Jimp.read(await downloadImage(page, 'png'));
  expect(transparent.getPixelColor(0, 0) & 255).toBe(0);
  expect(transparent.getPixelColor(25, 20)).toBe(0xdc2814ff);
  expect(transparent.getPixelColor(40, 30)).toBe(0xf8f8f8ff);
  await page.getByRole('button', { name: '撤销', exact: true }).click();
  const restored = await Jimp.read(await downloadImage(page, 'png'));
  expect(restored.bitmap.data[3]).toBe(255);

  const previousRequests = modelRequests;
  await page.getByRole('tab', { name: '去背景' }).click();
  await page.getByLabel('处理方式').selectOption('color');
  await page.getByRole('button', { name: '开始去背景' }).click();
  await expect(page.getByRole('button', { name: '去背景结果' })).toBeVisible();
  expect(modelRequests).toBe(previousRequests);

  const ambiguous = await fixture(page, 80, 60);
  await page.getByLabel('选择图片文件').setInputFiles(ambiguous);
  await expect(page.getByRole('button', { name: '去背景结果' })).toHaveCount(0);
  await page.getByRole('button', { name: '开始去背景' }).click();
  await expect(page.getByRole('alert')).toContainText('没有足够一致的底色');
  await expect(page.getByRole('button', { name: '应用到画布' })).toHaveCount(0);
});
