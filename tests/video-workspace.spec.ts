import { readFile } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';
import { GifReader, GifWriter } from 'omggif';

const silentVideo = 'tests/fixtures/video/blue-silent.webm';
const videoWithAudio = 'tests/fixtures/video/purple-tone.webm';

test.use({ actionTimeout: 10000 });

function music() {
  const rate = 8000;
  const buffer = Buffer.alloc(44 + 2 * rate * 3);
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(buffer.length - 8, 4);
  buffer.write('WAVEfmt ', 8);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(rate, 24);
  buffer.writeUInt32LE(rate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(buffer.length - 44, 40);
  for (let index = 0; index < rate * 3; index++)
    buffer.writeInt16LE(
      Math.round(2600 * Math.sin((2 * Math.PI * 330 * index) / rate)),
      44 + index * 2
    );
  return { name: '配乐.wav', mimeType: 'audio/wav', buffer };
}

async function importEffectPicture(page: Page) {
  const png = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 96;
    canvas.height = 64;
    const context = canvas.getContext('2d')!;
    context.fillStyle = '#dd5436';
    context.fillRect(12, 0, 84, 64);
    return canvas.toDataURL().split(',')[1];
  });
  await page.getByLabel('导入视频或图片素材').setInputFiles({
    name: 'effects.png',
    mimeType: 'image/png',
    buffer: Buffer.from(png, 'base64')
  });
  const duration = page.getByLabel('图片停留（秒）');
  await duration.fill('1.5');
  await duration.press('Enter');
  await page.getByRole('button', { name: '效果', exact: true }).click();
}

test('Video timeline combines editing operations without loading FFmpeg before export', async ({
  page
}) => {
  const requests: string[] = [];
  page.on('request', (request) => requests.push(request.url()));
  await page.goto('/video/add-audio');
  await expect(page).toHaveURL(/\/video\/workspace\?panel=audio$/);
  await expect(
    page.getByRole('button', { name: '音频', exact: true })
  ).toHaveAttribute('aria-pressed', 'true');
  await expect(
    page.getByRole('button', { name: '导出', exact: true })
  ).toBeDisabled();
  const input = page.getByLabel('导入视频或图片素材');
  await input.setInputFiles(silentVideo);
  await expect(page.locator('.vw-clip')).toHaveCount(1);
  await expect
    .poll(() =>
      page
        .locator('.vw-asset img')
        .first()
        .evaluate((image: HTMLImageElement) => {
          if (!image.naturalWidth) return 0;
          const canvas = document.createElement('canvas');
          canvas.width = canvas.height = 1;
          const context = canvas.getContext('2d')!;
          context.drawImage(image, 0, 0, 1, 1, 0, 0, 1, 1);
          return context.getImageData(0, 0, 1, 1).data[2];
        })
    )
    .toBeGreaterThan(100);
  await page.getByLabel('导入配乐文件').setInputFiles(music());
  await expect(page.locator('.vw-audio-clip')).toBeVisible();
  await page.getByRole('button', { name: '片段', exact: true }).click();
  const trimHandle = page.getByRole('button', { name: '拖动调整片段出点' });
  const trim = (await trimHandle.boundingBox())!;
  const x = trim.x + trim.width / 2;
  const y = trim.y + trim.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x - 12, y, { steps: 4 });
  await page.mouse.up();
  expect(Number(await page.getByLabel('出点（秒）').inputValue())).toBeLessThan(
    1
  );
  await page.getByLabel('播放速度').selectOption('1.25');
  const scrubber = page.getByRole('slider', {
    name: '时间线播放位置',
    exact: true
  });
  const box = (await scrubber.boundingBox())!;
  await scrubber.click({
    position: { x: Math.round(box.width * 0.46), y: Math.round(box.height / 2) }
  });
  await page.getByRole('button', { name: '分割', exact: true }).click();
  await expect(page.locator('.vw-clip')).toHaveCount(2);
  await page.getByRole('button', { name: '撤销', exact: true }).click();
  await expect(page.locator('.vw-clip')).toHaveCount(1);
  await page.getByRole('button', { name: '重做', exact: true }).click();
  await page.getByRole('button', { name: '复制片段', exact: true }).click();
  await expect(page.locator('.vw-clip')).toHaveCount(3);
  await page.getByRole('button', { name: '前移片段', exact: true }).click();
  await page.getByRole('button', { name: '画面', exact: true }).click();
  await page
    .getByRole('combobox', { name: '旋转', exact: true })
    .selectOption('90');
  await page.getByRole('button', { name: '水平翻转', exact: true }).click();
  await expect(
    page.getByRole('button', { name: '水平翻转', exact: true })
  ).toHaveAttribute('aria-pressed', 'true');
  await expect(
    page.getByRole('button', { name: '导出', exact: true })
  ).toBeEnabled();
  expect(requests.some((url) => /ffmpeg-core|\.wasm/.test(url))).toBe(false);
  await expect(page.getByRole('region', { name: '编辑时间线' })).toBeInViewport(
    { ratio: 1 }
  );
  await page.getByRole('slider', { name: '时间线缩放' }).press('End');
  await page.screenshot({
    path: '.tmp/screenshots/video-workspace-desktop.png',
    animations: 'disabled'
  });
  await page.setViewportSize({ width: 375, height: 812 });
  await page.getByRole('button', { name: '打开片段设置' }).click();
  await expect(page.getByRole('dialog', { name: '片段设置' })).toBeVisible();
  await page.screenshot({
    path: '.tmp/screenshots/video-workspace-mobile.png',
    animations: 'disabled'
  });
  const mobileInspector = page.getByRole('dialog', { name: '片段设置' });
  await mobileInspector
    .getByRole('button', { name: '效果', exact: true })
    .click();
  await mobileInspector.getByLabel('蒙版形状').selectOption('rectangle');
  await expect(mobileInspector.getByLabel('蒙版宽度（%）')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: '片段设置' })).toHaveCount(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth
    )
  ).toBe(true);
});

