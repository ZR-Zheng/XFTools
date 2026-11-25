import { canvasToBlob } from '@utils/image';
import {
  animationWindow,
  filterChannels,
  paintMask,
  slideDirection,
  type VideoMask
} from './effects';
import { clipDuration, type Clip } from './timeline';

export async function maskPng(mask: VideoMask, width: number, height: number) {
  const canvas = document.createElement('canvas');
  // The mask is decoded once and held by framesync. Its raster stays bounded for large exports.
  const scale = Math.min(1, 2048 / Math.max(width, height));
  try {
    paintMask(
      canvas,
      mask,
      Math.max(1, Math.round(width * scale)),
      Math.max(1, Math.round(height * scale))
    );
    return await canvasToBlob(canvas);
  } finally {
    canvas.width = canvas.height = 0;
  }
}

const colorKeys = ['rr', 'rg', 'rb', 'gr', 'gg', 'gb', 'br', 'bg', 'bb'];
export function colorFilter(clip: Clip) {
  const channels = filterChannels(clip.filter);
  return (
    channels &&
    'colorchannelmixer=' +
      channels
        .map(
          (value, index) => colorKeys[index] + '=' + Number(value.toFixed(6))
        )
        .join(':')
  );
}

const seconds = (value: number) => Number(value.toFixed(6));

export function appendClipEffects(
  graph: string[],
  layer: string,
  clip: Clip,
  index: number,
  {
    width,
    height,
    fps,
    transparent
  }: { width: number; height: number; fps: number; transparent: boolean },
  maskIndex?: number
) {
  if (maskIndex !== undefined) {
    const mask = `[mask${index}]`;
    const input = `[maskInput${index}]`;
    const masked = `[masked${index}]`;
    graph.push(
      `[${maskIndex}:v:0]format=gbrap,scale=${width}:${height}:flags=bilinear,setsar=1${mask}`,
      `${layer}format=gbrap${input}`,
      `${input}${mask}blend=c3_mode=multiply:repeatlast=1${masked}`
    );
    layer = masked;
  }

  const length = clipDuration(clip);
  const animation = clip.animation;
  const direction = animation && slideDirection(animation.preset);
  const duration = animation ? seconds(animationWindow(animation, length)) : 0;
  if (animation && !direction && duration > 0) {
    const fade: string[] = [];
    if (animation.preset !== 'fadeOut')
      fade.push(`fade=t=in:st=0:d=${duration}:alpha=1`);
    if (animation.preset !== 'fadeIn')
      fade.push(
        `fade=t=out:st=${seconds(Math.max(0, length - duration))}:d=${duration}:alpha=1`
      );
    const faded = `[faded${index}]`;
    graph.push(`${layer}format=rgba,${fade.join(',')}${faded}`);
    layer = faded;
  }

  if (!transparent || direction) {
    const background = `[background${index}]`;
    const composited = `[composited${index}]`;
    const movement = (side: number, dimension: number) =>
      side && duration ? `'${side * dimension}*(1-min(t/${duration},1))'` : '0';
    const dx = movement(direction?.x ?? 0, width);
    const dy = movement(direction?.y ?? 0, height);
    const color = transparent ? 'black@0' : 'black';
    graph.push(
      `color=c=${color}:s=${width}x${height}:r=${fps}:d=${seconds(Math.max(length, 1 / fps))},format=rgba${background}`,
      `${background}${layer}overlay=x=${dx}:y=${dy}:format=rgb:shortest=1${composited}`
    );
    layer = composited;
  }
  return layer;
}
