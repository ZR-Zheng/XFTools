import { readFile } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';
import JSZip from 'jszip';
import { PDFDocument } from 'pdf-lib';

async function transparentPng(page: Page) {
  const image = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 40;
    canvas.height = 20;
    const context = canvas.getContext('2d')!;
    context.fillStyle = '#c04020';
    context.fillRect(0, 0, 20, 20);
    return canvas.toDataURL('image/png').split(',')[1];
  });
  return Buffer.from(image, 'base64');
}

async function download(page: Page, name: string) {
  const event = page.waitForEvent('download');
  await page.getByRole('button', { name, exact: true }).click();
  return await event;
}

test('Image conversion keeps the upload while switching format and invalidates old downloads', async ({
  page
}) => {
  await page.goto('/converters/convert-to-webp');
  await expect(page).toHaveURL(/\/image-generic\/convert\?format=webp$/);
  await expect(
    page.getByRole('radio', { name: 'WebP', exact: true })
  ).toBeChecked();
  await expect(
    page.getByRole('checkbox', { name: '保留透明区域' })
  ).toBeChecked();
  const buffer = await transparentPng(page);
  await page.locator('input[type=file]').setInputFiles([
    { name: 'first.png', mimeType: 'image/png', buffer },
    { name: 'first.png', mimeType: 'image/png', buffer }
  ]);
  await page.getByTestId('process-tool').click();
  const webp = await download(page, '下载');
  expect(webp.suggestedFilename()).toBe('first.webp');
  const bytes = await readFile((await webp.path())!);
  expect(bytes.toString('ascii', 8, 12)).toBe('WEBP');
  const alpha = await page.evaluate(async (encoded) => {
    const data = Uint8Array.from(atob(encoded), (character) =>
      character.charCodeAt(0)
    );
    const image = await createImageBitmap(
      new Blob([data], { type: 'image/webp' })
    );
    const canvas = document.createElement('canvas');
    canvas.width = image.width;
    canvas.height = image.height;
    const context = canvas.getContext('2d')!;
    context.drawImage(image, 0, 0);
    image.close();
    return context.getImageData(30, 1, 1, 1).data[3];
  }, bytes.toString('base64'));
  expect(alpha).toBe(0);
  const bundle = await download(page, '下载全部为 ZIP');
  const archive = await JSZip.loadAsync(await readFile((await bundle.path())!));
  expect(Object.keys(archive.files).sort()).toEqual([
    'first-2.webp',
    'first.webp'
  ]);

  const jpgMode = page.getByRole('radio', { name: 'JPG', exact: true });
  await jpgMode.click();
  await expect(jpgMode).toBeChecked();
  await expect(
    page.getByRole('button', { name: '下载', exact: true })
  ).toHaveCount(0);
  await expect(page.getByLabel('透明区域的底色')).toBeVisible();
  await expect(
    page.getByRole('list', { name: '图片列表' }).locator('li')
  ).toHaveCount(2);
  await page.getByTestId('process-tool').click();
  const jpg = await download(page, '下载');
  expect(jpg.suggestedFilename()).toBe('first.jpg');
  expect((await readFile((await jpg.path())!)).subarray(0, 3)).toEqual(
    Buffer.from([255, 216, 255])
  );
});

test('Existing PNG compression links select the PNG controls in the shared workspace', async ({
  page
}) => {
  await page.goto('/png/compress-png');
  await expect(page).toHaveURL(/\/image-generic\/compress\?mode=png$/);
  await expect(
    page.getByRole('radio', { name: 'PNG 专用', exact: true })
  ).toBeChecked();
  await expect(page.getByLabel('目标体积（KB）')).toBeVisible();
  await expect(
    page.getByRole('checkbox', { name: '使用抖动改善渐变' })
  ).toBeVisible();
  const standardMode = page.getByRole('radio', { name: '通用', exact: true });
  await standardMode.click();
  await expect(standardMode).toBeChecked();
  await expect(page.getByLabel('目标体积（MB）')).toBeVisible();
  await expect(page.getByLabel('目标体积（KB）')).toHaveCount(0);
});

test('Duration conversion shares clock input between directions and marks bad batch rows', async ({
  page
}) => {
  await page.goto('/time/convert-time-to-seconds');
  await expect(page).toHaveURL(
    /\/time\/convert-duration\?mode=time-to-seconds$/
  );
  await page.getByRole('button', { name: '载入示例', exact: true }).click();
  const result = page.getByLabel('换算结果');
  await expect(result).toHaveText('5400');
  await page.getByLabel('换算方向').selectOption('time-to-decimal');
  await expect(page.getByLabel('时长', { exact: true })).toHaveValue(
    '01:30:00'
  );
  await expect(result).toHaveText('1.500000');
  await page.getByRole('button', { name: '批量', exact: true }).click();
  await page.getByTestId('text-input').fill('01:30:00\ninvalid\n00:45:00');
  await expect(page.getByRole('alert')).toContainText('第 2 行格式有误');
  await expect(page.getByTestId('text-result')).toHaveValue(
    '1.500000\n\n0.750000'
  );
});

test('PDF export keeps the original document while switching from selected PNG pages to EPUB', async ({
  page
}) => {
  const pdf = await PDFDocument.create();
  pdf.addPage([160, 180]).drawText('First page');
  pdf.addPage([220, 240]).drawText('A & B');
  await page.goto('/pdf/pdf-to-png');
  await expect(page).toHaveURL(/\/pdf\/export\?format=png$/);
  await page.locator('input[type=file]').setInputFiles({
    name: 'report.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from(await pdf.save())
  });
  await page.getByLabel('导出页码').fill('2');
  await page.getByLabel('渲染倍率').selectOption('1');
  await page.getByTestId('process-tool').click();
  const png = await download(page, 'page-2.png');
  const pngBytes = await readFile((await png.path())!);
  expect([pngBytes.readUInt32BE(16), pngBytes.readUInt32BE(20)]).toEqual([
    220, 240
  ]);
  await expect(page.locator('.pdf-export-pages li')).toHaveCount(1);

  const epubMode = page.getByRole('radio', { name: 'EPUB', exact: true });
  await epubMode.click();
  await expect(epubMode).toBeChecked();
  await expect(
    page.getByRole('button', { name: '下载全部为 ZIP' })
  ).toHaveCount(0);
  await expect(page.getByText('report.pdf', { exact: true })).toBeVisible();
  await page.getByTestId('process-tool').click();
  const epub = await download(page, '下载 EPUB');
  expect(epub.suggestedFilename()).toBe('report.epub');
  const archive = await JSZip.loadAsync(await readFile((await epub.path())!));
  expect(await archive.file('mimetype')?.async('string')).toBe(
    'application/epub+zip'
  );
  expect(await archive.file('OEBPS/chapter2.xhtml')?.async('string')).toContain(
    'A &amp; B'
  );
});

test('Multiple saved links to merged tools are shown as single canonical entries', async ({
  page
}) => {
  await page.addInitScript(() => {
    const old = [
      'converters/convert-to-jpg',
      'png/convert-jgp-to-png',
      'time/convert-hours-to-days'
    ];
    localStorage.setItem('bookmarkedTools', old.join(','));
    localStorage.setItem('recentTools', JSON.stringify(old));
  });
  for (const path of ['/favorites', '/recent']) {
    await page.goto(path);
    const links = page.locator('.tool-grid .tile-link');
    await expect(links).toHaveCount(2);
    await expect(links.first()).toHaveAttribute(
      'href',
      '/image-generic/convert'
    );
    await expect(links.last()).toHaveAttribute(
      'href',
      '/time/convert-duration'
    );
  }
});