test('Exports mixed-size clips, silent source video and soundtrack into a playable MP4', async ({
  page
}) => {
  test.setTimeout(120000);
  const requests: string[] = [];
  page.on('request', (request) => requests.push(request.url()));
  await page.goto('/video/workspace');
  await page
    .getByLabel('导入视频或图片素材')
    .setInputFiles([silentVideo, videoWithAudio]);
  await expect(page.locator('.vw-clip')).toHaveCount(2);
  const out = page.getByLabel('出点（秒）');
  await out.fill('0.8');
  await out.press('Enter');
  await page.getByLabel('播放速度').selectOption('2');
  await page.getByLabel('导入配乐文件').setInputFiles(music());
  await expect(page.locator('.vw-audio-clip')).toBeVisible();
  await page.getByRole('button', { name: '导出', exact: true }).click();
  await page.getByRole('button', { name: '开始导出', exact: true }).click();
  const download = page.getByRole('button', { name: '下载文件', exact: true });
  await expect(download).toBeVisible({ timeout: 60000 });
  const result = page.getByLabel('导出成片预览');
  await expect
    .poll(() => result.evaluate((video: HTMLVideoElement) => video.videoWidth))
    .toBe(320);
  const metadata = await result.evaluate((video: HTMLVideoElement) => ({
    height: video.videoHeight,
    duration: video.duration
  }));
  expect(metadata.height).toBe(180);
  expect(metadata.duration).toBeGreaterThan(1.33);
  expect(metadata.duration).toBeLessThan(1.65);
  const frames = await result.evaluate(async (video: HTMLVideoElement) => {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 1;
    const ctx = canvas.getContext('2d')!;
    const colors = [];
    for (const time of [0.2, 0.65]) {
      const decoded = new Promise<void>((resolve) => {
        video.addEventListener('seeked', () => resolve(), { once: true });
      });
      video.currentTime = time;
      await decoded;
      ctx.drawImage(video, 160, 20, 1, 1, 0, 0, 1, 1);
      colors.push(Array.from(ctx.getImageData(0, 0, 1, 1).data).slice(0, 3));
    }
    return colors;
  });
  expect(frames[0][0]).toBeLessThan(50);
  expect(frames[1][0]).toBeGreaterThan(90);
  expect(
    requests.some((url) => /127\.0\.0\.1:4173.*ffmpeg-core.*wasm/.test(url))
  ).toBe(true);
  expect(requests.some((url) => /unpkg\.com/.test(url))).toBe(false);
  const saved = page.waitForEvent('download');
  await download.click();
  const file = await saved;
  expect(file.suggestedFilename()).toBe('blue-silent-edited.mp4');
  const bytes = await readFile((await file.path())!);
  expect(bytes.subarray(4, 8).toString('ascii')).toBe('ftyp');
  expect(bytes.includes(Buffer.from('mp4a'))).toBe(true);
});

