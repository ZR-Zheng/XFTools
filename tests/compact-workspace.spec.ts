import { expect, test } from '@playwright/test';
import { PDFDocument, rgb } from 'pdf-lib';

test('PDF header keeps file actions beside the title and the canvas fills the remaining viewport', async ({
  page
}) => {
  const errors: string[] = [],
    wasmRequests: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('request', (request) => {
    if (request.url().includes('.wasm')) wasmRequests.push(request.url());
  });
  await page.goto('/pdf/editor');
  await expect(page.locator('.pdf-document-empty')).toBeVisible();
  const header = page.locator('.tool-page-header');
  await expect(
    header.getByRole('button', { name: '上传 PDF', exact: true })
  ).toBeVisible();
  expect((await header.boundingBox())!.height).toBeLessThan(110);
  const doc = await PDFDocument.create(),
    first = doc.addPage([500, 700]);
  first.drawRectangle({
    x: 40,
    y: 490,
    width: 420,
    height: 160,
    color: rgb(0.16, 0.37, 0.9)
  });
  first.drawText('XFTools document workspace', { x: 50, y: 430, size: 20 });
  await page
    .locator('input[type=file]')
    .setInputFiles({
      name: 'preview.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from(await doc.save())
    });
  await expect(header).toContainText('preview.pdf');
  await expect(
    header.getByRole('button', { name: '清空输入', exact: true })
  ).toBeEnabled();
  const stage = page.locator('.pdf-document-workbench');
  for (const width of [1440, 1024, 768, 375]) {
    await page.setViewportSize({ width, height: 900 });
    await expect
      .poll(async () => {
        const box = (await stage.boundingBox())!;
        return Math.abs(900 - 16 - box.y - box.height);
      })
      .toBeLessThan(2);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth
      )
    ).toBe(true);
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(
    page
      .locator('.pdf-document-viewer')
      .getByText('文件加载中...', { exact: true })
  ).not.toBeVisible({ timeout: 20000 });
  await expect
    .poll(async () =>
      page
        .locator('.pdf-document-viewer img')
        .last()
        .evaluate((image: HTMLImageElement) => image.naturalWidth)
    )
    .toBeGreaterThan(100);
  await expect.poll(() => wasmRequests.length).toBeGreaterThan(0);
  expect(
    wasmRequests.every((url) => url.startsWith('http://127.0.0.1:4173/'))
  ).toBe(true);
  await page.screenshot({ path: '.tmp/screenshots/compact-pdf-verified.png' });
  await header.getByRole('button', { name: '清空输入', exact: true }).click();
  await expect(page.locator('.pdf-document-empty')).toBeVisible();
  await expect(
    header.getByRole('button', { name: '清空输入', exact: true })
  ).toBeDisabled();
  expect(errors).toEqual([]);
});

test('Header actions load examples and reset text options', async ({
  page
}) => {
  await page.goto('/string/split');
  const header = page.locator('.tool-page-header');
  await header.getByRole('button', { name: '载入示例', exact: true }).click();
  await expect(page.getByTestId('text-input')).toHaveValue(
    /^1 - eins, 2 - zwei/
  );
  const result = page.getByTestId('text-result');
  await expect(result).toHaveValue(/^1 - eins\n 2 - zwei/);
  await page.getByTestId('text-input').fill('one two,three');
  await expect(result).toHaveValue('one two\nthree');
  await header.getByRole('button', { name: '重置参数', exact: true }).click();
  await expect(result).toHaveValue('one\\ntwo,three');
});
