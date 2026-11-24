import { canvasToBlob } from '@utils/image';
import { parseColorToRgb } from '@utils/color';
import { applyColorMask } from '../generic/create-transparent/service';
import { exportSvg } from './export-svg';
import {
  isCanvasSize,
  editSize,
  type Edit,
  type ImageSource,
  type Size
} from './session';

export type Frame = Size & { pixels: HTMLImageElement | HTMLCanvasElement };

export const formats = {
  png: 'image/png',
  jpg: 'image/jpeg',
  webp: 'image/webp'
} as const;
export type ImageFormat = keyof typeof formats | 'svg';
export type ExportOptions = {
  name: string;
  format: ImageFormat;
  quality: number;
  background: string;
};

const heic = /\.(?:heic|heif)$/i;

export async function decodeImage(file: File): Promise<ImageSource> {
  const load = async (blob: Blob) => {
    const url = URL.createObjectURL(blob);
    try {
      const image = new Image();
      image.src = url;
      await image.decode();
      if (!image.naturalWidth || !image.naturalHeight)
        throw new Error('图片没有可读取的像素。');
      return {
        file,
        image,
        width: image.naturalWidth,
        height: image.naturalHeight
      };
    } finally {
      URL.revokeObjectURL(url);
    }
  };
  try {
    return await load(file);
  } catch {
    if (!heic.test(file.name) && !/^image\/hei[cf]/.test(file.type))
      throw new Error('无法读取图片，请确认文件格式受支持且文件完好。');
    const { heicTo } = await import('heic-to');
    return load(await heicTo({ blob: file, type: 'image/png' }));
  }
}

export function sourceFrame(source: ImageSource): Frame {
  return { pixels: source.image, width: source.width, height: source.height };
}

export function releaseFrame(frame: Frame) {
  if (frame.pixels instanceof HTMLCanvasElement) {
    frame.pixels.width = 0;
    frame.pixels.height = 0;
  }
}

function canvasContext(
  canvas: HTMLCanvasElement,
  size: Size,
  preview: boolean,
  readPixels = false
) {
  if (!preview && !isCanvasSize(size))
    throw new Error('图片超过画布处理上限，请先裁剪或缩小图片。');
  const ratio = preview
    ? Math.min(
        1,
        1600 / Math.max(size.width, size.height),
        Math.sqrt(1_600_000 / (size.width * size.height))
      )
    : 1;
  canvas.width = Math.max(1, Math.round(size.width * ratio));
  canvas.height = Math.max(1, Math.round(size.height * ratio));
  const ctx = canvas.getContext('2d', { willReadFrequently: readPixels });
  if (!ctx) throw new Error('无法创建图片画布。');
  ctx.imageSmoothingQuality = 'high';
  ctx.scale(canvas.width / size.width, canvas.height / size.height);
  return ctx;
}

export function paintPreview(canvas: HTMLCanvasElement, frame: Frame) {
  canvasContext(canvas, frame, true).drawImage(
    frame.pixels,
    0,
    0,
    frame.width,
    frame.height
  );
}

function drawWatermark(
  ctx: CanvasRenderingContext2D,
  size: Size,
  edit: Extract<Edit, { type: 'watermark' }>
) {
  const shortEdge = Math.min(size.width, size.height);
  const font = Math.max(1, (shortEdge * edit.size) / 100);
  const inset = Math.max(1, shortEdge * 0.04);
  const centered = edit.position === 'center';
  const left = edit.position.endsWith('left');
  const top = edit.position.startsWith('top');
  ctx.textAlign = centered ? 'center' : left ? 'left' : 'right';
  ctx.textBaseline = centered ? 'middle' : top ? 'top' : 'bottom';
  ctx.font = `600 ${font}px sans-serif`;
  ctx.fillStyle = edit.color;
  ctx.globalAlpha = edit.percent / 100;
  ctx.fillText(
    edit.text,
    centered ? size.width / 2 : left ? inset : size.width - inset,
    centered ? size.height / 2 : top ? inset : size.height - inset,
    Math.max(1, size.width - inset * 2)
  );
}

