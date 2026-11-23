import { expect, test } from '@playwright/test';
import { degrees, PDFDocument, rgb } from 'pdf-lib';
import { readFile } from 'node:fs/promises';
import JSZip from 'jszip';

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
  await expect(page).toHaveURL(/\/pdf\/workspace\?mode=merge$/);
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
  await expect(
    page.locator('.pdf-reader-sheet canvas[aria-label="a.pdf · 1"]')
  ).toBeVisible();
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

test('PDF reader keeps the active page through zoom and reordering and splits the current order', async ({
  page
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/pdf/workspace');
  const reader = page.getByRole('region', { name: 'PDF 预览' });
  const pageNumber = reader.getByRole('textbox', { name: '跳转到页码' });
  await page
    .locator('input[type=file]')
    .setInputFiles([
      await pdfFile('a.pdf', [200, 300]),
      await pdfFile('b.pdf', [400])
    ]);
  await expect(reader.locator('canvas').first()).toBeVisible();
  await reader.getByRole('button', { name: '下一页' }).click();
  await expect(pageNumber).toHaveValue('2');
  await pageNumber.fill('3');
  await pageNumber.press('Enter');
  const thumbnail = page.getByRole('button', { name: '预览输出第 3 页' });
  await expect(thumbnail).toHaveAttribute('aria-current', 'page');
  const sheet = reader.locator('.pdf-reader-sheet[aria-label="输出页 3"]');
  const originalWidth = (await sheet.boundingBox())!.width;
  await reader.getByRole('combobox', { name: '缩放' }).selectOption('200');
  await expect
    .poll(async () => (await sheet.boundingBox())!.width)
    .toBeGreaterThan(originalWidth);
  await expect(pageNumber).toHaveValue('3');
  await page.getByRole('checkbox', { name: '选择第 3 页' }).check();
  await page.getByRole('button', { name: '前移', exact: true }).click();
  await expect(pageNumber).toHaveValue('2');
  await page.getByRole('button', { name: '旋转 90°' }).click();
  await expect(
    reader.locator('.pdf-reader-sheet[aria-label="输出页 2"] canvas')
  ).toBeVisible();

  await page.getByRole('button', { name: '页面整理', exact: true }).click();
  await page.getByRole('button', { name: '拆分 PDF', exact: true }).click();
  const ranges = page.getByRole('textbox', { name: '拆分范围（按当前页序）' });
  await ranges.fill('1-4');
  await expect(page.getByTestId('process-tool')).toBeDisabled();
  await ranges.fill(Array.from({ length: 60 }, () => '1-2').join(','));
  await page.getByTestId('process-tool').click();
  await page.getByRole('button', { name: '取消', exact: true }).click();
  await expect(page.getByRole('button', { name: '下载 PDF' })).toBeDisabled();
  await expect(ranges).toBeEnabled();
  await ranges.fill('1-2，3');
  await page.getByTestId('process-tool').click();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: '下载 ZIP' }).click();
  const archive = await JSZip.loadAsync(
    await readFile((await (await download).path())!)
  );
  const first = await PDFDocument.load(
    await archive.file('document-1.pdf')!.async('uint8array')
  );
  const second = await PDFDocument.load(
    await archive.file('document-2.pdf')!.async('uint8array')
  );
  expect(
    first
      .getPages()
      .map((sheet) => [sheet.getWidth(), sheet.getRotation().angle])
  ).toEqual([
    [200, 0],
    [400, 90]
  ]);
  expect(second.getPages().map((sheet) => sheet.getWidth())).toEqual([300]);
  await page.getByRole('button', { name: '撤销', exact: true }).click();
  await expect(page.getByRole('button', { name: '下载 PDF' })).toBeDisabled();
  await expect(pageNumber).toHaveValue('2');
});

