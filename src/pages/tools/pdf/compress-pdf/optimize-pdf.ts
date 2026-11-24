import {
  PDFDocument,
  PDFDict,
  PDFName,
  PDFNumber,
  PDFRawStream,
  PDFRef
} from 'pdf-lib';
import { canvasToBlob } from '@utils/image';
import type { PdfJob } from '../shared/task';
import { decodeFlateImage } from './flate-image';
import type { CompressionOptions } from './types';

type Candidate = {
  bytes: Uint8Array;
  filter: 'DCTDecode' | 'JPXDecode' | 'FlateDecode';
  grayscale: boolean;
};

class Jpeg2000Error extends Error {
  constructor(cause: unknown) {
    super('无法完成 JPEG 2000 编码。', { cause });
  }
}

function hasApplicationMetadata(bytes: Uint8Array) {
  let offset = 2;
  while (offset + 4 < bytes.length && bytes[offset] === 0xff) {
    const marker = bytes[offset + 1];
    // EXIF orientation and ICC color profiles belong to the original PDF image.
    if (marker === 0xe1 || marker === 0xe2) return true;
    if (marker === 0xda || marker === 0xd9) return false;
    const length = (bytes[offset + 2] << 8) | bytes[offset + 3];
    if (length < 2) return true;
    offset += length + 2;
  }
  return false;
}

