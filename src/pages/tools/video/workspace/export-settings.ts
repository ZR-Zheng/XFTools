import { editedSize, type Asset, type Clip } from './timeline';
import { getTemplate, type CanvasSettings } from './templates';

export const formats = ['mp4', 'gif', 'mp3', 'aac', 'wav'] as const;
export type Format = (typeof formats)[number];
export type Resolution = 'source' | '480' | '720' | '1080';

export interface ExportOptions {
  format: Format;
  resolution: Resolution;
  quality: 'high' | 'balanced' | 'small';
  gifWidth: number;
  gifFps: number;
}

export function outputSize(
  asset: Asset,
  clip: Clip,
  options: ExportOptions,
  canvas: CanvasSettings
) {
  const { width, height } = editedSize(asset, clip);
  const shortest = Math.min(width, height);
  const longest = Math.max(width, height);
  const resolution = Number(options.resolution);
  const template = getTemplate(canvas.template);
  const multiple = options.format === 'gif' ? 1 : 2;
  const align = (value: number) =>
    Math.max(multiple, Math.round(value / multiple) * multiple);
  if (canvas.template === 'jianying' && canvas.dimensions) {
    const imported = canvas.dimensions;
    const shortEdge = Math.min(imported.width, imported.height);
    const longEdge = Math.max(imported.width, imported.height);
    const scale =
      options.format === 'gif'
        ? Math.min(1, options.gifWidth / longEdge)
        : options.resolution === 'source'
          ? 1
          : Math.min(
              resolution / shortEdge,
              (resolution * 16) / (longEdge * 9)
            );
    return {
      width: align(imported.width * scale),
      height: align(imported.height * scale)
    };
  }
  if (template) {
    const unit =
      options.format === 'gif'
        ? options.gifWidth / Math.max(template.width, template.height)
        : (options.resolution === 'source' ? shortest : resolution) /
          Math.min(template.width, template.height);
    return {
      width: align(template.width * unit),
      height: align(template.height * unit)
    };
  }
  const scale =
    options.format === 'gif'
      ? Math.min(1, options.gifWidth / longest)
      : options.resolution === 'source'
        ? 1
        : Math.min(resolution / shortest, (resolution * 16) / (longest * 9));
  return { width: align(width * scale), height: align(height * scale) };
}