test('PDF workbench opens in a new tab with a standalone reader and compact panels', async ({
  page,
  context
}) => {
  await page.goto('/categories/pdf');
  const link = page.getByRole('link', { name: 'PDF 工作台 · 在新标签页打开' });
  await expect(link).toHaveAttribute('target', '_blank');
  const opened = context.waitForEvent('page');
  await link.click();
  const readerTab = await opened;
  await expect(readerTab).toHaveURL(/\/pdf\/workspace$/);
  await expect(page).toHaveURL(/\/categories\/pdf$/);
  await expect(
    readerTab.getByRole('heading', { level: 1, name: 'PDF 工作台' })
  ).toBeVisible();
  await expect(
    readerTab.locator('.tool-page-header, .sidebar, .app-footer')
  ).toHaveCount(0);
  const documents = readerTab.getByRole('group', {
    name: '文档工具栏',
    exact: true
  });
  const tools = readerTab.getByRole('group', {
    name: 'PDF 工具栏',
    exact: true
  });
  await expect(
    documents.getByRole('link', { name: '返回 XFTools' })
  ).toHaveAttribute('href', '/categories/pdf');
  await expect(
    documents.getByRole('button', { name: '打开 PDF' })
  ).toBeVisible();
  for (const name of ['页面整理', '批注与表单', '格式转换', '压缩与加密']) {
    await expect(
      tools.getByRole('button', { name, exact: true })
    ).toBeVisible();
  }
  const more = tools.getByRole('button', { name: '更多工具' });
  await more.click();
  await tools.getByRole('button', { name: '添加收藏' }).click();
  await more.click();
  await expect(tools.getByRole('button', { name: '取消收藏' })).toHaveAttribute(
    'aria-pressed',
    'true'
  );
  await tools.getByRole('button', { name: '取消收藏' }).click();
  await expect(
    readerTab.getByRole('button', { name: '选择文件' })
  ).toBeVisible();
  await expect(
    readerTab.getByRole('complementary', { name: '页面整理', exact: true })
  ).toBeVisible();
  await readerTab
    .locator('input[type=file]')
    .setInputFiles(await pdfFile('Project Overview.pdf', [320, 300]));
  const reader = readerTab.getByRole('region', { name: 'PDF 预览' });
  await expect(reader.locator('canvas').first()).toBeVisible();
  await readerTab.screenshot({
    path: '.tmp/screenshots/pdf-workspace-desktop.png'
  });

  await readerTab.setViewportSize({ width: 320, height: 812 });
  for (const row of [documents, tools])
    expect(
      await row.evaluate(
        (element) => element.scrollWidth <= element.clientWidth
      )
    ).toBe(true);
  const formats = tools.getByRole('button', { name: '格式转换', exact: true });
  await formats.click();
  await expect(
    tools
      .getByRole('group', { name: '格式转换', exact: true })
      .getByRole('button', { name: 'PDF 转图片', exact: true })
  ).toBeVisible();
  await readerTab.keyboard.press('Escape');
  await expect(formats).toBeFocused();
  await readerTab.setViewportSize({ width: 375, height: 812 });
  const organizer = documents.getByRole('button', { name: '组织页面' });
  const thumbnails = readerTab.getByRole('complementary', {
    name: '页面缩略图',
    exact: true
  });
  await expect(thumbnails).toBeVisible();
  await thumbnails.getByRole('button', { name: '预览输出第 2 页' }).click();
  await expect(reader.getByRole('textbox', { name: '跳转到页码' })).toHaveValue(
    '2'
  );
  await thumbnails.getByRole('button', { name: '隐藏缩略图' }).click();
  await expect(thumbnails).toBeHidden();
  await expect(organizer).toHaveAttribute('aria-expanded', 'false');
  await organizer.click();
  await expect(organizer).toHaveAttribute('aria-expanded', 'true');
  const pageActions = readerTab.getByRole('region', { name: '选中页面的操作' });
  await expect(pageActions).toBeHidden();
  await readerTab.getByRole('button', { name: '预览输出第 2 页' }).click();
  await expect(organizer).toHaveAttribute('aria-expanded', 'false');
  await expect(thumbnails).toBeVisible();
  await expect(reader.getByRole('textbox', { name: '跳转到页码' })).toHaveValue(
    '2'
  );
  await expect(
    reader.locator('canvas[aria-label="Project Overview.pdf · 2"]')
  ).toBeVisible();
  expect(
    (await reader.locator('.pdf-reader-toolbar').boundingBox())!.height
  ).toBeLessThan(64);
  await readerTab.screenshot({
    path: '.tmp/screenshots/pdf-workspace-mobile.png'
  });
  const exportPanel = documents.getByRole('button', {
    name: '保存 PDF',
    exact: true
  });
  await exportPanel.click();
  const scope = readerTab.getByRole('combobox', { name: '导出范围' });
  await expect(scope).toBeVisible();
  await scope.selectOption('selection');
  await readerTab
    .getByRole('button', { name: '选择页面', exact: true })
    .click();
  await expect(scope).toBeHidden();
  await readerTab
    .getByRole('checkbox', { name: '选择第 2 页', exact: true })
    .check();
  await expect(pageActions).toBeVisible();
  await pageActions.getByRole('button', { name: '导出所选' }).click();
  await expect(organizer).toHaveAttribute('aria-expanded', 'false');
  await expect(scope).toHaveValue('selection');
  await expect(
    readerTab.getByRole('button', { name: '提取选中页' })
  ).toBeEnabled();
  await readerTab.getByRole('button', { name: '关闭导出栏' }).click();
  await expect(exportPanel).toHaveAttribute('aria-expanded', 'false');
  await expect(
    readerTab.getByRole('combobox', { name: '导出范围' })
  ).toBeHidden();
  expect(
    await readerTab.evaluate(() => document.documentElement.scrollWidth)
  ).toBeLessThanOrEqual(375);
});

