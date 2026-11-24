import type { ImageJob } from '../../image-job';
import {
  backgroundCanvas,
  readBackgroundImage,
  transparentImage
} from './canvas';

// Maximum root-mean-square channel difference for a background pixel.
const colorTolerance = 24;
const maxDistance = 3 * colorTolerance ** 2;
const samplesPerSide = 32;

type Raster = Pick<ImageData, 'data' | 'width' | 'height'>;

export function eraseSolidBackground({ data, width, height }: Raster) {
  function distance(left: number, right: number) {
    const a = left * 4;
    const b = right * 4;
    return (
      (data[a] - data[b]) ** 2 +
      (data[a + 1] - data[b + 1]) ** 2 +
      (data[a + 2] - data[b + 2]) ** 2
    );
  }

  const border: number[] = [];
  for (let i = 0; i < samplesPerSide; i++) {
    const x = Math.floor(((i + 0.5) * width) / samplesPerSide);
    const y = Math.floor(((i + 0.5) * height) / samplesPerSide);
    border.push(x, (height - 1) * width + x, y * width, y * width + width - 1);
  }
  const visible = border.filter((index) => data[index * 4 + 3] > 127);
  let reference = -1;
  let coverage = 0;
  for (const candidate of visible) {
    const matches = visible.filter(
      (index) => distance(candidate, index) <= maxDistance
    ).length;
    if (matches > coverage) {
      reference = candidate;
      coverage = matches;
    }
  }
  if (coverage < border.length * 0.65)
    throw new Error('图片边缘没有足够一致的底色。复杂背景需要使用 AI 抠图。');

  function matches(index: number) {
    return data[index * 4 + 3] > 0 && distance(index, reference) <= maxDistance;
  }

  // Mark whole horizontal runs as transparent as soon as they are found.
  // The pending list stores runs, so it needs no second full-size pixel buffer.
  const runs: [number, number][] = [];
  function clearRun(index: number) {
    if (!matches(index)) return;
    const row = index - (index % width);
    let left = index;
    let right = index;
    while (left > row && matches(left - 1)) left--;
    while (right < row + width - 1 && matches(right + 1)) right++;
    for (let pixel = left; pixel <= right; pixel++) data[pixel * 4 + 3] = 0;
    runs.push([left, right]);
  }

  for (let x = 0; x < width; x++) {
    clearRun(x);
    clearRun((height - 1) * width + x);
  }
  for (let y = 1; y < height - 1; y++) {
    clearRun(y * width);
    clearRun(y * width + width - 1);
  }
  while (runs.length) {
    const [left, right] = runs.pop()!;
    for (let index = left; index <= right; index++) {
      if (index >= width) clearRun(index - width);
      if (index < width * (height - 1)) clearRun(index + width);
    }
  }
  for (let alpha = 3; alpha < data.length; alpha += 4) {
    if (data[alpha] > 0) return;
  }
  throw new Error('图片与底色过于接近，纯色去底未能保留主体。');
}

export async function removeSolidBackground(
  file: File,
  { signal, report }: ImageJob = {}
) {
  signal?.throwIfAborted();
  report?.('正在识别并去除纯色背景…');
  const image = await readBackgroundImage(file);
  const { width, height } = image;
  const canvas = backgroundCanvas(width, height);
  try {
    signal?.throwIfAborted();
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) throw new Error('无法创建去底所需的画布。');
    context.drawImage(image, 0, 0);
    const pixels = context.getImageData(0, 0, width, height);
    eraseSolidBackground(pixels);
    context.putImageData(pixels, 0, 0);
    const output = await transparentImage(canvas, file);
    signal?.throwIfAborted();
    return output;
  } finally {
    if ('close' in image) image.close();
    canvas.width = canvas.height = 0;
  }
}