function makeCanvas(width: number, height: number) {
  if (typeof document === 'undefined')
    return new OffscreenCanvas(width, height);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

async function loadJpeg(bytes: Uint8Array<ArrayBuffer>) {
  const blob = new Blob([bytes], { type: 'image/jpeg' });
  if (typeof createImageBitmap === 'function') return createImageBitmap(blob);
  const url = URL.createObjectURL(blob);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    return image;
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function encodeFlate(
  image: ImageData,
  grayscale: boolean
): Promise<Candidate> {
  const { width, height, data } = image;
  const channels = grayscale ? 1 : 3;
  const stride = width * channels + 1;
  const bytes = new Uint8Array(stride * height);
  // PNG Sub predictor stores differences from the previous pixel in the row.
  for (let y = 0; y < height; y++) {
    const row = y * stride;
    bytes[row] = 1;
    for (let x = 0; x < width; x++) {
      const pixel = (y * width + x) * 4;
      for (let c = 0; c < channels; c++)
        bytes[row + 1 + x * channels + c] =
          data[pixel + c] - (x ? data[pixel + c - 4] : 0);
    }
  }
  const deflated = new Blob([bytes])
    .stream()
    .pipeThrough(new CompressionStream('deflate'));
  return {
    bytes: new Uint8Array(await new Response(deflated).arrayBuffer()),
    filter: 'FlateDecode',
    grayscale
  };
}

async function resample(
  object: PDFRawStream,
  source: { width: number; height: number; jpeg: boolean; components: 1 | 3 },
  options: CompressionOptions,
  signal?: AbortSignal
) {
  const { width, height, jpeg, components } = source;
  const original = object.getContents() as Uint8Array<ArrayBuffer>;
  const side = options.maxSide || Math.max(width, height);
  const scale = Math.min(1, side / Math.max(width, height));
  const resultWidth = Math.max(1, Math.round(width * scale));
  const resultHeight = Math.max(1, Math.round(height * scale));
  const canvas = makeCanvas(resultWidth, resultHeight);
  try {
    const context = canvas.getContext('2d', {
      willReadFrequently: options.grayscale || options.imageEncoding !== 'jpeg'
    });
    if (!context) return;
    context.imageSmoothingQuality = 'high';
    if (jpeg) {
      const image = await loadJpeg(original);
      try {
        context.drawImage(image, 0, 0, resultWidth, resultHeight);
      } finally {
        if ('close' in image) image.close();
      }
    } else {
      const params = object.dict.lookup(PDFName.of('DecodeParms'));
      if (
        (params && !(params instanceof PDFDict)) ||
        typeof DecompressionStream !== 'function'
      )
        return;
      const pixels = await decodeFlateImage(
        original,
        width,
        height,
        components,
        params
      );
      if (!pixels) return;
      const sourceCanvas = scale === 1 ? canvas : makeCanvas(width, height);
      try {
        const sourceContext = sourceCanvas.getContext('2d');
        if (!sourceContext) return;
        const rgba = sourceContext.createImageData(width, height);
        for (let i = 0, j = 0; i < rgba.data.length; i += 4, j += components) {
          rgba.data[i] = pixels[j];
          rgba.data[i + 1] = pixels[j + (components === 1 ? 0 : 1)];
          rgba.data[i + 2] = pixels[j + (components === 1 ? 0 : 2)];
          rgba.data[i + 3] = 255;
        }
        sourceContext.putImageData(rgba, 0, 0);
        if (sourceCanvas !== canvas)
          context.drawImage(sourceCanvas, 0, 0, resultWidth, resultHeight);
      } finally {
        if (sourceCanvas !== canvas)
          sourceCanvas.width = sourceCanvas.height = 0;
      }
    }
    signal?.throwIfAborted();

    const grayscale = options.grayscale || components === 1;
    const image =
      grayscale ||
      options.imageEncoding === 'jp2' ||
      (options.imageEncoding === 'auto' && !jpeg)
        ? context.getImageData(0, 0, resultWidth, resultHeight)
        : null;
    if (image && options.grayscale && components === 3) {
      const { data } = image;
      for (let i = 0; i < data.length; i += 4) {
        const gray = Math.round(
          data[i] * 0.2126 + data[i + 1] * 0.7152 + data[i + 2] * 0.0722
        );
        data[i] = data[i + 1] = data[i + 2] = gray;
      }
      context.putImageData(image, 0, 0);
    }

    let candidate: Candidate;
    if (options.imageEncoding === 'jp2' && image) {
      try {
        const { encodeJpeg2000 } = await import('./jpeg-2000');
        candidate = {
          bytes: await encodeJpeg2000(
            image,
            grayscale,
            options.imageQuality / 100
          ),
          filter: 'JPXDecode',
          grayscale
        };
      } catch (error) {
        throw new Jpeg2000Error(error);
      }
    } else {
      const quality = options.imageQuality / 100;
      const blob =
        'convertToBlob' in canvas
          ? await canvas.convertToBlob({ type: 'image/jpeg', quality })
          : await canvasToBlob(canvas, 'image/jpeg', quality);
      if (blob.type !== 'image/jpeg') return;
      candidate = {
        bytes: new Uint8Array(await blob.arrayBuffer()),
        filter: 'DCTDecode',
        grayscale: false
      };
      if (
        options.imageEncoding === 'auto' &&
        image &&
        typeof CompressionStream === 'function'
      ) {
        const flate = await encodeFlate(image, grayscale);
        // Keep the lossless pixels when the compressed size is competitive with JPEG.
        if (flate.bytes.length + 64 <= candidate.bytes.length * 1.15)
          candidate = flate;
      }
    }
    if (candidate.bytes.length + 96 >= original.length) return;
    return { ...candidate, width: resultWidth, height: resultHeight };
  } finally {
    canvas.width = canvas.height = 0;
  }
}

const imageOverrides = [
  'Decode',
  'Mask',
  'SMask',
  'Alternates',
  'ImageMask',
  'Matte',
  'SMaskInData',
  'F',
  'FFilter',
  'FDecodeParms'
].map(PDFName.of);

function imageStreams(pdf: PDFDocument) {
  const all = pdf.context.enumerateIndirectObjects();
  const masks = new Set<PDFRef>();
  for (const [, object] of all) {
    if (!(object instanceof PDFRawStream)) continue;
    for (const key of ['SMask', 'Mask']) {
      const mask = object.dict.get(PDFName.of(key));
      if (mask instanceof PDFRef) masks.add(mask);
    }
  }
  return all.flatMap(([ref, object]) => {
    if (
      !(object instanceof PDFRawStream) ||
      masks.has(ref) ||
      object.getContentsSize() <= 4096
    )
      return [];
    const { dict } = object;
    if (imageOverrides.some((key) => dict.has(key))) return [];
    const read = (key: string) => dict.get(PDFName.of(key))?.toString();
    const filter = read('Filter');
    const space = read('ColorSpace');
    const width = Number(read('Width'));
    const height = Number(read('Height'));
    const jpeg = filter === '/DCTDecode';
    if (
      read('Subtype') !== '/Image' ||
      (space !== '/DeviceRGB' && space !== '/DeviceGray') ||
      read('BitsPerComponent') !== '8' ||
      (!jpeg && filter !== '/FlateDecode') ||
      !Number.isInteger(width) ||
      !Number.isInteger(height) ||
      width < 1 ||
      height < 1 ||
      width > 8192 ||
      height > 8192 ||
      width * height > 16_000_000 ||
      (jpeg &&
        (read('DecodeParms') || hasApplicationMetadata(object.getContents())))
    )
      return [];
    const components: 1 | 3 = space === '/DeviceGray' ? 1 : 3;
    return [{ ref, object, source: { width, height, jpeg, components } }];
  });
}

export async function optimizePdf(
  file: File,
  options: CompressionOptions,
  job: PdfJob = {}
) {
  job.signal?.throwIfAborted();
  const pdf = await PDFDocument.load(await file.arrayBuffer(), {
    updateMetadata: false
  });
  const images =
    options.compressionLevel === 'lossless' ? [] : imageStreams(pdf);
  for (const [index, { ref, object, source }] of images.entries()) {
    job.signal?.throwIfAborted();
    const result = await resample(object, source, options, job.signal).catch(
      (error: unknown) => {
        // An explicitly chosen codec must surface a loading or encoding failure.
        if (error instanceof Jpeg2000Error) throw error;
        return undefined;
      }
    );
    job.signal?.throwIfAborted();
    if (result) {
      const dict = object.dict.clone(pdf.context);
      dict.set(PDFName.of('Width'), PDFNumber.of(result.width));
      dict.set(PDFName.of('Height'), PDFNumber.of(result.height));
      dict.set(PDFName.of('Filter'), PDFName.of(result.filter));
      dict.set(
        PDFName.of('ColorSpace'),
        PDFName.of(result.grayscale ? 'DeviceGray' : 'DeviceRGB')
      );
      dict.delete(PDFName.of('DecodeParms'));
      if (result.filter === 'FlateDecode')
        dict.set(
          PDFName.of('DecodeParms'),
          pdf.context.obj({
            Predictor: 15,
            Columns: result.width,
            Colors: result.grayscale ? 1 : 3,
            BitsPerComponent: 8
          })
        );
      pdf.context.assign(ref, PDFRawStream.of(dict, result.bytes));
    }
    job.onProgress?.(index + 1, images.length);
  }
  job.signal?.throwIfAborted();
  const output = await pdf.save({
    useObjectStreams: true,
    updateFieldAppearances: false
  });
  job.signal?.throwIfAborted();
  return new File(
    [output.length < file.size ? (output as BlobPart) : file],
    file.name.replace(/\.pdf$/i, '') + '-compressed.pdf',
    { type: 'application/pdf' }
  );
}