test('old rotation link applies an absolute angle and retains editable form fields', async ({
  page
}) => {
  const pdf = await PDFDocument.create();
  const sheet = pdf.addPage([200, 300]);
  sheet.setRotation(degrees(270));
  const field = pdf.getForm().createTextField('name');
  field.setText('Editable value');
  field.addToPage(sheet, { x: 10, y: 10, width: 90, height: 25 });

  await page.goto('/pdf/rotate-pdf');
  await expect(page).toHaveURL(/\/pdf\/workspace\?mode=rotate$/);
  await page.locator('input[type=file]').setInputFiles({
    name: 'form.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from(await pdf.save())
  });
  await page.getByRole('button', { name: '应用到全部页' }).click();
  await page.getByTestId('process-tool').click();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: '下载 PDF' }).click();
  const rotated = await PDFDocument.load(
    await readFile((await (await download).path())!)
  );
  expect(rotated.getPage(0).getRotation().angle).toBe(90);
  expect(rotated.getForm().getTextField('name').getText()).toBe(
    'Editable value'
  );
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
  await expect(page.locator('.pdf-reader-sheet canvas').first()).toBeVisible();
  expect(await page.locator('.pdf-reader-sheet').count()).toBeLessThan(10);
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
  await page.getByText('移到指定页', { exact: true }).click();
  await page.getByRole('button', { name: '移动', exact: true }).click();
  await page.getByRole('button', { name: '上一组', exact: true }).click();
  await expect(page.locator('.pdf-page-caption').first()).toContainText(
    '原第 25 页'
  );
});

test('PDF sidebar resizes, drops pages after the last thumbnail, and exports from the context menu', async ({
  page
}) => {
  await page.setViewportSize({ width: 1280, height: 1000 });
  await page.goto('/pdf/workspace');
  await page
    .locator('input[type=file]')
    .setInputFiles(await pdfFile('order.pdf', [100, 200, 300, 400]));
  const grid = page.locator('.pdf-page-grid');
  const separator = page.getByRole('separator', { name: '调整页面栏宽度' });
  const columns = () =>
    grid.evaluate(
      (element) =>
        getComputedStyle(element).gridTemplateColumns.trim().split(/\s+/).length
    );
  const resize = async (x: number) => {
    const bounds = (await separator.boundingBox())!;
    const y = bounds.y + bounds.height / 2;
    await page.mouse.move(bounds.x + bounds.width / 2, y);
    await page.mouse.down();
    await page.mouse.move(x, y, { steps: 8 });
    await page.mouse.up();
  };
  await expect.poll(columns).toBe(2);
  await resize(510);
  await expect.poll(columns).toBeGreaterThanOrEqual(4);
  await resize(175);
  await expect.poll(columns).toBe(1);

  const cards = grid.locator('.pdf-page');
  const first = cards.first().getByRole('button', { name: '预览输出第 1 页' });
  const last = cards.last();
  const firstBox = (await first.boundingBox())!;
  const lastBox = (await last.boundingBox())!;
  await page.mouse.move(firstBox.x + firstBox.width / 2, firstBox.y + 22);
  await page.mouse.down();
  await page.mouse.move(
    lastBox.x + lastBox.width / 2,
    lastBox.y + lastBox.height - 10,
    { steps: 8 }
  );
  await expect(last).toHaveAttribute('data-drop-side', 'after');
  await page.mouse.up();
  await expect(last.locator('.pdf-page-caption')).toContainText('原第 1 页');

  await resize(510);
  await expect.poll(columns).toBeGreaterThanOrEqual(4);
  const leftBox = (await cards.first().boundingBox())!;
  const rightBox = (await cards.nth(1).boundingBox())!;
  const movingBox = (await last.boundingBox())!;
  await page.mouse.move(movingBox.x + 40, movingBox.y + 90);
  await page.mouse.down();
  await page.mouse.move(
    (leftBox.x + leftBox.width + rightBox.x) / 2,
    rightBox.y + 90,
    { steps: 8 }
  );
  await expect(cards.nth(1)).toHaveAttribute('data-drop-side', 'before');
  await page.mouse.up();
  await expect(cards.nth(1).locator('.pdf-page-caption')).toContainText(
    '原第 1 页'
  );
  await page.getByRole('button', { name: '撤销', exact: true }).click();
  await expect(last.locator('.pdf-page-caption')).toContainText('原第 1 页');

  const thumb = last.getByRole('button', { name: '预览输出第 4 页' });
  const menu = page.getByRole('menu', { name: '第 4 页操作' });
  await thumb.click({ button: 'right' });
  await expect(menu).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(thumb).toBeFocused();
  await thumb.click({ button: 'right' });
  await menu.getByRole('menuitem', { name: '旋转 90°' }).click();
  await expect(last.locator('.pdf-page-caption')).toContainText('+90°');
  await thumb.click({ button: 'right' });
  await menu.getByRole('menuitem', { name: '导出此页' }).click();
  await expect(page.getByLabel('导出范围')).toHaveValue('selection');
  await page.getByTestId('process-tool').click();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: '下载 PDF', exact: true }).click();
  const result = await PDFDocument.load(
    await readFile((await (await download).path())!)
  );
  expect(
    result
      .getPages()
      .map((sheet) => [sheet.getWidth(), sheet.getRotation().angle])
  ).toEqual([[100, 90]]);
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
  await page.getByRole('button', { name: '更多工具', exact: true }).click();
  await page.getByRole('button', { name: '清空', exact: true }).click();
  await expect(page.getByTestId('process-tool')).toBeDisabled();
  await expect(page.locator('.pdf-source')).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: '撤销', exact: true })
  ).toBeDisabled();
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
