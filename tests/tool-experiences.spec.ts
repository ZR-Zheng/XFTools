import { expect, test, type Page } from '@playwright/test';
import { PDFDocument } from 'pdf-lib';
import { readFile } from 'node:fs/promises';
import JSZip from 'jszip';

async function imageFile(
  page: Page,
  width = 160,
  height = 120,
  name = 'sample.png'
) {
  const base64 = await page.evaluate(
    ([width, height]) => {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext('2d')!;
      context.fillStyle = '#2860e8';
      context.fillRect(0, 0, width, height);
      return canvas.toDataURL('image/png').split(',')[1];
    },
    [width, height]
  );
  return { name, mimeType: 'image/png', buffer: Buffer.from(base64, 'base64') };
}
test('Resize uses a compact preview, linked dimensions and real output pixels', async ({
  page
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/image-generic/resize');
  await expect(page.locator('.flow-result')).toHaveCount(0);
  expect(
    (await page.locator('.resize-upload').boundingBox())!.height
  ).toBeLessThan(260);
  await expect(
    page.getByRole('button', { name: '调整大小', exact: true })
  ).toBeDisabled();
  await page.locator('input[type=file]').setInputFiles(await imageFile(page));
  const width = page.getByTestId('width-input'),
    height = page.getByTestId('height-input');
  await width.fill('80');
  await expect(height).toHaveValue('60');
  await height.fill('30');
  await expect(width).toHaveValue('40');
  await page.getByRole('button', { name: '调整大小', exact: true }).click();
  const downloaded = page.waitForEvent('download');
  await page.getByRole('button', { name: '下载图片', exact: true }).click();
  const bytes = await readFile((await (await downloaded).path())!);
  expect(bytes.readUInt32BE(16)).toBe(40);
  expect(bytes.readUInt32BE(20)).toBe(30);
  await page.getByLabel('锁定宽高比', { exact: true }).uncheck();
  await width.fill('100');
  await height.fill('50');
  await expect(page.getByTestId('resize-target')).toHaveText('100 × 50');
  await expect(
    page.getByRole('button', { name: '下载图片', exact: true })
  ).toHaveCount(0);
  await page.getByRole('button', { name: '百分比', exact: true }).click();
  await page.getByTestId('percentage-input').fill('25');
  await expect(page.getByTestId('resize-target')).toHaveText('40 × 30');
  await page.getByTestId('percentage-input').fill('0');
  await page.getByRole('button', { name: '调整大小', exact: true }).click();
  await expect(page.getByRole('alert')).toBeVisible();
  for (const viewport of [375, 768, 1024]) {
    await page.setViewportSize({ width: viewport, height: 900 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth
      )
    ).toBe(true);
  }
  await page.screenshot({
    path: '.tmp/screenshots/resize-mobile.png',
    fullPage: true
  });
});
test('Resize batch keeps individual ratios and exports a ZIP', async ({
  page
}) => {
  await page.goto('/image-generic/resize');
  await page
    .locator('input[type=file]')
    .setInputFiles([
      await imageFile(page),
      await imageFile(page, 120, 160, 'portrait.png')
    ]);
  await page.getByTestId('width-input').fill('80');
  await expect(page.locator('.resize-file-card').nth(1)).toContainText(
    '80 × 107'
  );
  await page
    .getByRole('button', { name: '调整 2 张图片', exact: true })
    .click();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: '下载全部 ZIP', exact: true }).click();
  const archive = await download;
  expect(archive.suggestedFilename()).toMatch(/\.zip$/);
  const zip = await JSZip.loadAsync(await readFile((await archive.path())!));
  const portrait = await zip.file('portrait.png')!.async('nodebuffer');
  expect(portrait.readUInt32BE(16)).toBe(80);
  expect(portrait.readUInt32BE(20)).toBe(107);
});
test('Resize preserves SVG vectors and keeps tiny percent outputs valid', async ({
  page
}) => {
  await page.goto('/image-generic/resize');
  await page.locator('input[type=file]').setInputFiles({
    name: 'vector.svg',
    mimeType: 'image/svg+xml',
    buffer: Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="50"><rect width="100" height="50" fill="blue"/></svg>'
    )
  });
  await page.getByTestId('width-input').fill('50');
  await page.getByRole('button', { name: '调整大小', exact: true }).click();
  let download = page.waitForEvent('download');
  await page.getByRole('button', { name: '下载图片', exact: true }).click();
  const svg = await readFile((await (await download).path())!, 'utf8');
  expect(svg).toContain('width="50"');
  expect(svg).toContain('height="25"');
  expect(svg).toContain('viewBox="0 0 100 50"');
  await page
    .getByRole('button', { name: '移除 vector.svg', exact: true })
    .click();
  await page
    .locator('input[type=file]')
    .setInputFiles(await imageFile(page, 1, 1, 'tiny.png'));
  await page.getByRole('button', { name: '百分比', exact: true }).click();
  await page.getByTestId('percentage-input').fill('1');
  await page.getByRole('button', { name: '调整大小', exact: true }).click();
  download = page.waitForEvent('download');
  await page.getByRole('button', { name: '下载图片', exact: true }).click();
  const png = await readFile((await (await download).path())!);
  expect(png.readUInt32BE(16)).toBe(1);
  expect(png.readUInt32BE(20)).toBe(1);
});
test('Timestamp converts seconds, milliseconds and date fields without large text areas', async ({
  page
}) => {
  await page.goto('/time/convert-unix-to-date');
  await page.getByLabel('Unix 时间戳', { exact: true }).fill('0');
  await expect(page.locator('.timestamp-results')).toContainText(
    '1970-01-01T00:00:00.000Z'
  );
  await page.getByLabel('时间戳单位').selectOption('milliseconds');
  await page
    .getByLabel('日期和时间', { exact: true })
    .fill('2024-01-01T00:00:00.000');
  await expect(page.getByLabel('Unix 时间戳', { exact: true })).toHaveValue(
    '1704067200000'
  );
  await page.getByLabel('时间戳单位').selectOption('seconds');
  await expect(page.getByLabel('Unix 时间戳', { exact: true })).toHaveValue(
    '1704067200'
  );
  await page.getByLabel('Unix 时间戳', { exact: true }).fill('invalid');
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.locator('.timestamp-results')).toHaveCount(0);
});
test('PDF thumbnails select actual output pages and clear stale downloads', async ({
  page
}) => {
  const pdf = await PDFDocument.create();
  pdf.addPage([100, 200]);
  pdf.addPage([200, 100]);
  pdf.addPage([300, 100]);
  await page.goto('/pdf/split-pdf');
  await expect(page.locator('.flow-result')).not.toBeVisible();
  await page.locator('input[type=file]').setInputFiles({
    name: 'three.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from(await pdf.save())
  });
  await expect(
    page.getByRole('button', { name: '第 3 页', exact: true })
  ).toBeVisible();
  await page.getByRole('button', { name: '第 1 页', exact: true }).click();
  await page.getByRole('button', { name: '第 3 页', exact: true }).click();
  await page.getByTestId('process-tool').click();
  const download = page.waitForEvent('download');
  const save = page
    .locator('.flow-result')
    .getByRole('button', { name: /下载/ });
  await expect(save).toBeEnabled();
  await save.click();
  const output = await PDFDocument.load(
    await readFile((await (await download).path())!)
  );
  expect(output.getPageCount()).toBe(1);
  expect(output.getPage(0).getWidth()).toBe(200);
  await page.getByRole('button', { name: '第 1 页', exact: true }).click();
  await expect(save).toBeDisabled();
  await page.screenshot({
    path: '.tmp/screenshots/pdf-selection.png',
    fullPage: true
  });
});
test('Audio trim shows waveform, full duration and linked second controls', async ({
  page
}) => {
  const samples = 16000,
    wav = Buffer.alloc(44 + samples * 2);
  wav.write('RIFF');
  wav.writeUInt32LE(wav.length - 8, 4);
  wav.write('WAVEfmt ', 8);
  wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20);
  wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(8000, 24);
  wav.writeUInt32LE(16000, 28);
  wav.writeUInt16LE(2, 32);
  wav.writeUInt16LE(16, 34);
  wav.write('data', 36);
  wav.writeUInt32LE(samples * 2, 40);
  for (let i = 0; i < samples; i++)
    wav.writeInt16LE(Math.round(Math.sin(i / 8) * 20000), 44 + i * 2);
  await page.goto('/audio/trim');
  await expect(
    page.getByRole('radio', { name: 'MP3', exact: true })
  ).toBeChecked();
  await page.getByRole('radio', { name: 'WAV', exact: true }).check();
  await expect(
    page.getByRole('radio', { name: 'MP3', exact: true })
  ).not.toBeChecked();
  await expect(
    page.getByRole('radio', { name: 'WAV', exact: true })
  ).toBeChecked();
  await page
    .locator('input[type=file]')
    .setInputFiles({ name: 'tone.wav', mimeType: 'audio/wav', buffer: wav });
  await expect(page.locator('.audio-waveform.ready')).toBeVisible();
  await expect(page.getByLabel('结束时间（秒）')).toHaveValue('2');
  await page.getByLabel('开始时间（秒）').fill('0.5');
  await expect(page.locator('.trim-preview-actions')).toContainText(
    '1.50s / 2.00s'
  );
  await expect(page.locator('audio')).toHaveAttribute('controls', '');
  await page.getByRole('button', { name: '播放选区' }).click();
  await expect
    .poll(() =>
      page
        .locator('audio')
        .evaluate((audio: HTMLAudioElement) => audio.currentTime)
    )
    .toBeGreaterThanOrEqual(0.5);
  await page.screenshot({
    path: '.tmp/screenshots/audio-trim.png',
    fullPage: true
  });
});
