import { readFile } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';
import JSZip from 'jszip';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { GifReader } from 'omggif';

const video = 'tests/fixtures/video/purple-tone.webm';
const silent = 'tests/fixtures/video/blue-silent.webm';
const image = 'src/pages/tools/image/png/convert-jgp-to-png/test.jpg';
const picker = (page: Page) => page.locator('input[type="file"]');
const preset = (page: Page) => page.getByLabel('输出格式', { exact: true });
const row = (page: Page, name: string) =>
  page.getByRole('listitem', { name, exact: true });

async function download(page: Page, name: string) {
  const [file] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name, exact: true }).click()
  ]);
  return {
    name: file.suggestedFilename(),
    bytes: await readFile(await file.path())
  };
}

async function pdfFixture() {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  doc
    .addPage([100, 80])
    .drawText('First page', { x: 12, y: 40, size: 11, font });
  doc
    .addPage([80, 120])
    .drawText('Second page', { x: 12, y: 40, size: 11, font });
  return {
    name: 'pages.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from(await doc.save())
  };
}

test('File conversion aliases choose the matching category and output', async ({
  page
}) => {
  for (const [entry, group, format] of [
    ['audio-converter', 'audio', 'mp3'],
    ['video-to-gif', 'video', 'gif'],
    ['convert-to-jpg', 'image', 'jpg'],
    ['convert-to-webp', 'image', 'webp']
  ]) {
    await page.goto(`/converters/${entry}`);
    await expect(page).toHaveURL(
      new RegExp(`/converters/workspace\\?group=${group}`)
    );
    await expect(preset(page)).toHaveValue(format);
  }
});

