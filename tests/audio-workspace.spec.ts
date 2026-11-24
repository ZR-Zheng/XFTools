import { readFile } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';

test.use({ actionTimeout: 10000 });

function tone(
  name: string,
  duration: number,
  frequency: number,
  amplitude: number,
  envelope: (time: number) => number = () => 1
) {
  const rate = 8000;
  const samples = Math.round(duration * rate);
  const wave = Buffer.alloc(44 + samples * 2);
  wave.write('RIFF');
  wave.writeUInt32LE(wave.length - 8, 4);
  wave.write('WAVEfmt ', 8);
  wave.writeUInt32LE(16, 16);
  wave.writeUInt16LE(1, 20);
  wave.writeUInt16LE(1, 22);
  wave.writeUInt32LE(rate, 24);
  wave.writeUInt32LE(rate * 2, 28);
  wave.writeUInt16LE(2, 32);
  wave.writeUInt16LE(16, 34);
  wave.write('data', 36);
  wave.writeUInt32LE(samples * 2, 40);
  for (let index = 0; index < samples; index++)
    wave.writeInt16LE(
      Math.round(
        Math.sin((index * frequency * Math.PI * 2) / rate) *
          amplitude *
          envelope(index / rate)
      ),
      44 + index * 2
    );
  return { name, mimeType: 'audio/wav', buffer: wave };
}

async function field(page: Page, name: string, value: string) {
  const control = page
    .getByLabel(name, { exact: true })
    .filter({ visible: true });
  await control.fill(value);
  await control.press('Enter');
}

test('Audio waveform selections support editing, history and a phone inspector', async ({
  page
}) => {
  const requests: string[] = [];
  page.on('request', (request) => requests.push(request.url()));
  await page.goto('/audio/merge-audio');
  await expect(page).toHaveURL(/\/audio\/workspace\?panel=clip$/);
  await page
    .getByLabel('导入音频素材')
    .setInputFiles([
      tone(
        '主旋律.wav',
        2,
        440,
        20000,
        (time) => 0.18 + 0.65 * Math.pow(Math.sin(time * 9), 4)
      ),
      tone('合成器.wav', 1, 660, 18000, (time) => Math.exp(-3 * (time % 0.25)))
    ]);
  await expect(page.locator('.aw-lane-main .audio-waveform.ready')).toHaveCount(
    2
  );
  await page
    .getByLabel('导入混音音频')
    .setInputFiles(
      tone(
        '氛围铺底.wav',
        2.1,
        165,
        13500,
        (time) => 0.25 + 0.65 * Math.sin(time * 2.4) ** 2
      )
    );
  await expect(
    page.locator('.aw-lane-mix .audio-waveform.ready')
  ).toBeVisible();
  const lane = page.getByLabel('剪辑轨波形');
  const bounds = (await lane.boundingBox())!;
  await page.mouse.move(bounds.x + bounds.width * 0.2, bounds.y + 50);
  await page.mouse.down();
  await page.mouse.move(bounds.x + bounds.width * 0.72, bounds.y + 50, {
    steps: 4
  });
  await page.mouse.up();
  await expect(page.locator('.aw-range')).toBeVisible();
  await page.screenshot({
    path: '.tmp/screenshots/audio-workspace-desktop.png',
    animations: 'disabled'
  });
  await page.getByRole('button', { name: '保留选区' }).click();
  expect(
    Number(await page.getByLabel('结束时间（秒）').inputValue())
  ).toBeLessThan(2.01);
  await page.keyboard.press('Control+z');
  await expect(page.getByLabel('播放头时间')).toContainText('/ 00:03.000');
  await field(page, '播放位置（秒）', '1');
  await page.getByRole('button', { name: '分割', exact: true }).click();
  await expect(page.locator('.aw-lane-main .aw-region')).toHaveCount(3);
  await page.getByRole('button', { name: '前移片段' }).click();
  await page.getByRole('button', { name: '循环', exact: true }).click();
  await page.getByRole('button', { name: '应用循环' }).click();
  await expect(page.locator('.aw-lane-main .aw-region')).toHaveCount(4);
  expect(requests.some((url) => /ffmpeg-core|\.wasm/.test(url))).toBe(false);
  await page.setViewportSize({ width: 375, height: 812 });
  await page.getByRole('button', { name: '打开片段参数' }).click();
  const drawer = page.getByRole('dialog', { name: '片段参数' });
  await expect(drawer).toBeVisible();
  await drawer.getByRole('button', { name: '处理', exact: true }).click();
  await expect(drawer.getByLabel('淡入（秒）')).toBeVisible();
  await page.screenshot({
    path: '.tmp/screenshots/audio-workspace-mobile.png',
    animations: 'disabled'
  });
  await page.keyboard.press('Escape');
  await expect(drawer).toHaveCount(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth
    )
  ).toBe(true);
});

