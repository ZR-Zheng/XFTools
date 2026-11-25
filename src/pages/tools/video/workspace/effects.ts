import { clamp } from './timeline';

export const maskShapes = {
  rectangle: '矩形',
  ellipse: '椭圆'
} as const;

export const animationPresets = {
  fadeIn: '淡入',
  fadeOut: '淡出',
  fadeInOut: '淡入淡出',
  slideFromLeft: '从左滑入',
  slideFromRight: '从右滑入',
  slideFromBottom: '从下方滑入'
} as const;

export const filterPresets = {
  grayscale: '黑白',
  sepia: '复古',
  vivid: '鲜艳',
  muted: '低饱和'
} as const;

export type VideoMask = {
  shape: keyof typeof maskShapes;
  x: number;
  y: number;
  width: number;
  height: number;
  feather: number;
  inverted: boolean;
};

export type VideoAnimation = {
  preset: keyof typeof animationPresets;
  duration: number;
};

export type VideoFilter = {
  preset: keyof typeof filterPresets;
  strength: number;
};

export const maskDefaults: Omit<VideoMask, 'shape'> = {
  x: 50,
  y: 50,
  width: 70,
  height: 70,
  feather: 0,
  inverted: false
};

export function paintMask(
  canvas: HTMLCanvasElement,
  mask: VideoMask,
  width: number,
  height: number
) {
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d')!;
  const image = context.createImageData(width, height);
  const { data } = image;
  const rx = (mask.width * width) / 200;
  const ry = (mask.height * height) / 200;
  const centerX = (mask.x * width) / 100;
  const centerY = (mask.y * height) / 100;
  const feather = Math.max(
    mask.feather / 100,
    1 / Math.max(1, Math.min(rx, ry))
  );
  const ellipse = mask.shape === 'ellipse';
  data.fill(255);
  for (let y = 0, index = 3; y < height; y++) {
    const dy = Math.abs((y + 0.5 - centerY) / ry);
    for (let x = 0; x < width; x++, index += 4) {
      const dx = Math.abs((x + 0.5 - centerX) / rx);
      const distance = ellipse
        ? Math.sqrt(dx * dx + dy * dy)
        : Math.max(dx, dy);
      const inside = clamp((1 - distance) / feather, 0, 1);
      data[index] = (mask.inverted ? 1 - inside : inside) * 255;
    }
  }
  context.putImageData(image, 0, 0);
}

export function animationWindow(animation: VideoAnimation, clipLength: number) {
  return Math.min(
    animation.duration,
    clipLength / (animation.preset === 'fadeInOut' ? 2 : 1)
  );
}

export function slideDirection(preset: VideoAnimation['preset']) {
  switch (preset) {
    case 'slideFromLeft':
      return { x: -1, y: 0 };
    case 'slideFromRight':
      return { x: 1, y: 0 };
    case 'slideFromBottom':
      return { x: 0, y: 1 };
  }
}

export function animationPose(
  animation: VideoAnimation | undefined,
  time: number,
  clipLength: number
) {
  if (!animation) return { x: 0, y: 0, opacity: 1 };
  const length = animationWindow(animation, clipLength);
  if (length <= 0) return { x: 0, y: 0, opacity: 1 };
  const entry = clamp(time / length, 0, 1);
  const exit = clamp((clipLength - time) / length, 0, 1);
  const direction = slideDirection(animation.preset);
  if (direction)
    return {
      x: direction.x * (1 - entry),
      y: direction.y * (1 - entry),
      opacity: 1
    };
  const opacity =
    animation.preset === 'fadeIn'
      ? entry
      : animation.preset === 'fadeOut'
        ? exit
        : Math.min(entry, exit);
  return { x: 0, y: 0, opacity };
}

const gray = [0.2126, 0.7152, 0.0722];
const saturationLuma = [0.213, 0.715, 0.072];
const sepia = [0.393, 0.769, 0.189, 0.349, 0.686, 0.168, 0.272, 0.534, 0.131];

function saturationAmount(filter: VideoFilter) {
  return (
    1 + ((filter.preset === 'vivid' ? 0.65 : -0.7) * filter.strength) / 100
  );
}

export function previewFilter(filter?: VideoFilter) {
  if (!filter || !filter.strength) return 'none';
  if (filter.preset === 'grayscale' || filter.preset === 'sepia')
    return `${filter.preset}(${filter.strength / 100})`;
  return `saturate(${saturationAmount(filter)})`;
}

export function filterChannels(filter?: VideoFilter) {
  if (!filter || !filter.strength) return;
  const mix =
    filter.preset === 'vivid' || filter.preset === 'muted'
      ? 1 - saturationAmount(filter)
      : filter.strength / 100;
  const channels = filter.preset === 'sepia' ? sepia : null;
  const luma = filter.preset === 'grayscale' ? gray : saturationLuma;
  return Array.from({ length: 9 }, (_, index) => {
    const identity = index % 4 === 0 ? 1 : 0;
    const target = channels?.[index] ?? luma[index % 3];
    return identity + (target - identity) * mix;
  });
}
