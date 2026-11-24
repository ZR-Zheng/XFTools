import { expect, test, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { Jimp } from 'jimp';
import {
  degrees,
  PDFDict,
  PDFDocument,
  PDFHexString,
  PDFName,
  PDFRawStream
} from 'pdf-lib';
import JSZip from 'jszip';

async function upload(
  page: Page,
  document: PDFDocument,
  name: string,
  useObjectStreams = true
) {
  const buffer = Buffer.from(await document.save({ useObjectStreams }));
  await page
    .getByLabel('选择 PDF 文件')
    .setInputFiles({ name, mimeType: 'application/pdf', buffer });
  return buffer;
}

async function download(page: Page, name: string) {
  const intent = page.waitForEvent('download');
  await page.getByRole('button', { name, exact: true }).click();
  const result = await intent;
  return {
    name: result.suggestedFilename(),
    bytes: await readFile((await result.path())!)
  };
}

async function place(page: Page, kind: string, x: number, y: number) {
  await page.getByRole('button', { name: kind, exact: true }).click();
  await page
    .locator('.pdf-reader-sheet[aria-label="输出页 1"] .pdf-place-target')
    .click({ position: { x, y } });
}

test('PDF annotations and new editable forms follow a rotated cropped page through reordering and duplication', async ({
  page
}) => {
  const original = await PDFDocument.create();
  const cropped = original.addPage([340, 480]);
  cropped.setCropBox(20, 25, 300, 400);
  cropped.setRotation(degrees(90));
  cropped.drawText('Cropped source', { x: 65, y: 200 });
  const other = await PDFDocument.create();
  other.addPage([420, 240]).drawText('Separate source');
  await page.goto('/pdf/editor');
  await upload(page, original, 'crop.pdf');
  await expect(page.locator('.pdf-reader-sheet canvas').first()).toBeVisible();
  await place(page, '便签', 60, 60);
  await page.getByLabel('批注内容').fill('中文便签：核对页码');
  await page.getByRole('button', { name: '保存属性' }).click();
  await expect(
    page.getByRole('button', { name: '编辑 中文便签：核对页码' })
  ).toBeVisible();
  await page.getByRole('button', { name: '撤销', exact: true }).click();
  await expect(
    page.getByRole('button', { name: '编辑 中文便签：核对页码' })
  ).toHaveCount(0);
  await page.getByRole('button', { name: '重做', exact: true }).click();
  await expect(
    page.getByRole('button', { name: '编辑 中文便签：核对页码' })
  ).toBeVisible();
  await place(page, '区域高亮', 110, 100);
  await page.getByRole('button', { name: '手绘', exact: true }).click();
  const markTarget = await page
    .locator('.pdf-place-target')
    .first()
    .boundingBox();
  expect(markTarget).toBeTruthy();
  const { x, y } = markTarget!;
  await page.mouse.move(x + 75, y + 130);
  await page.mouse.down();
  await page.mouse.move(x + 132, y + 151, { steps: 5 });
  await page.mouse.up();
  await expect(page.locator('.pdf-mark-ink')).toBeVisible();
  await place(page, '文本批注', 140, 140);
  await page.getByLabel('批注内容').fill('中文文本');
  await page.getByRole('button', { name: '保存属性' }).click();

  await page.getByRole('button', { name: '批注与表单', exact: true }).click();
  await page.getByRole('button', { name: '表单设计', exact: true }).click();
  await place(page, '文本框', 120, 220);
  await page.getByLabel('字段名称').fill('customer');
  await page.getByLabel('默认值').fill('中文客户');
  await page.getByLabel('必填').check();
  await page.getByRole('button', { name: '保存属性' }).click();
  await upload(page, other, 'other.pdf');
  const organizer = page.getByRole('button', { name: '组织页面' });
  if ((await organizer.getAttribute('aria-expanded')) === 'false')
    await organizer.click();
  await page.getByRole('checkbox', { name: '选择第 2 页' }).check();
  await page.getByRole('button', { name: '前移', exact: true }).click();
  await page.getByRole('button', { name: '取消选择' }).click();
  await page.getByRole('checkbox', { name: '选择第 2 页' }).check();
  await page.getByRole('button', { name: '旋转 90°', exact: true }).click();
  await page.getByRole('button', { name: '复制页面' }).click();
  await page.getByRole('button', { name: '保存 PDF', exact: true }).click();
  await page.getByTestId('process-tool').click();
  const { bytes } = await download(page, '下载 PDF');
  const saved = await PDFDocument.load(bytes);
  expect(
    saved
      .getPages()
      .map((sheet) => [sheet.getWidth(), sheet.getRotation().angle])
  ).toEqual([
    [420, 0],
    [340, 180],
    [340, 180]
  ]);
  expect(saved.getPage(1).getCropBox()).toEqual(cropped.getCropBox());
  const marks = [1, 2].map((pageNumber) => {
    const annots = saved.getPage(pageNumber).node.Annots()!;
    return Array.from({ length: annots.size() }, (_, i) =>
      annots.lookup(i)
    ).filter(
      (dictionary): dictionary is PDFDict => dictionary instanceof PDFDict
    );
  });
  const text = PDFName.of('Contents');
  for (const widgets of marks) {
    expect(
      widgets.map((item) => item.get(PDFName.of('Subtype'))?.toString())
    ).toEqual(['/Text', '/Highlight', '/Ink', '/FreeText', '/Widget']);
    expect((widgets[0].lookup(text) as PDFHexString).decodeText()).toBe(
      '中文便签：核对页码'
    );
    expect(widgets[2].lookup(PDFName.of('InkList')).toString()).toContain('[');
    expect((widgets[3].lookup(text) as PDFHexString).decodeText()).toBe(
      '中文文本'
    );
  }
  expect(marks[0][0]).not.toBe(marks[1][0]);
  const form = saved.getForm();
  expect(form.getTextField('customer').getText()).toBe('中文客户');
  expect(form.getTextField('customer').isRequired()).toBe(true);
  expect(form.getTextField('customer_2').getText()).toBe('中文客户');
});

test('advanced PDF editor opens a working copy and returns its saved form to the workspace', async ({
  page
}) => {
  const pdf = await PDFDocument.create();
  const sheet = pdf.addPage([320, 450]);
  const field = pdf.getForm().createTextField('editor_field');
  field.setText('Before');
  field.addToPage(sheet, { x: 25, y: 370, width: 150, height: 26 });
  await page.goto('/pdf/editor');
  await upload(page, pdf, 'existing.pdf');
  await page.getByRole('button', { name: '编辑原有批注与表单' }).click();
  const editor = page.getByRole('dialog', { name: '高级 PDF 编辑' });
  await expect(editor).toBeVisible();
  const apply = editor.getByRole('button', { name: '应用并返回工作台' });
  await expect(apply).toBeEnabled({ timeout: 20000 });
  const widget = editor.getByRole('textbox').last();
  await expect(widget).toHaveValue('Before');
  await widget.fill('After');
  await widget.press('Tab');
  await apply.click();
  await expect(editor).toBeHidden();
  await page.getByRole('button', { name: '保存 PDF', exact: true }).click();
  await page.getByTestId('process-tool').click();
  const { bytes } = await download(page, '下载 PDF');
  expect(
    (await PDFDocument.load(bytes))
      .getForm()
      .getTextField('editor_field')
      .getText()
  ).toBe('After');
});

test('PDF password protection stays local, handles a failed WASM load, and requires the correct password to reopen', async ({
  page
}) => {
  const pdf = await PDFDocument.create();
  pdf.addPage([210, 270]).drawText('Protected text');
  await page.goto('/pdf/protect-pdf');
  await upload(page, pdf, 'security.pdf');
  await page.getByLabel('打开密码').fill('test-password-95');
  await page.getByLabel('确认密码').fill('wrong');
  const process = page.getByTestId('process-tool');
  await expect(process).toBeDisabled();
  await page.getByLabel('确认密码').fill('test-password-95');
  await page.route(/\.wasm(?:\?|$)/, (route) => route.abort());
  await process.click();
  await expect(page.getByRole('alert')).toContainText(/密码处理|密码保护/, {
    timeout: 20000
  });
  await page.unroute(/\.wasm(?:\?|$)/);
  await process.click();
  const protectedPdf = await download(page, '下载 PDF');
  expect(protectedPdf.name).toBe('security-protected.pdf');
  await expect(PDFDocument.load(protectedPdf.bytes)).rejects.toThrow(
    /encrypted/i
  );
  await page.getByRole('button', { name: '更多工具', exact: true }).click();
  await page.getByRole('button', { name: '清空', exact: true }).click();
  await page.getByLabel('选择 PDF 文件').setInputFiles({
    name: protectedPdf.name,
    mimeType: 'application/pdf',
    buffer: protectedPdf.bytes
  });
  const dialog = page.getByRole('dialog', { name: '输入 PDF 密码' });
  await dialog.getByLabel('PDF 密码').fill('wrong');
  await dialog.getByRole('button', { name: '解锁并打开' }).click();
  await expect(dialog.getByRole('alert')).toContainText('密码不正确');
  await dialog.getByLabel('PDF 密码').fill('test-password-95');
  await dialog.getByRole('button', { name: '解锁并打开' }).click();
  await expect(dialog).toBeHidden();
  await expect(page.locator('.pdf-reader-sheet canvas').first()).toBeVisible();
});

test('PDF compression reduces an unpacked document and preserves its pages', async ({
  page
}) => {
  const pdf = await PDFDocument.create();
  for (let index = 0; index < 15; index++)
    pdf.addPage([200, 320]).drawText(`Original text ${index}`);
  await page.goto('/pdf/workspace');
  const original = await upload(page, pdf, 'unpacked.pdf', false);
  await page.getByRole('button', { name: '压缩与加密', exact: true }).click();
  await page.getByRole('button', { name: 'PDF 压缩', exact: true }).click();
  await expect(
    page.getByRole('complementary', { name: 'PDF 压缩', exact: true })
  ).toBeVisible();
  await expect(page.getByLabel('渲染倍率')).toHaveCount(0);
  await page.getByLabel('压缩级别').selectOption('lossless');
  await expect(page.getByText('图片压缩设置', { exact: true })).toHaveCount(0);
  await page.getByTestId('process-tool').click();
  const result = await download(page, '下载 PDF');
  expect(result.name).toBe('unpacked-compressed.pdf');
  expect(result.bytes.byteLength).toBeLessThan(original.byteLength);
  expect((await PDFDocument.load(result.bytes)).getPageCount()).toBe(15);
});

test('advanced PDF compression converts JPEG and Flate images to visible JPEG 2000 while keeping text and transparency', async ({
  page,
  context
}) => {
  const requests: string[] = [];
  context.on('request', (request) => requests.push(request.url()));
  await page.goto('/pdf/compress-pdf');
  const [png, transparent] = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 900;
    canvas.height = 540;
    const ctx = canvas.getContext('2d')!;
    for (let y = 0; y < 540; y += 3) {
      for (let x = 0; x < 900; x += 3) {
        const n =
          (Math.imul(x + 3, y + 5) ^ Math.imul(x + y + 7, 2654435761)) >>> 0;
        ctx.fillStyle = `rgb(${n & 255},${80 + ((n >>> 8) & 127)},${(n >>> 16) & 255})`;
        ctx.fillRect(x, y, 3, 3);
      }
    }
    const png = canvas.toDataURL('image/png');
    ctx.clearRect(0, 0, 450, 540);
    return [png, canvas.toDataURL('image/png')].map((url) => url.split(',')[1]);
  });
  const pdf = await PDFDocument.create();
  const sheet = pdf.addPage([300, 390]);
  const pngBytes = Buffer.from(png, 'base64');
  const jpeg = await (
    await Jimp.read(pngBytes)
  ).getBuffer('image/jpeg', { quality: 98 });
  const assets = [
    await pdf.embedJpg(jpeg),
    await pdf.embedPng(pngBytes),
    await pdf.embedPng(Buffer.from(transparent, 'base64'))
  ];
  for (const [index, image] of assets.entries())
    sheet.drawImage(image, {
      x: 50,
      y: 265 - index * 110,
      width: 200,
      height: 105
    });
  sheet.drawText('Searchable PDF text', { x: 50, y: 15, size: 10 });
  const original = await upload(page, pdf, 'photos.pdf');
  const options = page.getByRole('complementary', {
    name: 'PDF 压缩',
    exact: true
  });
  await options.getByText('图片压缩设置', { exact: true }).click();
  await options.getByLabel('图片编码').selectOption('jp2');
  await options.getByLabel('图片最长边').selectOption('600');
  await options.getByRole('slider', { name: '图片质量' }).press('Home');
  await options.getByLabel('将压缩的图片转为灰度').check();
  expect(requests.some((url) => /openjpegwasm.*\.wasm/.test(url))).toBe(false);
  await page.getByTestId('process-tool').click();
  const result = await download(page, '下载 PDF');
  expect(requests.some((url) => /openjpegwasm.*\.wasm/.test(url))).toBe(true);
  expect(result.bytes.length).toBeLessThan(original.length * 0.65);
  const compressed = await PDFDocument.load(result.bytes);
  const outputImages = compressed.context
    .enumerateIndirectObjects()
    .flatMap(([, object]) =>
      object instanceof PDFRawStream &&
      object.dict.get(PDFName.of('Subtype'))?.toString() === '/Image'
        ? [object]
        : []
    );
  const encoded = outputImages.filter(
    (image) => image.dict.get(PDFName.of('Filter'))?.toString() === '/JPXDecode'
  );
  expect(encoded.length).toBe(2);
  for (const image of encoded) {
    expect(image.dict.get(PDFName.of('Width'))?.toString()).toBe('600');
    expect(image.dict.get(PDFName.of('Height'))?.toString()).toBe('360');
    expect(image.dict.get(PDFName.of('ColorSpace'))?.toString()).toBe(
      '/DeviceGray'
    );
  }
  const withMask = outputImages.find((image) =>
    image.dict.has(PDFName.of('SMask'))
  );
  expect(withMask?.dict.get(PDFName.of('Width'))?.toString()).toBe('900');
  const inputContents = (await PDFDocument.load(original))
    .getPage(0)
    .node.Contents();
  const outputContents = compressed.getPage(0).node.Contents();
  expect(outputContents?.toString()).toBe(inputContents?.toString());

  await page.goto('/pdf/workspace');
  await page.getByLabel('选择 PDF 文件').setInputFiles({
    name: result.name,
    mimeType: 'application/pdf',
    buffer: result.bytes
  });
  const rendered = page.locator('.pdf-reader-sheet canvas').first();
  await expect(rendered).toBeVisible();
  await expect
    .poll(() =>
      rendered.evaluate((canvas: HTMLCanvasElement) => {
        const ctx = canvas.getContext('2d')!;
        const [r, g, b, a] = ctx.getImageData(
          Math.floor(canvas.width * 0.33),
          Math.floor(canvas.height * 0.15),
          1,
          1
        ).data;
        return (
          a === 255 && r < 205 && Math.abs(r - g) <= 2 && Math.abs(r - b) <= 2
        );
      })
    )
    .toBe(true);
});

