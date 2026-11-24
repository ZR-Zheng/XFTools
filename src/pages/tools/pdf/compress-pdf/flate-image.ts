import { type PDFDict, PDFName } from 'pdf-lib';

function paeth(left: number, up: number, upperLeft: number) {
  const l = Math.abs(up - upperLeft);
  const u = Math.abs(left - upperLeft);
  const ul = Math.abs(left + up - 2 * upperLeft);
  return l <= u && l <= ul ? left : u <= ul ? up : upperLeft;
}

export async function decodeFlateImage(
  bytes: Uint8Array<ArrayBuffer>,
  width: number,
  height: number,
  components: number,
  params?: PDFDict
) {
  const value = (key: string, fallback: number) =>
    Number(params?.get(PDFName.of(key))?.toString() ?? fallback);
  const predictor = value('Predictor', 1);
  const png = predictor >= 10 && predictor <= 15;
  if (
    (!png && predictor !== 1 && predictor !== 2) ||
    (predictor !== 1 &&
      (value('Columns', 1) !== width ||
        value('Colors', 1) !== components ||
        value('BitsPerComponent', 8) !== 8))
  )
    return;
  const stride = width * components;
  const expected = (stride + Number(png)) * height;
  const reader = new Blob([bytes])
    .stream()
    .pipeThrough(new DecompressionStream('deflate'))
    .getReader();
  const decoded = new Uint8Array(expected);
  let offset = 0;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      if (offset + value.length > expected) return;
      decoded.set(value, offset);
      offset += value.length;
    }
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
  if (offset !== expected) return;
  if (predictor === 2) {
    for (let start = 0; start < expected; start += stride)
      for (let x = components; x < stride; x++)
        decoded[start + x] += decoded[start + x - components];
  }
  if (!png) return decoded;
  const pixels = new Uint8Array(stride * height);
  for (let y = 0; y < height; y++) {
    const source = y * (stride + 1);
    const row = y * stride;
    const filter = decoded[source];
    if (filter > 4) return;
    for (let x = 0; x < stride; x++) {
      const index = row + x;
      const left = x >= components ? pixels[index - components] : 0;
      const up = y ? pixels[index - stride] : 0;
      const upperLeft =
        y && x >= components ? pixels[index - stride - components] : 0;
      const delta =
        filter === 1
          ? left
          : filter === 2
            ? up
            : filter === 3
              ? (left + up) >> 1
              : filter === 4
                ? paeth(left, up, upperLeft)
                : 0;
      pixels[index] = decoded[source + 1 + x] + delta;
    }
  }
  return pixels;
}