test('Mixed tasks save settings, produce files and ZIP, and isolate failures', async ({
  page
}) => {
  const requests: string[] = [];
  page.on('request', (request) => requests.push(request.url()));
  await page.goto('/converters/convert-to-webp');
  await picker(page).setInputFiles(image);
  await preset(page).selectOption('bmp');
  await picker(page).setInputFiles(image);
  await preset(page).selectOption('pdf');
  await picker(page).setInputFiles(image);
  await page
    .getByRole('button', { name: 'PDF 页面图片、文本与电子书' })
    .click();
  const pdf = await pdfFixture();
  await picker(page).setInputFiles(pdf);
  await preset(page).selectOption('txt');
  await page.getByLabel('页码范围').fill('2');
  await picker(page).setInputFiles({ ...pdf, name: 'text.pdf' });
  await preset(page).selectOption('epub');
  await picker(page).setInputFiles({ ...pdf, name: 'book.pdf' });
  await picker(page).setInputFiles({
    name: 'broken.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from('%PDF-1.4 not a document')
  });
  await page.getByRole('button', { name: '开始转换' }).click();
  await expect(page.locator('.cw-row[data-status="done"]')).toHaveCount(6);
  await expect(row(page, 'broken.pdf')).toHaveAttribute('data-status', 'error');
  expect(requests.some((url) => url.includes('ffmpeg-core'))).toBe(false);
  const result = await download(page, '下载 ZIP');
  const zip = await JSZip.loadAsync(result.bytes);
  expect(Object.keys(zip.files).sort()).toEqual([
    'book.epub',
    'pages-pages.zip',
    'test.bmp',
    'test.pdf',
    'test.webp',
    'text.txt'
  ]);
  const webp = await zip.file('test.webp')!.async('nodebuffer');
  expect(webp.toString('ascii', 8, 12)).toBe('WEBP');
  const bmp = await zip.file('test.bmp')!.async('nodebuffer');
  expect(bmp.toString('ascii', 0, 2)).toBe('BM');
  const single = await PDFDocument.load(
    await zip.file('test.pdf')!.async('uint8array')
  );
  expect(single.getPageCount()).toBe(1);
  const pages = await JSZip.loadAsync(
    await zip.file('pages-pages.zip')!.async('uint8array')
  );
  expect(Object.keys(pages.files)).toEqual(['page-1.png', 'page-2.png']);
  expect(
    (await pages.file('page-2.png')!.async('nodebuffer')).toString(
      'ascii',
      1,
      4
    )
  ).toBe('PNG');
  expect(await zip.file('text.txt')!.async('string')).toBe('Second page');
  const book = await JSZip.loadAsync(
    await zip.file('book.epub')!.async('uint8array')
  );
  expect(await book.file('OEBPS/chapter1.xhtml')!.async('string')).toContain(
    'Second page'
  );
  expect(book.file('OEBPS/chapter2.xhtml')).toBeNull();

  await page.screenshot({
    path: '.tmp/screenshots/conversion-workspace-desktop.png',
    fullPage: true
  });
  await page.setViewportSize({ width: 375, height: 812 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    375
  );
  await page.screenshot({
    path: '.tmp/screenshots/conversion-workspace-mobile.png',
    fullPage: true
  });
});

test('Video converts to animated GIF, playable MP4 and audio, and reports missing tracks', async ({
  page
}) => {
  test.setTimeout(120000);
  await page.goto('/converters/video-to-gif');
  const bytes = await readFile(video);
  const source = (name: string) => ({
    name,
    mimeType: 'video/webm',
    buffer: bytes
  });
  await picker(page).setInputFiles(source('animated.webm'));
  await preset(page).selectOption('mp4');
  await picker(page).setInputFiles(source('movie.webm'));
  for (const group of ['webm', 'mov', 'mkv']) {
    await preset(page).selectOption(group);
    await picker(page).setInputFiles(source(`${group}-source.webm`));
  }
  await preset(page).selectOption('m4a');
  await picker(page).setInputFiles(source('sound.webm'));
  await picker(page).setInputFiles(silent);
  await page.getByRole('button', { name: '开始转换' }).click();
  await expect(page.getByRole('button', { name: '开始转换' })).toBeDisabled({
    timeout: 30000
  });
  await expect(row(page, 'blue-silent.webm')).toContainText('此文件没有音轨。');
  for (const name of ['animated.webm', 'movie.webm', 'sound.webm'])
    await expect(row(page, name)).toHaveAttribute('data-status', 'done');
  const gif = await download(page, '下载 animated.webm 的结果');
  expect(gif.name).toBe('animated.gif');
  expect(new GifReader(gif.bytes).numFrames()).toBeGreaterThan(1);
  const movie = await download(page, '下载 movie.webm 的结果');
  expect(movie.bytes.toString('ascii', 4, 8)).toBe('ftyp');
  const audio = await download(page, '下载 sound.webm 的结果');
  expect(audio.name).toBe('sound.m4a');
  expect(audio.bytes.toString('ascii', 4, 8)).toBe('ftyp');
  for (const format of ['webm', 'mov', 'mkv']) {
    const file = await download(page, `下载 ${format}-source.webm 的结果`);
    expect(file.name).toBe(`${format}-source.${format}`);
    if (format === 'mov')
      expect(file.bytes.toString('ascii', 4, 8)).toBe('ftyp');
    else expect(file.bytes.subarray(0, 4).toString('hex')).toBe('1a45dfa3');
  }

  await page.goto('/converters/audio-converter');
  for (const format of ['opus', 'flac']) {
    await preset(page).selectOption(format);
    await picker(page).setInputFiles({
      name: `${format}-source.m4a`,
      mimeType: 'audio/mp4',
      buffer: audio.bytes
    });
  }
  await page.getByRole('button', { name: '开始转换' }).click();
  await expect(page.locator('.cw-row[data-status="done"]')).toHaveCount(2, {
    timeout: 30000
  });
  const opus = await download(page, '下载 opus-source.m4a 的结果');
  expect(opus.bytes.toString('ascii', 0, 4)).toBe('OggS');
  const flac = await download(page, '下载 flac-source.m4a 的结果');
  expect(flac.bytes.toString('ascii', 0, 4)).toBe('fLaC');
});

test('Stopping a queued media task preserves pending tasks and allows retry', async ({
  page
}) => {
  await page.goto('/converters/workspace');
  await page.evaluate(
    () =>
      new Promise<void>((ready) => {
        void navigator.locks.request(
          'xftools-video-export',
          () => new Promise<void>(() => ready())
        );
      })
  );
  await picker(page).setInputFiles([video, silent]);
  await page.getByRole('button', { name: '开始转换' }).click();
  await expect(row(page, 'purple-tone.webm')).toContainText('等待媒体引擎');
  await page.getByRole('button', { name: '停止转换' }).click();
  await expect(row(page, 'purple-tone.webm')).toHaveAttribute(
    'data-status',
    'cancelled'
  );
  await expect(row(page, 'blue-silent.webm')).toHaveAttribute(
    'data-status',
    'pending'
  );
  await page.getByRole('button', { name: '重试 purple-tone.webm' }).click();
  await expect(row(page, 'purple-tone.webm')).toHaveAttribute(
    'data-status',
    'pending'
  );
});