test('Clip effects preview and export matching feathered, grayscale frames with a fade-in', async ({
  page
}) => {
  await page.goto('/video/workspace?format=mp4');
  await importEffectPicture(page);
  await page.getByLabel('蒙版形状').selectOption('ellipse');
  const feather = page.getByLabel('边缘羽化（%）');
  await feather.fill('50');
  await feather.press('Enter');
  await page.getByLabel('滤镜预设').selectOption('grayscale');
  await page.getByLabel('动画效果').selectOption('fadeIn');

  const screen = page.getByLabel('时间线画面');
  const pixels = () =>
    screen.evaluate((canvas: HTMLCanvasElement) => {
      const context = canvas.getContext('2d')!;
      return [48, 74, 92].map((x) =>
        Array.from(context.getImageData(x, 32, 1, 1).data.slice(0, 3))
      );
    });
  await expect.poll(pixels).toEqual(Array(3).fill([0, 0, 0]));
  await page.getByRole('slider', { name: '时间线播放位置' }).press('End');
  await expect.poll(async () => (await pixels())[0][0]).toBeGreaterThan(70);
  const preview = await pixels();
  expect(preview[0][0]).toBe(preview[0][1]);
  expect(preview[2]).toEqual([0, 0, 0]);
  expect(preview[1][0]).toBeGreaterThan(10);
  expect(preview[1][0]).toBeLessThan(preview[0][0] - 15);
  await page.getByRole('button', { name: '撤销', exact: true }).click();
  await expect(page.getByLabel('动画效果')).toHaveValue('');
  await page.getByRole('button', { name: '重做', exact: true }).click();
  await expect(page.getByLabel('动画效果')).toHaveValue('fadeIn');

  await page.getByRole('button', { name: '导出', exact: true }).click();
  await page.getByRole('button', { name: '开始导出', exact: true }).click();
  const result = page.getByLabel('导出成片预览');
  await expect(result.or(page.getByRole('alert'))).toBeVisible({
    timeout: 30000
  });
  await expect(result).toBeVisible({ timeout: 1000 });
  await expect
    .poll(() => result.evaluate((video: HTMLVideoElement) => video.readyState))
    .toBeGreaterThan(1);
  const frames = await result.evaluate(async (video: HTMLVideoElement) => {
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext('2d')!;
    const frames = [];
    for (const time of [0.02, 0.85]) {
      const seeked = new Promise<void>((resolve) => {
        video.addEventListener('seeked', () => resolve(), { once: true });
      });
      video.currentTime = time;
      await seeked;
      context.drawImage(video, 0, 0);
      frames.push(
        [48, 74, 92].map((x) =>
          Array.from(context.getImageData(x, 32, 1, 1).data.slice(0, 3))
        )
      );
    }
    return frames;
  });
  expect(Math.max(...frames[0].flat())).toBeLessThan(10);
  frames[1].forEach((rgb, index) => {
    rgb.forEach((channel, component) => {
      expect(Math.abs(channel - preview[index][component])).toBeLessThan(12);
    });
  });
});

test('Clip slide and inverted mask preserve transparency in exported GIF frames', async ({
  page
}) => {
  await page.goto('/video/workspace?format=gif');
  await importEffectPicture(page);
  await page.getByLabel('蒙版形状').selectOption('ellipse');
  await page.getByLabel('反转蒙版').check();
  await page.getByLabel('动画效果').selectOption('slideFromLeft');
  await page.getByRole('button', { name: '导出', exact: true }).click();
  await page.getByRole('button', { name: '开始导出', exact: true }).click();
  const download = page.getByRole('button', { name: '下载文件', exact: true });
  await expect(download.or(page.getByRole('alert'))).toBeVisible({
    timeout: 30000
  });
  await expect(download).toBeVisible({ timeout: 1000 });
  const saved = page.waitForEvent('download');
  await download.click();
  const gif = new GifReader(await readFile((await (await saved).path())!));
  expect([gif.width, gif.height]).toEqual([96, 64]);
  const frame = new Uint8Array(gif.width * gif.height * 4);
  gif.decodeAndBlitFrameRGBA(0, frame);
  expect(frame.some((channel) => channel !== 0)).toBe(false);

  const alpha = (x: number, y: number) => frame[(y * gif.width + x) * 4 + 3];
  for (let index = 1; index < gif.numFrames(); index++) {
    if (gif.frameInfo(index - 1).disposal === 2) {
      const { x, y, width, height } = gif.frameInfo(index - 1);
      for (let row = y; row < y + height; row++) {
        frame.fill(
          0,
          (row * gif.width + x) * 4,
          (row * gif.width + x + width) * 4
        );
      }
    }
    gif.decodeAndBlitFrameRGBA(index, frame);
  }
  expect(alpha(4, 4)).toBe(0);
  expect(alpha(48, 32)).toBe(0);
  expect(alpha(88, 8)).toBe(255);
});

