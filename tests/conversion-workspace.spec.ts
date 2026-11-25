import { readFile } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';
import JSZip from 'jszip';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { GifReader } from 'omggif';

test.use({ launchOptions: { ignoreDefaultArgs: ['--hide-scrollbars'] } });

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

test('Switching image output keeps the workspace aligned with classic scrollbars', async ({
  page
}) => {
  const width = 1120;
  await page.setViewportSize({ width, height: 400 });
  await page.goto('/converters/workspace?group=image&format=png');
  await page.addStyleTag({
    content: 'html::-webkit-scrollbar { width: 16px; }'
  });
  await picker(page).setInputFiles(image);
  await expect(row(page, 'test.jpg')).toBeVisible();
  const workspace = page.locator('.conversion-workspace');
  const height = () => workspace.evaluate((element) => element.offsetHeight);
  const compact = await height();
  await preset(page).selectOption('jpg');
  const expanded = await height();
  expect(expanded).toBeGreaterThan(compact);
  await page.setViewportSize({
    width,
    height: Math.floor((compact + expanded) / 2)
  });
  const geometry = () =>
    workspace.locator('.cw-container').evaluate((element) => {
      const { x, width } = element.getBoundingClientRect();
      const root = document.documentElement;
      return { x, width, scrollable: root.scrollHeight > root.clientHeight };
    });
  const before = await geometry();
  expect(before.scrollable).toBe(true);
  await preset(page).selectOption('png');
  const after = await geometry();
  expect(after.scrollable).toBe(false);
  expect(after.x).toBeCloseTo(before.x);
  expect(after.width).toBeCloseTo(before.width);
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
  const { scrollWidth, clientWidth } = await page.evaluate(() => {
    const root = document.documentElement;
    return { scrollWidth: root.scrollWidth, clientWidth: root.clientWidth };
  });
  expect(scrollWidth).toBe(clientWidth);
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

test('Detailed image and PDF parameters affect downloaded files', async ({
  page
}) => {
  await page.goto('/converters/workspace?group=image&format=pdf');
  const advanced = () => page.locator('.cw-advanced summary').click();
  await advanced();
  await page.getByLabel('PDF 纸张').selectOption('letter');
  await page.getByLabel('PDF 页边距（毫米）').fill('10');
  await picker(page).setInputFiles(image);
  await page
    .getByRole('button', { name: 'PDF 页面图片、文本与电子书' })
    .click();
  const pdf = await pdfFixture();
  await advanced();
  await page.getByLabel('PDF 渲染倍率').selectOption('2');
  await page.getByLabel('页面旋转').selectOption('90');
  await page.getByLabel('页码范围').fill('1');
  await picker(page).setInputFiles(pdf);
  await page.getByLabel('页码范围').fill('');
  await preset(page).selectOption('txt');
  await advanced();
  await page.getByLabel('分页分隔').selectOption('line');
  await page.getByLabel('使用 Windows 换行').check();
  await page.getByLabel('写入 UTF-8 BOM').check();
  await picker(page).setInputFiles({ ...pdf, name: 'text.pdf' });
  await preset(page).selectOption('epub');
  await advanced();
  await page.getByLabel('电子书书名').fill('样本 & 书名');
  await page.getByLabel('电子书作者').fill('作者');
  await page.getByLabel('电子书语言').selectOption('zh-CN');
  await picker(page).setInputFiles({ ...pdf, name: 'book.pdf' });
  await page.getByRole('button', { name: '开始转换' }).click();
  await expect(page.locator('.cw-row[data-status="done"]')).toHaveCount(4);
  const bundle = await JSZip.loadAsync(
    (await download(page, '下载 ZIP')).bytes
  );
  const paper = await PDFDocument.load(
    await bundle.file('test.pdf')!.async('uint8array')
  );
  expect(
    [paper.getPage(0).getWidth(), paper.getPage(0).getHeight()].sort()
  ).toEqual([612, 792]);
  const pageImage = await bundle.file('pages.png')!.async('nodebuffer');
  expect([pageImage.readUInt32BE(16), pageImage.readUInt32BE(20)]).toEqual([
    160, 200
  ]);
  expect((await bundle.file('text.txt')!.async('nodebuffer')).toString()).toBe(
    '\uFEFFFirst page\r\nSecond page'
  );
  const book = await JSZip.loadAsync(
    await bundle.file('book.epub')!.async('uint8array')
  );
  const metadata = await book.file('OEBPS/content.opf')!.async('string');
  expect(metadata).toContain('<dc:title>样本 &amp; 书名</dc:title>');
  expect(metadata).toContain('<dc:creator>作者</dc:creator>');
  expect(metadata).toContain('<dc:language>zh-CN</dc:language>');
});

test('Detailed media options change dimensions, play length, and WAV settings', async ({
  page
}) => {
  await page.goto('/converters/workspace?group=video&format=gif');
  const advanced = () => page.locator('.cw-advanced summary').click();
  const source = {
    name: 'motion.webm',
    mimeType: 'video/webm',
    buffer: await readFile(video)
  };
  await advanced();
  await page.getByLabel('GIF 长边上限').selectOption('160');
  await page.getByLabel('GIF 帧率').selectOption('10');
  await page.getByLabel('GIF 色数').selectOption('32');
  await page.getByLabel('GIF 循环').selectOption('-1');
  await page.getByLabel('GIF 抖动').selectOption('none');
  await page.getByLabel('截取起点（秒）').fill('0.1');
  await page.getByLabel('截取时长（秒）').fill('0.5');
  await picker(page).setInputFiles(source);
  await preset(page).selectOption('mp4');
  await advanced();
  await page.getByLabel('视频长边上限').selectOption('160');
  await page.getByLabel('视频帧率').selectOption('24');
  await page.getByLabel('截取时长（秒）').fill('0.5');
  await page.getByLabel('移除音轨').check();
  await page.getByLabel('网页快速播放').check();
  await picker(page).setInputFiles({ ...source, name: 'movie.webm' });
  await preset(page).selectOption('wav');
  await advanced();
  await page.getByLabel('采样率').selectOption('32000');
  await page.getByLabel('声道').selectOption('1');
  await page.getByLabel('WAV 位深').selectOption('24');
  await page.getByLabel('截取时长（秒）').fill('0.25');
  await picker(page).setInputFiles({ ...source, name: 'sound.webm' });
  await page.getByRole('button', { name: '开始转换' }).click();
  await expect(page.locator('.cw-row[data-status="done"]')).toHaveCount(3, {
    timeout: 30000
  });
  const gif = new GifReader(
    (await download(page, '下载 motion.webm 的结果')).bytes
  );
  expect(Math.max(gif.width, gif.height)).toBe(160);
  expect(gif.loopCount()).toBeNull();
  expect(
    Array.from(
      { length: gif.numFrames() },
      (_, i) => gif.frameInfo(i).delay
    ).reduce((a, b) => a + b, 0)
  ).toBe(50);
  const mp4 = (await download(page, '下载 movie.webm 的结果')).bytes;
  expect(mp4.indexOf('moov')).toBeLessThan(mp4.indexOf('mdat'));
  expect(mp4.includes(Buffer.from('mp4a'))).toBe(false);
  expect(mp4.readUInt32BE(mp4.indexOf('stsz') + 12)).toBe(12);
  const wav = (await download(page, '下载 sound.webm 的结果')).bytes;
  const header = wav.indexOf('fmt ') + 8;
  expect(wav.readUInt16LE(header + 2)).toBe(1);
  expect(wav.readUInt32LE(header + 4)).toBe(32000);
  expect(wav.readUInt16LE(header + 14)).toBe(24);
  expect(
    Math.abs(wav.readUInt32LE(wav.indexOf('data') + 4) / 3 - 8000)
  ).toBeLessThan(32);
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
