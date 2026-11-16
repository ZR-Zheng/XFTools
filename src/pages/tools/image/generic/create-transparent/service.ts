import { areColorsSimilar } from '@utils/color';
export type MaskMode = 'transparent' | 'replace';

export function applyColorMask(
  pixels: Uint8ClampedArray,
  from: [number, number, number],
  tolerance: number,
  mode: MaskMode = 'transparent',
  background: [number, number, number] = [255, 255, 255]
): void {
  if (!Number.isFinite(tolerance) || tolerance < 0 || tolerance > 100)
    throw new Error('Color tolerance must be between 0 and 100.');
  for (let i = 0; i < pixels.length; i += 4) {
    if (
      pixels[i + 3] === 0 ||
      !areColorsSimilar(
        [pixels[i], pixels[i + 1], pixels[i + 2]],
        from,
        tolerance
      )
    )
      continue;
    if (mode === 'transparent') pixels[i + 3] = 0;
    else {
      pixels[i] = background[0];
      pixels[i + 1] = background[1];
      pixels[i + 2] = background[2];
      pixels[i + 3] = 255;
    }
  }
}