test('Editor export routes produce GIF and extracted audio files', async ({
  page
}) => {
  test.setTimeout(120000);
  await page.goto('/video/workspace?panel=export&format=gif');
  await page.getByLabel('导入视频或图片素材').setInputFiles(videoWithAudio);
  await expect(page.getByLabel('导出格式')).toHaveValue('gif');
  await expect(
    page.getByRole('combobox', { name: '帧率', exact: true })
  ).toBeVisible();
  const start = page.getByRole('button', { name: '开始导出', exact: true });
  const download = page.getByRole('button', { name: '下载文件', exact: true });
  await start.click();
  await expect(download).toBeVisible({ timeout: 30000 });
  await expect(page.getByAltText('导出的 GIF')).toBeVisible();
  const gifSaved = page.waitForEvent('download');
  await download.click();
  const gif = await gifSaved;
  expect((await readFile((await gif.path())!)).subarray(0, 6).toString()).toBe(
    'GIF89a'
  );
  await page.goto('/audio/extract-audio');
  await page.getByLabel('导入视频或图片素材').setInputFiles(videoWithAudio);
  await expect(page.getByLabel('导出格式')).toHaveValue('mp3');
  await expect(page.getByLabel('输出分辨率')).toHaveCount(0);
  await page.getByLabel('导出格式').selectOption('wav');
  await start.click();
  await expect(download).toBeVisible({ timeout: 30000 });
  const wavSaved = page.waitForEvent('download');
  await download.click();
  const wav = await wavSaved;
  const bytes = await readFile((await wav.path())!);
  expect(bytes.subarray(0, 4).toString()).toBe('RIFF');
  const data = bytes.indexOf('data') + 8;
  expect(Math.abs(bytes.readInt16LE(data + 1200))).toBeGreaterThan(100);
});

test('A transparent GIF can be scrubbed, sped up, and exported from its old link', async ({
  page
}) => {
  const bytes = Buffer.alloc(1024);
  const writer = new GifWriter(bytes, 7, 5, {
    palette: [0, 0xee2200, 0x2244ff, 0x55ee33],
    loop: 0
  });
  for (const [color, delay] of [
    [1, 40],
    [2, 60]
  ]) {
    const pixels = Array.from({ length: 35 }, (_, index) =>
      index % 7 === 0 ? 0 : color
    );
    writer.addFrame(0, 0, 7, 5, pixels, { delay, transparent: 0, disposal: 2 });
  }
  await page.goto('/gif/change-speed');
  await expect(page).toHaveURL(/\/video\/workspace\?panel=clip&format=gif$/);
  await page.getByLabel('导入视频或图片素材').setInputFiles({
    name: 'motion.gif',
    mimeType: 'image/gif',
    buffer: bytes.subarray(0, writer.end())
  });
  await expect(page.locator('.vw-clip')).toHaveCount(1);
  const screen = page.getByLabel('时间线画面');
  const channel = (channel: number) =>
    screen.evaluate(
      (canvas: HTMLCanvasElement, channel) =>
        canvas.getContext('2d')!.getImageData(3, 2, 1, 1).data[channel],
      channel
    );
  await expect.poll(() => channel(0)).toBeGreaterThan(200);
  const gifWorkers = () =>
    page.workers().filter((worker) => worker.url().includes('gif-preview'))
      .length;
  await expect.poll(gifWorkers).toBe(1);
  await screen.click();
  await page.keyboard.press('End');
  await expect.poll(() => channel(2)).toBeGreaterThan(200);
  await page.keyboard.press('Home');
  await expect.poll(() => channel(0)).toBeGreaterThan(200);
  await page.getByLabel('播放速度').selectOption('2');
  await page.getByRole('button', { name: '导出', exact: true }).click();
  await expect(page.getByLabel('导出格式')).toHaveValue('gif');
  await page
    .getByRole('combobox', { name: '帧率', exact: true })
    .selectOption('10');
  await page.getByRole('button', { name: '开始导出', exact: true }).click();
  const download = page.getByRole('button', { name: '下载文件' });
  await expect(download.or(page.getByRole('alert'))).toBeVisible({
    timeout: 30000
  });
  await expect(download).toBeVisible();
  const saved = page.waitForEvent('download');
  await download.click();
  const gif = new GifReader(await readFile((await (await saved).path())!));
  expect([gif.width, gif.height]).toEqual([7, 5]);
  const totalDelay = Array.from(
    { length: gif.numFrames() },
    (_, index) => gif.frameInfo(index).delay
  ).reduce((sum, delay) => sum + delay, 0);
  expect(totalDelay).toBe(50);
  const first = new Uint8Array(7 * 5 * 4);
  const last = new Uint8Array(first.length);
  gif.decodeAndBlitFrameRGBA(0, first);
  gif.decodeAndBlitFrameRGBA(gif.numFrames() - 1, last);
  expect(first[3]).toBe(0);
  expect(first[4]).toBeGreaterThan(200);
  expect(last[6]).toBeGreaterThan(200);

  await page.getByRole('button', { name: '关闭导出' }).click();
  await page.getByLabel('导入视频或图片素材').setInputFiles(silentVideo);
  await expect(page.locator('.vw-clip')).toHaveCount(2);
  await expect.poll(gifWorkers).toBe(0);
  await page.getByRole('button', { name: '导出', exact: true }).click();
  await page.getByLabel('导出格式').selectOption('mp4');
  await page.getByRole('button', { name: '开始导出', exact: true }).click();
  const combined = page.getByLabel('导出成片预览');
  await expect(combined.or(page.getByRole('alert'))).toBeVisible({
    timeout: 30000
  });
  await expect
    .poll(() => combined.evaluate((video: HTMLVideoElement) => video.duration))
    .toBeGreaterThan(1.45);
});

