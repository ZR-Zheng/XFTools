import { expect, test } from '@playwright/test';
import { PDFDocument, rgb } from 'pdf-lib';
import { readFile } from 'node:fs/promises';

async function pdfFile(name: string, widths: number[]) {
  const document = await PDFDocument.create();
  widths.forEach((width, index) => {
    const page = document.addPage([width, 300]);
    page.drawRectangle({
      x: 8,
      y: 190,
      width: width - 16,
      height: 100,
      color: rgb(0.17, 0.37, 0.9)
    });
    page.drawText(`${name} / ${index + 1}`, { x: 10, y: 160, size: 12 });
  });
  return {
    name,
    mimeType: 'application/pdf',
    buffer: Buffer.from(await document.save())
  };
}

test('PDF workspace previews and exports interleaved pages with undo and output invalidation', async ({
  page
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/pdf/merge-pdf');
  await page
    .locator('input[type=file]')
    .setInputFiles([
      await pdfFile('a.pdf', [100, 200]),
      await pdfFile('b.pdf', [400])
    ]);
  await expect(page.getByTestId('process-tool')).toBeEnabled();
  await expect(page.locator('.pdf-source-thumb canvas').first()).toBeVisible();
  await page
    .getByRole('button', { name: '预览全部页面', exact: true })
    .first()
    .click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.locator('canvas')).toBeVisible();
  await dialog.getByRole('button', { name: '下一页', exact: true }).click();
  await expect(dialog.locator('footer')).toContainText('2 / 2');
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
  await page.getByRole('button', { name: /^页面 / }).click();
  await page
    .getByRole('checkbox', { name: '选择第 3 页', exact: true })
    .check();
  await page.getByRole('button', { name: '前移', exact: true }).click();
  await page.getByRole('button', { name: '前移', exact: true }).click();
  await expect(page.locator('.pdf-page-caption').first()).toContainText(
    'b.pdf'
  );
  await page.getByRole('button', { name: '旋转 90°', exact: true }).click();
  await page.getByRole('button', { name: '复制页面', exact: true }).click();
  await expect(page.locator('.pdf-page')).toHaveCount(4);
  await page.getByRole('button', { name: '撤销', exact: true }).click();
  await expect(page.locator('.pdf-page')).toHaveCount(3);
  await page.getByRole('button', { name: '重做', exact: true }).click();
  await page
    .getByRole('button', { name: '插入 A4 空白页', exact: true })
    .click();
  await expect(page.locator('.pdf-page')).toHaveCount(5);
  await page.getByLabel('输出文件名', { exact: true }).fill('arranged.pdf');
  await page.getByTestId('process-tool').click();
  const save = page.getByRole('button', { name: '下载 PDF', exact: true });
  await expect(save).toBeEnabled();
  const download = page.waitForEvent('download');
  await save.click();
  const file = await download;
  expect(file.suggestedFilename()).toBe('arranged.pdf');
  const result = await PDFDocument.load(await readFile((await file.path())!));
  expect(result.getPages().map((page) => page.getWidth())).toEqual([
    400, 400, 100, 200, 595.28
  ]);
  expect(
    result
      .getPages()
      .slice(0, 2)
      .map((page) => page.getRotation().angle)
  ).toEqual([90, 90]);
  await page
    .getByRole('checkbox', { name: '选择第 1 页', exact: true })
    .check();
  await page.getByRole('button', { name: '删除页面', exact: true }).click();
  await expect(save).toBeDisabled();
  await page.evaluate(() => {
    (document.activeElement as HTMLElement)?.blur();
    window.scrollTo({ top: 0, behavior: 'instant' });
  });
  await page.screenshot({
    path: '.tmp/screenshots/pdf-merge-pages.png',
    fullPage: true
  });
  await page.setViewportSize({ width: 375, height: 812 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth
    )
  ).toBe(true);
  await page.screenshot({
    path: '.tmp/screenshots/pdf-merge-mobile.png',
    fullPage: true
  });
  expect(errors).toEqual([]);
});

test('Calculators solve either direction, convert units and keep material presets', async ({
  page
}) => {
  const errors: string[] = [],
    requests: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('request', (request) => requests.push(request.url()));
  await page.goto('/number/generic-calc/ohms-law');
  const result = page.getByTestId('calculation-result');
  await expect(result).toHaveText('5');
  await page.locator('#calc-V').fill('12');
  await page.locator('#calc-I').fill('2');
  await expect(result).toHaveText('6');
  await page
    .locator('.formula-variable')
    .filter({ has: page.locator('#calc-I') })
    .getByRole('combobox')
    .selectOption('mA');
  await expect(page.locator('#calc-I')).toHaveValue('2000');
  await expect(result).toHaveText('6');
  await page
    .getByRole('combobox', { name: '求解目标', exact: true })
    .selectOption('V');
  await expect(result).toHaveText('12');
  await page
    .getByRole('combobox', { name: '结果单位', exact: true })
    .selectOption('mV');
  await expect(result).toHaveText('12000');
  await page.locator('#calc-I').fill('');
  await expect(result).toHaveText('—');
  await expect(page.locator('.formula-error')).toContainText('请填写');
  await page.goto('/number/generic-calc/volume-sphere');
  await page.getByLabel('或输入直径').fill('10');
  await expect(page.locator('#calc-r')).toHaveValue('5');
  await expect(result).toHaveText('523.598775598');
  await page.goto('/number/generic-calc/cable-voltage-drop');
  await expect(result).not.toHaveText('—');
  await page.locator('#calc-L').fill('10');
  await page.locator('#calc-I').fill('4');
  await expect(result).not.toHaveText('—');
  await page.evaluate(() => {
    (document.activeElement as HTMLElement)?.blur();
    window.scrollTo({ top: 0, behavior: 'instant' });
  });
  await page.screenshot({
    path: '.tmp/screenshots/calculator-wire.png',
    fullPage: true
  });
  await page.setViewportSize({ width: 375, height: 812 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth
    )
  ).toBe(true);
  expect(requests.some((url) => /nerdamer/.test(url))).toBe(false);
  expect(errors).toEqual([]);
});