test('Exports a trimmed and faded clip with a delayed mix as a real WAV file', async ({
  page
}) => {
  await page.goto('/audio/change-speed');
  await expect(page).toHaveURL(/\/audio\/workspace\?panel=effects$/);
  await page
    .getByLabel('导入音频素材')
    .setInputFiles(tone('旋律.wav', 2, 440, 15000));
  await page.getByRole('combobox', { name: '播放速度' }).selectOption('2');
  await field(page, '淡入（秒）', '0.3');
  await field(page, '淡出（秒）', '0.1');
  await page
    .getByLabel('导入混音音频')
    .setInputFiles(tone('混音.wav', 0.5, 660, 15000));
  await expect(
    page.locator('.aw-lane-mix .audio-waveform.ready')
  ).toBeVisible();
  await page.getByRole('button', { name: '片段', exact: true }).click();
  await field(page, '混音起点（秒）', '0.35');
  await page.getByRole('button', { name: '导出', exact: true }).click();
  await page.getByRole('combobox', { name: '导出格式' }).selectOption('wav');
  await page.getByRole('combobox', { name: '声道' }).selectOption('1');
  await page.getByRole('button', { name: '开始导出' }).click();
  const download = page.getByRole('button', { name: '下载音频' });
  await expect(download.or(page.getByRole('alert'))).toBeVisible({
    timeout: 30000
  });
  await expect(download).toBeVisible();
  const saved = page.waitForEvent('download');
  await download.click();
  const file = await saved;
  const bytes = await readFile((await file.path())!);
  expect(file.suggestedFilename()).toBe('旋律-edited.wav');
  expect(bytes.subarray(0, 4).toString()).toBe('RIFF');
  expect(bytes.readUInt32LE(24)).toBe(44100);
  expect(bytes.readUInt16LE(22)).toBe(1);
  const dataStart = bytes.indexOf('data') + 8;
  expect((bytes.length - dataStart) / 88200).toBeCloseTo(1, 2);
  const rms = (start: number, end: number) => {
    let sum = 0;
    const first = Math.round(start * 44100);
    const last = Math.round(end * 44100);
    for (let i = first; i < last; i++)
      sum += bytes.readInt16LE(dataStart + i * 2) ** 2;
    return Math.sqrt(sum / (last - first));
  };
  expect(rms(0.02, 0.08)).toBeLessThan(rms(0.4, 0.5) / 3);
  expect(rms(0.4, 0.5)).toBeGreaterThan(rms(0.27, 0.33) * 1.2);
  await expect.poll(() => page.workers().length).toBe(0);
});

test('The export preset opens shared export for the uploaded asset', async ({
  page
}) => {
  await page.goto('/audio/workspace?panel=export');
  await page
    .getByLabel('导入音频素材')
    .setInputFiles(tone('转换.wav', 0.7, 330, 8000));
  const dialog = page.getByRole('dialog', { name: '导出音频' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('combobox', { name: '导出格式' })).toHaveValue(
    'mp3'
  );
  const download = dialog.getByRole('button', { name: '下载音频' });
  for (const format of ['mp3', 'aac', 'ogg', 'flac']) {
    await dialog
      .getByRole('combobox', { name: '导出格式' })
      .selectOption(format);
    await dialog.getByRole('button', { name: '开始导出' }).click();
    await expect(download.or(dialog.getByRole('alert'))).toBeVisible({
      timeout: 30000
    });
    await expect(download).toBeVisible();
    const saved = page.waitForEvent('download');
    await download.click();
    const result = await saved;
    const bytes = await readFile((await result.path())!);
    expect(result.suggestedFilename()).toBe(`转换-edited.${format}`);
    if (format === 'aac') expect(bytes.readUInt16BE(0) & 0xfff0).toBe(0xfff0);
    else
      expect(bytes.subarray(0, format === 'mp3' ? 3 : 4).toString()).toBe(
        format === 'mp3' ? 'ID3' : format === 'ogg' ? 'OggS' : 'fLaC'
      );
  }
});
