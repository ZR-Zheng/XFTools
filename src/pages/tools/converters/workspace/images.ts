import { canvasToBlob } from '@utils/image';
import { decodeImage, formats } from '../../image/workspace/render-image';
import { isCanvasSize } from '../../image/workspace/session';
import { outputName, presets, type Settings } from './formats';

// A 24-bit BMP stores each scanline in BGR order, padded to four bytes.
function encodeBmp(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number
) {
  const stride = Math.ceil((width * 3) / 4) * 4;
  const buffer = new ArrayBuffer(54 + stride * height);
  const header = new DataView(buffer);
  header.setUint16(0, 0x4d42, true);
  header.setUint32(2, buffer.byteLength, true);
  header.setUint32(10, 54, true);
  header.setUint32(14, 40, true);
  header.setInt32(18, width, true);
  header.setInt32(22, -height, true);
  header.setUint16(26, 1, true);
  header.setUint16(28, 24, true);
  header.setUint32(34, stride * height, true);
  const bytes = new Uint8Array(buffer, 54);
  const pixels = ctx.getImageData(0, 0, width, height).data;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const pixel = (y * width + x) * 4;
      const offset = y * stride + x * 3;
      bytes[offset] = pixels[pixel + 2];
      bytes[offset + 1] = pixels[pixel + 1];
      bytes[offset + 2] = pixels[pixel];
    }
  }
  return new Blob([buffer], { type: 'image/bmp' });
}

export async function convertImage(
  file: File,
  { format, preset }: Settings,
  signal: AbortSignal
) {
  signal.throwIfAborted();
  if (
    format !== 'png' &&
    format !== 'jpg' &&
    format !== 'webp' &&
    format !== 'bmp' &&
    format !== 'pdf'
  )
    throw new Error('请选择图片支持的输出格式。');
  const source = await decodeImage(file);
  signal.throwIfAborted();
  const options = presets[preset];
  const ratio = options.imageSide
    ? Math.min(1, options.imageSide / Math.max(source.width, source.height))
    : 1;
  const width = Math.max(1, Math.round(source.width * ratio));
  const height = Math.max(1, Math.round(source.height * ratio));
  if (!isCanvasSize({ width, height }))
    throw new Error(
      '图片像素超过浏览器转换上限，请换用小体积预设或先缩小图片。'
    );
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  try {
    const ctx = canvas.getContext('2d', {
      willReadFrequently: format === 'bmp'
    });
    if (!ctx) throw new Error('无法创建图片画布。');
    if (format === 'jpg' || format === 'bmp' || format === 'pdf') {
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, width, height);
    }
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(source.image, 0, 0, width, height);
    const type =
      format === 'bmp'
        ? 'image/bmp'
        : formats[format === 'pdf' ? 'jpg' : format];
    const blob =
      format === 'bmp'
        ? encodeBmp(ctx, width, height)
        : await canvasToBlob(canvas, type, options.quality);
    if (blob.type !== type) throw new Error('浏览器不支持这个图片输出格式。');
    signal.throwIfAborted();
    if (format !== 'pdf')
      return new File([blob], outputName(file, format), { type });

    const { PDFDocument } = await import('pdf-lib');
    const pdf = await PDFDocument.create();
    const image = await pdf.embedJpg(await blob.arrayBuffer());
    const page = pdf.addPage([width * 0.75, height * 0.75]);
    page.drawImage(image, {
      x: 0,
      y: 0,
      width: page.getWidth(),
      height: page.getHeight()
    });
    const bytes = await pdf.save();
    return new File([new Uint8Array(bytes)], outputName(file, 'pdf'), {
      type: 'application/pdf'
    });
  } finally {
    canvas.width = canvas.height = 0;
  }
}
