import { expect, test } from '@playwright/test';
import { Buffer } from 'buffer';
import path from 'path';
import { Jimp } from 'jimp';

test.describe('Convert JPG to PNG tool', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/png/convert-jgp-to-png');
  });

  test('should convert jpg to png', async ({ page }) => {
    // Upload image
    const fileInput = page.locator('input[type="file"]');
    const imagePath = path.join(__dirname, 'test.jpg');
    await fileInput?.setInputFiles(imagePath);
    await page.getByTestId('process-tool').click();

    // Click on download
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: '下载', exact: true }).click();

    // Intercept and read downloaded PNG
    const download = await downloadPromise;
    const downloadStream = await download.createReadStream();

    const chunks = [];
    for await (const chunk of downloadStream) {
      chunks.push(chunk);
    }
    const fileContent = Buffer.concat(chunks);

    expect(fileContent.length).toBeGreaterThan(0);

    // Check that the first pixel is 0x808080ff
    const image = await Jimp.read(fileContent);
    const color = image.getPixelColor(0, 0);
    expect(color).toBe(0x808080ff);
  });

  test('should apply transparency before converting jpg to png', async ({
    page
  }) => {
    // Upload image
    const fileInput = page.locator('input[type="file"]');
    const imagePath = path.join(__dirname, 'test.jpg');
    await fileInput?.setInputFiles(imagePath);

    // Enable transparency on color 0x808080
    await page
      .getByRole('checkbox', { name: '启用 PNG 透明度', exact: true })
      .check();
    await page.getByTestId('color-input').fill('#808080');
    await page.getByTestId('process-tool').click();

    // Click on download
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: '下载', exact: true }).click();

    // Intercept and read downloaded PNG
    const download = await downloadPromise;
    const downloadStream = await download.createReadStream();

    const chunks = [];
    for await (const chunk of downloadStream) {
      chunks.push(chunk);
    }
    const fileContent = Buffer.concat(chunks);

    expect(fileContent.length).toBeGreaterThan(0);

    // Check that the first pixel is transparent
    const image = await Jimp.read(fileContent);
    const color = image.getPixelColor(0, 0);
    expect(color).toBe(0);
  });
});
