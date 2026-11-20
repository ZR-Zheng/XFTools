import { areColorsSimilar, parseColorToRgb } from '@utils/color';
import { canvasToBlob } from '@utils/image';

const mimeTypes = { jpg: 'image/jpeg', webp: 'image/webp', png: 'image/png' };

export type ConversionOptions =
  | { format: 'jpg' | 'webp'; quality: number; background: string | null }
  | {
      format: 'png';
      transparent: { color: string; similarity: number } | null;
    };

export async function convertImage(file: File, options: ConversionOptions) {
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('无法创建图片画布。');

    if (options.format !== 'png' && options.background) {
      context.fillStyle = options.background;
      context.fillRect(0, 0, canvas.width, canvas.height);
    }
    context.drawImage(image, 0, 0);
    if (options.format === 'png' && options.transparent) {
      const { color, similarity } = options.transparent;
      const { r, g, b } = parseColorToRgb(color);
      const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
      const { data } = pixels;
      for (let index = 0; index < data.length; index += 4) {
        if (
          areColorsSimilar(
            [data[index], data[index + 1], data[index + 2]],
            [r, g, b],
            similarity
          )
        )
          data[index + 3] = 0;
      }
      context.putImageData(pixels, 0, 0);
    }

    const type = mimeTypes[options.format];
    const blob = await canvasToBlob(
      canvas,
      type,
      options.format === 'png' ? undefined : options.quality / 100
    );
    if (blob.type !== type)
      throw new Error(
        '当前浏览器无法导出 ' + options.format.toUpperCase() + '。'
      );
    const base = file.name.replace(/\.[^.]+$/, '') || file.name;
    return new File([blob], base + '.' + options.format, { type });
  } finally {
    URL.revokeObjectURL(url);
  }
}