test('Transparent PNG exports true alpha and explicit background replacement invalidates downloads', async ({
  page
}) => {
  await page.goto('/image-generic/create-transparent');
  const encoded = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 2;
    canvas.height = 1;
    canvas
      .getContext('2d')!
      .putImageData(
        new ImageData(
          new Uint8ClampedArray([255, 255, 255, 255, 0, 0, 0, 128]),
          2,
          1
        ),
        0,
        0
      );
    return canvas.toDataURL('image/png').split(',')[1];
  });
  await page.locator('input[type=file]').setInputFiles({
    name: 'mask.png',
    mimeType: 'image/png',
    buffer: Buffer.from(encoded, 'base64')
  });
  await page.getByTestId('process-tool').click();
  const result = page.locator('.flow-result img');
  await expect(result).toBeVisible();
  const pixels = await result.evaluate(async (image: HTMLImageElement) => {
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = 2;
    canvas.height = 1;
    const context = canvas.getContext('2d')!;
    context.drawImage(image, 0, 0);
    return [...context.getImageData(0, 0, 2, 1).data];
  });
  expect(pixels[3]).toBe(0);
  expect(pixels[7]).toBe(128);
  await page
    .getByRole('radio', { name: '替换为背景颜色', exact: true })
    .check();
  await expect(
    page
      .locator('.flow-result')
      .getByRole('button', { name: '下载', exact: true })
  ).toBeDisabled();
});

test('PDF page pagination retains selection for cross-screen ordering', async ({
  page
}) => {
  await page.goto('/pdf/merge-pdf');
  await page.locator('input[type=file]').setInputFiles(
    await pdfFile(
      'many.pdf',
      Array.from({ length: 25 }, (_, i) => 100 + i)
    )
  );
  await page.getByRole('button', { name: /^页面 / }).click();
  await expect(page.locator('.pdf-page')).toHaveCount(24);
  await page
    .getByRole('checkbox', { name: '选择第 1 页', exact: true })
    .click();
  await page
    .getByRole('checkbox', { name: '选择第 3 页', exact: true })
    .click({ modifiers: ['Shift'] });
  await expect(page.locator('.pdf-page input:checked')).toHaveCount(3);
  await page.getByRole('button', { name: '取消选择', exact: true }).click();
  await page.getByRole('button', { name: '下一组', exact: true }).click();
  await expect(page.locator('.pdf-page')).toHaveCount(1);
  await page
    .getByRole('checkbox', { name: '选择第 25 页', exact: true })
    .check();
  await page.getByRole('button', { name: '移动', exact: true }).click();
  await page.getByRole('button', { name: '上一组', exact: true }).click();
  await expect(page.locator('.pdf-page-caption').first()).toContainText(
    '原第 25 页'
  );
});

test('PDF workspace preserves same-name sources, explains failed imports, and resets resources', async ({
  page
}) => {
  await page.goto('/pdf/merge-pdf');
  await page.locator('input[type=file]').setInputFiles([
    await pdfFile('same.pdf', [100]),
    await pdfFile('same.pdf', [200]),
    {
      name: 'broken.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('invalid')
    }
  ]);
  await expect(page.locator('.pdf-source')).toHaveCount(2);
  await expect(page.getByRole('alert')).toContainText('broken.pdf');
  await expect(page.getByTestId('process-tool')).toBeEnabled();
  await page.getByRole('button', { name: '清空', exact: true }).click();
  await expect(page.getByTestId('process-tool')).toBeDisabled();
  await expect(page.locator('.pdf-source')).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: '撤销', exact: true })
  ).toBeDisabled();
});

test('CSV conversions preserve multiline fields, identifiers and clear results on invalid input', async ({
  page
}) => {
  await page.goto('/csv/csv-to-json');
  await page
    .getByTestId('text-input')
    .fill('id,note,id\n001,"line one\nline two",9007199254740993');
  const result = page.getByTestId('text-result');
  await expect(result).toHaveValue(/line one/);
  expect(JSON.parse(await result.inputValue())).toEqual([
    { id: '001', note: 'line one\nline two', id_2: '9007199254740993' }
  ]);
  await page.getByTestId('text-input').fill('id,note\n1,"unterminated');
  await expect(page.getByRole('alert')).toContainText(/第 2 条记录/);
  await expect(result).toHaveValue('');
});

test('Chinese PDF workspace fits the simplified tablet layout', async ({
  page
}) => {
  await page.goto('/pdf/merge-pdf');
  await page.setViewportSize({ width: 768, height: 1024 });
  await expect(
    page.getByRole('button', { name: '合并 PDF', exact: true })
  ).toBeDisabled();
  await page
    .locator('input[type=file]')
    .setInputFiles(await pdfFile('sample.pdf', [200]));
  await expect(page.locator('.pdf-source-thumb canvas')).toBeVisible();
  expect(
    (await page
      .getByRole('button', { name: '合并 PDF', exact: true })
      .boundingBox())!.height
  ).toBeLessThan(64);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth
    )
  ).toBe(true);
  await page.screenshot({
    path: '.tmp/screenshots/pdf-merge-zh-tablet.png',
    fullPage: true
  });
});