test('Static images animate in order and timeline shortcuts respect numeric fields', async ({
  page
}) => {
  await page.goto('/gif/images-to-gif');
  await expect(page).toHaveURL(
    /\/video\/workspace\?panel=clip&format=gif&preset=images$/
  );
  const pngs = await page.evaluate(() =>
    ['red', 'blue'].map((color) => {
      const canvas = document.createElement('canvas');
      canvas.width = 16;
      canvas.height = 12;
      const context = canvas.getContext('2d')!;
      context.fillStyle = color;
      context.fillRect(0, 0, canvas.width, canvas.height);
      return canvas.toDataURL().split(',')[1];
    })
  );
  await page.getByLabel('导入视频或图片素材').setInputFiles(
    pngs.map((png, index) => ({
      name: `picture-${index}.png`,
      mimeType: 'image/png',
      buffer: Buffer.from(png, 'base64')
    }))
  );
  const clips = page.locator('.vw-clip');
  await expect(clips).toHaveCount(2);
  const toolbar = page.getByRole('group', { name: '片段操作' });
  await expect(toolbar.getByRole('button', { name: '撤销' })).toBeEnabled();
  await expect(
    page.locator('.vw-toolbar').getByRole('button', { name: '撤销' })
  ).toHaveCount(0);
  const duration = page.getByLabel('图片停留（秒）');
  await duration.fill('0.4');
  await duration.press('Control+z');
  await expect(clips).toHaveCount(2);
  await duration.fill('0.3');
  await duration.press('Enter');
  await page.getByRole('button', { name: '应用到所有静态图片' }).click();
  await expect(clips.last()).toContainText('00:00.30');
  const screen = page.getByLabel('时间线画面');
  await screen.click();
  await page.keyboard.press('Control+d');
  await expect(clips).toHaveCount(3);
  await page.keyboard.press('Control+z');
  await expect(clips).toHaveCount(2);
  await page.keyboard.press('Control+c');
  await page.keyboard.press('Control+v');
  await expect(clips).toHaveCount(3);
  await page.keyboard.press('Control+z');
  await expect(clips).toHaveCount(2);
  await page.keyboard.press('Control+y');
  await expect(clips).toHaveCount(3);
  await page.keyboard.press('Delete');
  await expect(clips).toHaveCount(2);
  await page.keyboard.press('Meta+z');
  await expect(clips).toHaveCount(3);
  await page.keyboard.press('Meta+Shift+z');
  await expect(clips).toHaveCount(2);
  await page.keyboard.press('Home');
  for (let i = 0; i < 4; i++) await page.keyboard.press('ArrowRight');
  await page.keyboard.press('s');
  await expect(clips).toHaveCount(3);
  await page.keyboard.press('Control+z');
  await page.keyboard.press('Home');
  await page.keyboard.press('Space');
  await expect(page.getByRole('button', { name: '暂停' })).toBeVisible();
  await expect(
    page.getByRole('button', { name: '播放', exact: true })
  ).toBeVisible();
  await expect(
    page.getByRole('slider', { name: '时间线播放位置' })
  ).toHaveAttribute('aria-valuetext', '00:00.60');
  await page.getByRole('button', { name: '导出', exact: true }).click();
  await expect(page.getByLabel('导出格式')).toHaveValue('gif');
  await page.getByRole('button', { name: '开始导出', exact: true }).click();
  const download = page.getByRole('button', { name: '下载文件' });
  await expect(download.or(page.getByRole('alert'))).toBeVisible({
    timeout: 30000
  });
  await expect(download).toBeVisible();
  const saved = page.waitForEvent('download');
  await download.click();
  const gif = new GifReader(await readFile((await (await saved).path())!));
  const frame = new Uint8Array(16 * 12 * 4);
  gif.decodeAndBlitFrameRGBA(0, frame);
  expect(frame[0]).toBeGreaterThan(240);
  for (let index = 1; index < gif.numFrames(); index++)
    gif.decodeAndBlitFrameRGBA(index, frame);
  expect(frame[2]).toBeGreaterThan(240);
});

