import type { ImageJob } from '../../image-job';
import runtimeModule from '@onnxruntime-wasm/ort-wasm-simd-threaded.mjs?url';
import wasmAsset from '@onnxruntime-wasm/ort-wasm-simd-threaded.wasm?url';
import {
  backgroundCanvas,
  readBackgroundImage,
  transparentImage
} from './canvas';

const size = 320;
const pixelCount = size * size;
const channelMean = [0.485, 0.456, 0.406];
const channelDeviation = [0.229, 0.224, 0.225];

// U²-NetP uses RGB channel-first tensors and ImageNet normalization.
function modelInput(pixels: Uint8ClampedArray) {
  let peak = 1;
  for (let i = 0; i < pixels.length; i += 4) {
    peak = Math.max(peak, pixels[i], pixels[i + 1], pixels[i + 2]);
  }
  const normalized = new Float32Array(3 * pixelCount);
  for (let channel = 0; channel < 3; channel++) {
    for (let i = 0; i < pixelCount; i++) {
      normalized[channel * pixelCount + i] =
        (pixels[i * 4 + channel] / peak - channelMean[channel]) /
        channelDeviation[channel];
    }
  }
  return normalized;
}

function fillAlpha(mask: ImageData, prediction: Float32Array) {
  let min = Infinity;
  let max = -Infinity;
  for (const value of prediction) {
    min = Math.min(min, value);
    max = Math.max(max, value);
  }
  const range = max - min;
  if (!Number.isFinite(range) || range < 1e-6)
    throw new Error('AI 未能识别可分离的主体。');
  for (let i = 0; i < prediction.length; i++) {
    mask.data[i * 4 + 3] = ((prediction[i] - min) / range) * 255;
  }
}

async function foregroundMask(pixels: ImageData, job: ImageJob) {
  const { signal, report } = job;
  report?.('正在加载 U²-NetP 模型…');
  const base = new URL(import.meta.env.BASE_URL, self.location.origin);
  const response = await fetch(new URL('models/u2netp/u2netp.onnx', base), {
    signal
  });
  if (!response.ok) throw new Error('无法加载本地 AI 去背景模型。');
  const [model, ort] = await Promise.all([
    response.arrayBuffer(),
    import('onnxruntime-web/wasm')
  ]);
  signal?.throwIfAborted();
  ort.env.wasm.numThreads = 1;
  ort.env.wasm.wasmPaths = {
    mjs: new URL(runtimeModule, self.location.href).href,
    wasm: new URL(wasmAsset, self.location.href).href
  };
  const session = await ort.InferenceSession.create(model, {
    executionProviders: ['wasm']
  });
  try {
    signal?.throwIfAborted();
    report?.('正在识别图片主体…');
    const input = new ort.Tensor('float32', modelInput(pixels.data), [
      1,
      3,
      size,
      size
    ]);
    const outputName = session.outputNames[0];
    try {
      const { [outputName]: output } = await session.run(
        { [session.inputNames[0]]: input },
        [outputName]
      );
      try {
        signal?.throwIfAborted();
        if (
          !(output.data instanceof Float32Array) ||
          output.data.length !== pixelCount
        )
          throw new Error('AI 去背景模型返回了无法读取的蒙版。');
        fillAlpha(pixels, output.data);
      } finally {
        output.dispose();
      }
    } finally {
      input.dispose();
    }
  } finally {
    await session.release();
  }
}

export async function removeImageBackground(
  file: File,
  job: ImageJob = {}
): Promise<File> {
  job.signal?.throwIfAborted();
  const image = await readBackgroundImage(file);
  const mask = backgroundCanvas(size, size);
  try {
    job.signal?.throwIfAborted();
    const context = mask.getContext('2d', { willReadFrequently: true });
    if (!context) throw new Error('无法创建 AI 蒙版画布。');
    context.fillStyle = 'white';
    context.fillRect(0, 0, size, size);
    context.imageSmoothingQuality = 'high';
    context.drawImage(image, 0, 0, size, size);
    const pixels = context.getImageData(0, 0, size, size);
    await foregroundMask(pixels, job);
    context.putImageData(pixels, 0, 0);

    job.report?.('正在生成透明 PNG…');
    const canvas = backgroundCanvas(image.width, image.height);
    try {
      const output = canvas.getContext('2d');
      if (!output) throw new Error('无法创建去背景结果画布。');
      output.drawImage(image, 0, 0);
      output.globalCompositeOperation = 'destination-in';
      output.imageSmoothingQuality = 'high';
      output.drawImage(mask, 0, 0, canvas.width, canvas.height);
      const result = await transparentImage(canvas, file);
      job.signal?.throwIfAborted();
      return result;
    } finally {
      canvas.width = canvas.height = 0;
    }
  } finally {
    if ('close' in image) image.close();
    mask.width = mask.height = 0;
  }
}
