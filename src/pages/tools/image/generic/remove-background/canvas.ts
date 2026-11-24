import { canvasToBlob } from '@utils/image';

export async function readBackgroundImage(file: File) {
  let input: Blob = file;
  if (/^image\/hei[cf]$/.test(file.type) || /\.hei[cf]$/i.test(file.name)) {
    const { heicTo } = await import('heic-to');
    input = await heicTo({ blob: file, type: 'image/png' });
  }
  if (typeof createImageBitmap === 'function') return createImageBitmap(input);
  const url = URL.createObjectURL(input);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    return image;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function backgroundCanvas(width: number, height: number) {
  if (typeof document === 'undefined')
    return new OffscreenCanvas(width, height);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

export async function transparentImage(
  canvas: OffscreenCanvas | HTMLCanvasElement,
  file: File
) {
  const type = 'image/png';
  const blob =
    'convertToBlob' in canvas
      ? await canvas.convertToBlob({ type })
      : await canvasToBlob(canvas, type);
  return new File([blob], file.name.replace(/\.[^.]+$/, '') + '-no-bg.png', {
    type
  });
}
