import { expect, test } from '@playwright/test';
import { PDFDocument, rgb } from 'pdf-lib';

test('PDF editor alias opens the annotation workspace at full viewport height', async ({
  page
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/pdf/editor');
  await expect(page).toHaveURL(/\/pdf\/workspace\?mode=editor$/);
  await expect(
    page.getByRole('complementary', { name: '批注', exact: true })
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: '打开 PDF', exact: true })
  ).toBeVisible();

  const doc = await PDFDocument.create();
  const first = doc.addPage([500, 700]);
  first.drawRectangle({
    x: 40,
    y: 490,
    width: 420,
    height: 160,
    color: rgb(0.16, 0.37, 0.9)
  });
  first.drawText('XFTools document workspace', { x: 50, y: 430, size: 20 });
  await page.locator('input[type=file]').setInputFiles({
    name: 'preview.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from(await doc.save())
  });
  await expect(page.locator('.pdf-document-label')).toContainText(
    'preview.pdf'
  );
  const reader = page.getByRole('region', { name: 'PDF 预览' });
  const layout = page.locator('.pdf-workbench-layout');
  await expect(reader.locator('canvas').first()).toBeVisible();
  for (const width of [1440, 1024, 768, 375]) {
    await page.setViewportSize({ width, height: 900 });
    await expect
      .poll(async () => {
        const box = (await layout.boundingBox())!;
        return Math.abs(900 - box.y - box.height);
      })
      .toBeLessThan(2);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth
      )
    ).toBe(true);
  }
  await expect(
    page
      .getByRole('complementary', { name: '页面缩略图' })
      .getByRole('button', { name: '预览输出第 1 页' })
  ).toBeVisible();
  const more = page.getByRole('button', { name: '更多工具', exact: true });
  await more.click();
  await page.getByRole('button', { name: '清空', exact: true }).click();
  await expect(more).toHaveAttribute('aria-expanded', 'false');
  await more.click();
  await expect(
    page.getByRole('button', { name: '清空', exact: true })
  ).toBeDisabled();
  await page.keyboard.press('Escape');
  await expect(more).toBeFocused();
  await expect(more).toHaveAttribute('aria-expanded', 'false');
  await expect(
    page.getByRole('button', { name: '选择文件', exact: true })
  ).toBeVisible();
  expect(errors).toEqual([]);
});

test('Header actions load examples and reset conversion options', async ({
  page
}) => {
  await page.goto('/time/discord-timestamp');
  const header = page.locator('.tool-page-header');
  await header.getByRole('button', { name: '载入示例', exact: true }).click();
  await expect(page.getByTestId('text-input')).toHaveValue(
    '2025-03-15T10:00:00'
  );
  const result = page.getByTestId('text-result');
  await expect(result).toHaveValue('<t:1742032800:F>');
  await page.getByRole('combobox').selectOption('R');
  await expect(result).toHaveValue('<t:1742032800:R>');
  await header.getByRole('button', { name: '重置参数', exact: true }).click();
  await expect(result).toHaveValue('<t:1742032800:F>');
});