test('Video templates share framing between the editable preview and MP4 export', async ({
  page
}) => {
  await page.goto('/video/workspace');
  const openTemplates = page.getByRole('button', { name: '剪辑模板' });
  const templates = page.getByRole('dialog', { name: '剪辑模板' });
  const apply = templates.getByRole('button', { name: '应用模板' });
  await openTemplates.click();
  await expect(templates.getByRole('radio')).toHaveCount(6);
  await templates.getByText('竖屏短视频', { exact: true }).click();
  await expect(templates.getByLabel('素材适配')).toHaveValue('cover');
  await page.screenshot({
    path: '.tmp/screenshots/video-templates-desktop.png',
    animations: 'disabled'
  });
  await apply.click();

  await page.getByLabel('导入视频或图片素材').setInputFiles(silentVideo);
  await expect(page.locator('.vw-clip')).toHaveCount(1);
  const screen = page.getByLabel('时间线画面');
  const topEdge = () =>
    screen.evaluate(
      (canvas: HTMLCanvasElement) =>
        canvas.getContext('2d')!.getImageData(canvas.width / 2, 2, 1, 1).data[2]
    );
  await expect.poll(topEdge).toBeGreaterThan(100);
  await expect(page.getByText('1080 × 1920', { exact: true })).toBeVisible();

  const showExport = page.getByRole('button', { name: '导出', exact: true });
  await showExport.click();
  await expect(page.getByLabel('导出格式')).toHaveValue('mp4');
  await page.getByLabel('输出分辨率').selectOption('720');
  await expect(
    page.getByText('9:16 · 720 × 1280 px', { exact: true })
  ).toBeVisible();
  await page.getByRole('button', { name: '开始导出' }).click();
  const output = page.getByLabel('导出成片预览');
  await expect(output.or(page.getByRole('alert'))).toBeVisible({
    timeout: 30000
  });
  await expect(output).toBeVisible();
  await expect
    .poll(() =>
      output.evaluate((video: HTMLVideoElement) => {
        if (video.readyState < 2) return null;
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = 1;
        const context = canvas.getContext('2d')!;
        context.drawImage(video, video.videoWidth / 2, 2, 1, 1, 0, 0, 1, 1);
        return [
          video.videoWidth,
          video.videoHeight,
          context.getImageData(0, 0, 1, 1).data[2] > 100
        ];
      })
    )
    .toEqual([720, 1280, true]);
  await page.getByRole('button', { name: '关闭导出' }).click();

  await openTemplates.click();
  await templates.getByLabel('素材适配').selectOption('contain');
  await apply.click();
  await expect.poll(topEdge).toBe(0);
  await page.getByRole('button', { name: '撤销', exact: true }).click();
  await expect.poll(topEdge).toBeGreaterThan(100);
  await expect(page.locator('.vw-clip')).toHaveCount(1);
  await openTemplates.click();
  await templates.getByText('方形动图', { exact: true }).click();
  await apply.click();
  await showExport.click();
  await expect(page.getByLabel('导出格式')).toHaveValue('gif');
  await expect(
    page.getByText('1:1 · 480 × 480 px', { exact: true })
  ).toBeVisible();
  await page.getByRole('button', { name: '开始导出' }).click();
  const download = page.getByRole('button', { name: '下载文件' });
  await expect(download.or(page.getByRole('alert'))).toBeVisible({
    timeout: 30000
  });
  await expect(download).toBeVisible();
  const saved = page.waitForEvent('download');
  await download.click();
  const gif = new GifReader(await readFile((await (await saved).path())!));
  expect([gif.width, gif.height]).toEqual([480, 480]);
});

