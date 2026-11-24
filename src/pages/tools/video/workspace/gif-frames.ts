import { GifReader } from 'omggif';

export function decodeGif(bytes: Uint8Array) {
  const reader = new GifReader(bytes);
  const { width, height } = reader;
  if (
    !width ||
    !height ||
    width > 8192 ||
    height > 8192 ||
    width * height > 16_777_216
  )
    throw new Error('GIF 画面尺寸过大，请先缩小尺寸。');
  const ends: number[] = [];
  let duration = 0;
  for (let index = 0; index < reader.numFrames(); index++) {
    const { delay } = reader.frameInfo(index);
    duration += (delay < 2 ? 10 : delay) / 100;
    ends.push(duration);
  }
  if (!duration || !width || !height)
    throw new Error('GIF does not contain a frame.');

  const canvas = new OffscreenCanvas(width, height);
  const context = canvas.getContext('2d')!;
  const image = context.createImageData(width, height);
  let displayed = -1;
  let previous: Uint8ClampedArray<ArrayBuffer> | undefined;

  function frameAt(time: number) {
    let left = 0;
    let right = ends.length - 1;
    while (left < right) {
      const middle = Math.floor((left + right) / 2);
      if (ends[middle] <= time) left = middle + 1;
      else right = middle;
    }
    const target = left;
    if (target === displayed) return undefined;
    if (target < displayed) {
      displayed = -1;
      previous = undefined;
      image.data.fill(0);
    }
    while (displayed < target) {
      if (displayed >= 0) {
        const frame = reader.frameInfo(displayed);
        if (frame.disposal === 2) {
          for (let row = frame.y; row < frame.y + frame.height; row++) {
            const start = (row * width + frame.x) * 4;
            image.data.fill(0, start, start + frame.width * 4);
          }
        } else if (frame.disposal === 3 && previous) {
          image.data.set(previous);
        }
      }
      displayed++;
      if (reader.frameInfo(displayed).disposal === 3) {
        previous ??= new Uint8ClampedArray(image.data.length);
        previous.set(image.data);
      }
      reader.decodeAndBlitFrameRGBA(displayed, image.data);
    }
    context.putImageData(image, 0, 0);
    return canvas;
  }

  return { width, height, duration, frameAt };
}