function adjustColors(
  ctx: CanvasRenderingContext2D,
  edit: Extract<Edit, { type: 'color' }>
) {
  const pixels = ctx.getImageData(0, 0, ctx.canvas.width, ctx.canvas.height);
  const brightness = edit.brightness / 100;
  const contrast = edit.contrast / 100;
  const saturation = edit.saturation / 100;
  const transform = (value: number) =>
    Math.min(
      255,
      Math.max(
        0,
        (Math.min(255, value * brightness) - 127.5) * contrast + 127.5
      )
    );
  for (let index = 0; index < pixels.data.length; index += 4) {
    if (!pixels.data[index + 3]) continue;
    const red = transform(pixels.data[index]);
    const green = transform(pixels.data[index + 1]);
    const blue = transform(pixels.data[index + 2]);
    const gray = red * 0.2126 + green * 0.7152 + blue * 0.0722;
    pixels.data[index] = gray + (red - gray) * saturation;
    pixels.data[index + 1] = gray + (green - gray) * saturation;
    pixels.data[index + 2] = gray + (blue - gray) * saturation;
  }
  ctx.putImageData(pixels, 0, 0);
}

function drawOpacity(
  ctx: CanvasRenderingContext2D,
  frame: Frame,
  edit: Extract<Edit, { type: 'opacity' }>
) {
  const { width, height } = frame;
  const { mode, background, percent, area } = edit;
  if (mode === 'solid') {
    if (background) {
      ctx.fillStyle = background;
      ctx.fillRect(0, 0, width, height);
    }
    ctx.globalAlpha = percent / 100;
    ctx.drawImage(frame.pixels, 0, 0, width, height);
    return;
  }
  ctx.drawImage(frame.pixels, 0, 0, width, height);
  const { x, y, width: w, height: h } = area;
  const cx = x + w / 2;
  const cy = y + h / 2;
  const gradient =
    mode === 'linear'
      ? ctx.createLinearGradient(x, y, x + w, y)
      : ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.min(w, h) / 2);
  const { r, g, b } = background
    ? parseColorToRgb(background)
    : { r: 0, g: 0, b: 0 };
  const faded = percent / 100;
  const opacity = background ? 1 - faded : faded;
  const full = background ? 0 : 1;
  gradient.addColorStop(
    0,
    `rgba(${r},${g},${b},${mode === 'radial-out' ? full : opacity})`
  );
  gradient.addColorStop(
    1,
    `rgba(${r},${g},${b},${mode === 'radial-out' ? opacity : full})`
  );
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  if (!background) ctx.globalCompositeOperation = 'destination-in';
  ctx.fillStyle = gradient;
  ctx.fillRect(x, y, w, h);
}

function drawExtendedCanvas(
  ctx: CanvasRenderingContext2D,
  frame: Frame,
  edit: Extract<Edit, { type: 'extend' }>
) {
  const { width, height, fill, color, anchor, scale } = edit;
  if (fill !== 'transparent') {
    ctx.fillStyle = fill === 'solid' ? color : '#fff';
    ctx.fillRect(0, 0, width, height);
  }
  if (fill === 'blur') {
    const blur = Math.max(3, Math.min(width, height) / 30);
    const cover = Math.max(
      (width + 6 * blur) / frame.width,
      (height + 6 * blur) / frame.height
    );
    const w = frame.width * cover;
    const h = frame.height * cover;
    ctx.filter = `blur(${(blur * ctx.canvas.width) / width}px)`;
    ctx.drawImage(frame.pixels, (width - w) / 2, (height - h) / 2, w, h);
    ctx.filter = 'none';
  }
  const fit =
    (Math.min(1, width / frame.width, height / frame.height) * scale) / 100;
  const w = frame.width * fit;
  const h = frame.height * fit;
  ctx.drawImage(
    frame.pixels,
    ((width - w) * (anchor % 3)) / 2,
    ((height - h) * Math.floor(anchor / 3)) / 2,
    w,
    h
  );
}

