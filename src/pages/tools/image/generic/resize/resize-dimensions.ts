import type { InitialValuesType } from './types';
export function getResizeDimensions(
  width: number,
  height: number,
  options: InitialValuesType
) {
  if (options.resizeMethod === 'percentage') {
    const scale = Number(options.percentage) / 100;
    return {
      width: Math.max(1, Math.round(width * scale)),
      height: Math.max(1, Math.round(height * scale))
    };
  }
  const targetWidth = Number(options.width),
    targetHeight = Number(options.height);
  if (!options.maintainAspectRatio)
    return { width: targetWidth, height: targetHeight };
  return options.dimensionType === 'width'
    ? {
        width: targetWidth,
        height: Math.max(1, Math.round((targetWidth * height) / width))
      }
    : {
        width: Math.max(1, Math.round((targetHeight * width) / height)),
        height: targetHeight
      };
}