test('On a phone, a template supplies the canvas and editable photo duration', async ({
  page
}) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/video/workspace');
  await page.getByRole('button', { name: '剪辑模板' }).click();
  const templates = page.getByRole('dialog', { name: '剪辑模板' });
  await templates.getByText('竖版图文', { exact: true }).click();
  await page.screenshot({
    path: '.tmp/screenshots/video-templates-mobile.png',
    animations: 'disabled'
  });
  await templates.getByRole('button', { name: '应用模板' }).click();
  const png = await page.evaluate(
    () => document.createElement('canvas').toDataURL().split(',')[1]
  );
  await page.getByLabel('导入视频或图片素材').setInputFiles({
    name: 'picture.png',
    mimeType: 'image/png',
    buffer: Buffer.from(png, 'base64')
  });
  await expect(page.locator('.vw-clip')).toHaveCount(1);
  await page.getByRole('button', { name: '打开片段设置' }).click();
  const duration = page
    .getByRole('dialog', { name: '片段设置' })
    .getByLabel('图片停留（秒）');
  await expect(duration).toHaveValue('3');
  await duration.fill('1.5');
  await duration.press('Enter');
  await page.keyboard.press('Escape');
  await expect(page.locator('.vw-clip')).toContainText('00:01.50');
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth
    )
  ).toBe(true);
});

test('Relinks a readable Jianying draft, preserves timing and canvas, and applies it as one undoable edit', async ({
  page
}) => {
  await page.goto('/video/workspace');
  const media = page.getByLabel('导入视频或图片素材');
  await media.setInputFiles(silentVideo);
  await expect(page.locator('.vw-clip')).toHaveCount(1);
  await page.getByRole('button', { name: '剪辑模板' }).click();
  await page.getByRole('button', { name: '导入剪映草稿' }).click();
  const dialog = page.getByRole('dialog', { name: '导入剪映草稿' });
  const draftInput = dialog.getByLabel('剪映草稿或模板文件');
  await draftInput.setInputFiles({
    name: 'draft_content.json',
    mimeType: 'application/json',
    buffer: Buffer.from('unreadable')
  });
  await expect(dialog.getByRole('alert')).toContainText('明文 template.json');
  const range = (start: number, duration: number) => ({ start, duration });
  const draft = {
    name: '草稿兼容测试',
    canvas_config: { width: 320, height: 240 },
    fps: 25,
    materials: {
      videos: [
        { id: 'v1', path: 'C:\\Media\\blue-silent.webm' },
        { id: 'v2', path: 'C:\\Media\\second-original.webm' }
      ],
      audios: [{ id: 'a1', path: '/Music/配乐.wav' }],
      transitions: [{ id: 'transition' }]
    },
    tracks: [
      {
        type: 'video',
        segments: [
          {
            material_id: 'v2',
            target_timerange: range(300000, 400000),
            source_timerange: range(100000, 400000)
          },
          {
            material_id: 'v1',
            target_timerange: range(0, 200000),
            source_timerange: range(100000, 400000),
            clip: { rotation: 90, flip: { horizontal: true } }
          }
        ]
      },
      {
        type: 'audio',
        segments: [
          {
            material_id: 'a1',
            target_timerange: range(100000, 500000),
            source_timerange: range(0, 500000),
            volume: 0.25
          }
        ]
      },
      { type: 'text', segments: [{ material_id: 'subtitle' }] }
    ]
  };
  await draftInput.setInputFiles({
    name: 'template.json.bak',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(draft))
  });
  await expect(dialog.getByText('草稿兼容测试')).toBeVisible();
  await expect(dialog.getByText(/25 fps/)).toBeVisible();
  await expect(dialog.getByText(/主轨间隙保留/)).toBeVisible();
  await expect(dialog.getByText(/字幕.*未导入/)).toBeVisible();
  const apply = dialog.getByRole('button', { name: '应用剪映草稿' });
  await expect(apply).toBeDisabled();
  const video = {
    name: 'blue-silent.webm',
    mimeType: 'video/webm',
    buffer: await readFile(silentVideo)
  };
  await dialog.getByLabel('关联本地素材').setInputFiles([video, music()]);
  await expect(dialog.getByText(/已关联 2 \/ 3/)).toBeVisible();
  await dialog
    .getByLabel('关联 second-original.webm')
    .setInputFiles(videoWithAudio);
  await expect(apply).toBeEnabled();
  await page.screenshot({
    path: '.tmp/screenshots/video-jianying-import.png',
    animations: 'disabled'
  });
  await apply.click();
  await expect(dialog).toHaveCount(0);
  const clips = page.locator('.vw-clip');
  await expect(clips).toHaveCount(3);
  await expect(clips.nth(1)).toContainText('空白画面.png');
  await expect(page.locator('.vw-audio-clip')).toBeVisible();
  await expect(page.getByLabel('播放速度')).toHaveValue('2');
  await expect(page.getByText('320 × 240', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '导出', exact: true }).click();
  await page.getByRole('button', { name: '开始导出' }).click();
  const output = page.getByLabel('导出成片预览');
  await expect(output.or(page.getByRole('alert'))).toBeVisible({
    timeout: 30000
  });
  await expect
    .poll(() =>
      output.evaluate((video: HTMLVideoElement) => [
        video.videoWidth,
        video.videoHeight
      ])
    )
    .toEqual([320, 240]);
  const duration = await output.evaluate(
    (video: HTMLVideoElement) => video.duration
  );
  expect(duration).toBeGreaterThan(0.65);
  expect(duration).toBeLessThan(0.78);
  await page.getByRole('button', { name: '关闭导出' }).click();
  await page.getByRole('button', { name: '撤销', exact: true }).click();
  await expect(clips).toHaveCount(1);
});