function renderEdit(frame: Frame, edit: Edit, preview: boolean): Frame {
  if (edit.type === 'background') return sourceFrame(edit.result);
  const size = editSize(frame, edit);
  const canvas = document.createElement('canvas');
  try {
    const ctx = canvasContext(
      canvas,
      size,
      preview,
      edit.type === 'color' || edit.type === 'mask'
    );
    ctx.save();
    switch (edit.type) {
      case 'extend':
        drawExtendedCanvas(ctx, frame, edit);
        break;
      case 'crop': {
        const { x, y, width, height } = edit.rect;
        if (edit.circle) {
          ctx.beginPath();
          ctx.arc(width / 2, height / 2, width / 2, 0, Math.PI * 2);
          ctx.clip();
        }
        const pixels = frame.pixels;
        const scaleX =
          (pixels instanceof HTMLImageElement
            ? pixels.naturalWidth
            : pixels.width) / frame.width;
        const scaleY =
          (pixels instanceof HTMLImageElement
            ? pixels.naturalHeight
            : pixels.height) / frame.height;
        ctx.drawImage(
          pixels,
          x * scaleX,
          y * scaleY,
          width * scaleX,
          height * scaleY,
          0,
          0,
          width,
          height
        );
        break;
      }
      case 'rotate':
        ctx.translate(size.width / 2, size.height / 2);
        ctx.rotate((edit.angle * Math.PI) / 180);
        ctx.scale(edit.flipX ? -1 : 1, edit.flipY ? -1 : 1);
        ctx.drawImage(
          frame.pixels,
          -frame.width / 2,
          -frame.height / 2,
          frame.width,
          frame.height
        );
        break;
      case 'opacity':
        drawOpacity(ctx, frame, edit);
        break;
      default:
        ctx.drawImage(frame.pixels, 0, 0, size.width, size.height);
        if (edit.type === 'color') adjustColors(ctx, edit);
        if (edit.type === 'mask' && edit.enabled) {
          const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const from = parseColorToRgb(edit.from);
          const to = parseColorToRgb(edit.to);
          applyColorMask(
            pixels.data,
            [from.r, from.g, from.b],
            edit.tolerance,
            edit.mode,
            [to.r, to.g, to.b]
          );
          ctx.putImageData(pixels, 0, 0);
        }
        if (edit.type === 'watermark') drawWatermark(ctx, size, edit);
    }
    ctx.restore();
    return { width: size.width, height: size.height, pixels: canvas };
  } catch (error) {
    canvas.width = canvas.height = 0;
    throw error;
  }
}

export function renderEdits(
  source: Frame,
  edits: readonly Edit[],
  preview: boolean
): Frame {
  let frame = source;
  try {
    for (const edit of edits) {
      const next = renderEdit(frame, edit, preview);
      if (frame !== source) releaseFrame(frame);
      frame = next;
    }
    return frame;
  } catch (error) {
    if (frame !== source) releaseFrame(frame);
    throw error;
  }
}

export async function exportImage(
  source: ImageSource,
  edits: readonly Edit[],
  options: ExportOptions
) {
  const name = options.name
    .trim()
    .replace(/\.(?:png|jpe?g|webp|svg)$/i, '')
    .replace(/[\\/:*?"<>|]/g, '-');
  const filename = `${name || 'image'}.${options.format}`;
  if (options.format === 'svg') return exportSvg(source, edits, filename);
  const frame = renderEdits(sourceFrame(source), edits, false);
  const result =
    frame.pixels instanceof HTMLCanvasElement
      ? frame.pixels
      : document.createElement('canvas');
  try {
    if (result !== frame.pixels) {
      canvasContext(result, frame, false).drawImage(frame.pixels, 0, 0);
    }
    if (options.format === 'jpg') {
      const ctx = result.getContext('2d')!;
      ctx.resetTransform();
      ctx.globalCompositeOperation = 'destination-over';
      ctx.fillStyle = options.background;
      ctx.fillRect(0, 0, result.width, result.height);
    }
    const type = formats[options.format];
    const blob = await canvasToBlob(result, type, options.quality / 100);
    if (blob.type !== type)
      throw new Error('当前浏览器无法导出选定格式，请改用 PNG。');
    return new File([blob], filename, { type });
  } finally {
    result.width = result.height = 0;
  }
}