test('images are added in the configured order and extracted from the current PDF', async ({
  page
}) => {
  await page.goto('/pdf/convert-to-pdf');
  const fixtures = await page.evaluate(() =>
    [
      [36, 60],
      [80, 26]
    ].map(([width, height], index) => {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext('2d')!;
      context.fillStyle = index ? '#2a6471' : '#e77d49';
      context.fillRect(0, 0, width, height);
      return canvas.toDataURL('image/png').split(',')[1];
    })
  );
  await page.getByLabel('选择图片文件').setInputFiles(
    fixtures.map((value, index) => ({
      name: `photo-${index + 1}.png`,
      mimeType: 'image/png',
      buffer: Buffer.from(value, 'base64')
    }))
  );
  await page.getByLabel('页面大小').selectOption('full');
  await page.getByRole('button', { name: '上移 photo-2.png' }).click();
  await page.getByRole('button', { name: '生成并加入工作台' }).click();
  await expect(page.locator('.pdf-reader-sheet canvas').first()).toBeVisible();
  await page.getByRole('button', { name: '格式转换', exact: true }).click();
  await page.getByRole('button', { name: '提取内嵌图片', exact: true }).click();
  await page.getByTestId('process-tool').click();
  const output = await download(page, '下载 ZIP');
  const zip = await JSZip.loadAsync(output.bytes);
  const first = await zip.file('page_1_img_1.png')!.async('nodebuffer');
  const second = await zip.file('page_2_img_1.png')!.async('nodebuffer');
  expect([first.readUInt32BE(16), first.readUInt32BE(20)]).toEqual([80, 26]);
  expect([second.readUInt32BE(16), second.readUInt32BE(20)]).toEqual([36, 60]);
});

test('a large PDF keeps the preview virtualized during jumps on a phone-width viewport', async ({
  page
}) => {
  const pdf = await PDFDocument.create();
  for (let index = 0; index < 220; index++)
    pdf.addPage([420, 570]).drawText(`Page ${index + 1}`);
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/pdf/workspace');
  await upload(page, pdf, 'large.pdf');
  await expect(page.locator('.pdf-reader-sheet canvas').first()).toBeVisible();
  const number = page.getByLabel('跳转到页码');
  await number.fill('220');
  await number.press('Enter');
  await expect(number).toHaveValue('220');
  await expect(
    page
      .getByRole('region', { name: 'PDF 预览' })
      .locator('canvas[aria-label="large.pdf · 220"]')
  ).toBeVisible();
  await expect(
    page
      .getByRole('complementary', { name: '页面缩略图' })
      .getByRole('button', { name: '预览输出第 220 页' })
  ).toHaveAttribute('aria-current', 'page');
  expect(await page.locator('.pdf-reader-sheet').count()).toBeLessThan(10);
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth)
  ).toBeLessThanOrEqual(375);
});