test('Queued exports can be cancelled without starting FFmpeg and retried once the lock is free', async ({
  page
}) => {
  await page.addInitScript(() => {
    const read = Blob.prototype.arrayBuffer;
    Blob.prototype.arrayBuffer = function () {
      if (this instanceof File && this.name === 'blue-silent.webm')
        throw new Error(
          'Original video should be mounted, not read into page memory.'
        );
      return read.call(this);
    };
  });
  const requests: string[] = [];
  page.on('request', (request) => requests.push(request.url()));
  await page.goto('/video/workspace');
  await page.getByLabel('导入视频或图片素材').setInputFiles(silentVideo);
  await expect(page.locator('.vw-clip')).toHaveCount(1);
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        void navigator.locks.request(
          'xftools-video-export',
          () =>
            new Promise<void>((release) => {
              window.addEventListener('release-test-export', () => release(), {
                once: true
              });
              resolve();
            })
        );
      })
  );
  await page.getByRole('button', { name: '导出', exact: true }).click();
  const start = page.getByRole('button', { name: '开始导出' });
  await start.click();
  await expect(page.getByText('正在等待其他视频导出…')).toBeVisible();
  expect(requests.some((url) => /ffmpeg-core.*\.wasm/.test(url))).toBe(false);
  await page.getByRole('button', { name: '取消导出' }).click();
  await expect(page.getByRole('alert')).toHaveText(/已取消导出/);
  await expect(start).toBeEnabled();
  expect(requests.some((url) => /ffmpeg-core.*\.wasm/.test(url))).toBe(false);
  await page.evaluate(() =>
    window.dispatchEvent(new Event('release-test-export'))
  );
  await start.click();
  await expect(page.getByRole('button', { name: '下载文件' })).toBeVisible({
    timeout: 30000
  });
  await expect
    .poll(
      () =>
        page.workers().filter((worker) => worker.url().includes('/worker-'))
          .length
    )
    .toBe(0);
});

test('A longer GIF export completes in both passes and releases its worker', async ({
  page
}) => {
  await page.goto('/video/workspace');
  await page.getByLabel('导入视频或图片素材').setInputFiles(silentVideo);
  await expect(page.locator('.vw-clip')).toHaveCount(1);
  const duplicate = page.getByRole('button', { name: '复制片段', exact: true });
  for (let index = 0; index < 14; index++) await duplicate.click();
  await expect(page.locator('.vw-clip')).toHaveCount(15);
  await page.getByRole('button', { name: '剪辑模板' }).click();
  await page.getByText('方形动图', { exact: true }).click();
  await page.getByRole('button', { name: '应用模板' }).click();
  await page.getByRole('button', { name: '导出', exact: true }).click();
  await page.getByRole('button', { name: '开始导出' }).click();
  const download = page.getByRole('button', { name: '下载文件' });
  await expect(download.or(page.getByRole('alert'))).toBeVisible({
    timeout: 45000
  });
  await expect(download).toBeVisible();
  const saved = page.waitForEvent('download');
  await download.click();
  const gif = new GifReader(await readFile((await (await saved).path())!));
  expect([gif.width, gif.height]).toEqual([480, 480]);
  const duration =
    Array.from(
      { length: gif.numFrames() },
      (_, index) => gif.frameInfo(index).delay
    ).reduce((total, delay) => total + delay, 0) / 100;
  expect(duration).toBeGreaterThan(15);
  expect(duration).toBeLessThan(17);
  await expect.poll(() => page.workers().length).toBe(0);
});
