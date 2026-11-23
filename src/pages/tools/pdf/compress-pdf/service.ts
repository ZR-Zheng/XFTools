import { PDFDocument, PDFName, PDFNumber, PDFRawStream } from 'pdf-lib';
import { canvasToBlob } from '@utils/image';
import type { PdfJob } from '../shared/task';
import type { InitialValuesType } from './types';

const levels = {
  low: { maxSide: 2800, quality: 0.86 },
  medium: { maxSide: 1900, quality: 0.73 },
  high: { maxSide: 1200, quality: 0.58 }
};

function hasApplicationMetadata(bytes: Uint8Array) {
  let offset = 2;
  while (offset + 4 < bytes.length && bytes[offset] === 0xff) {
    const marker = bytes[offset + 1];
    // Let PDF decoders keep ownership of EXIF orientation and original color profiles.
    if (marker === 0xe1 || marker === 0xe2) return true;
    if (marker === 0xda || marker === 0xd9) return false;
    const length = (bytes[offset + 2] << 8) | bytes[offset + 3];
    if (length < 2) return true;
    offset += length + 2;
  }
  return false;
}

async function resample(bytes: Uint8Array, maxSide: number, quality: number) {
  const image = new Image();
  const url = URL.createObjectURL(
    new Blob([bytes as BlobPart], { type: 'image/jpeg' })
  );
  const canvas = document.createElement('canvas');
  try {
    image.src = url;
    await image.decode();
    const scale = Math.min(
      1,
      maxSide / Math.max(image.naturalWidth, image.naturalHeight)
    );
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext('2d');
    if (!context) return;
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const blob = await canvasToBlob(canvas, 'image/jpeg', quality);
    if (blob.type !== 'image/jpeg' || blob.size >= bytes.byteLength) return;
    return {
      width: canvas.width,
      height: canvas.height,
      bytes: new Uint8Array(await blob.arrayBuffer())
    };
  } finally {
    URL.revokeObjectURL(url);
    canvas.width = canvas.height = 0;
  }
}

export async function compressPdf(
  file: File,
  { compressionLevel }: InitialValuesType,
  job: PdfJob = {}
) {
  const pdf = await PDFDocument.load(await file.arrayBuffer(), {
    updateMetadata: false
  });
  const { maxSide, quality } = levels[compressionLevel];
  const images = pdf.context
    .enumerateIndirectObjects()
    .flatMap(([ref, object]) => {
      if (!(object instanceof PDFRawStream)) return [];
      const { dict } = object;
      const read = (key: string) => dict.get(PDFName.of(key))?.toString();
      const width = Number(read('Width'));
      const height = Number(read('Height'));
      // Re-encode RGB JPEGs with a simple dictionary and leave other encodings and masks intact.
      return read('Subtype') === '/Image' &&
        read('Filter') === '/DCTDecode' &&
        read('ColorSpace') === '/DeviceRGB' &&
        !['Decode', 'DecodeParms', 'Mask', 'SMask', 'Alternates'].some(read) &&
        width > 0 &&
        height > 0 &&
        width * height <= 30_000_000 &&
        object.getContentsSize() > 4096 &&
        !hasApplicationMetadata(object.getContents())
        ? [{ ref, object }]
        : [];
    });
  for (const [index, { ref, object }] of images.entries()) {
    job.signal?.throwIfAborted();
    const result = await resample(object.getContents(), maxSide, quality).catch(
      () => undefined
    );
    job.signal?.throwIfAborted();
    if (result) {
      const dictionary = object.dict.clone(pdf.context);
      dictionary.set(PDFName.of('Width'), PDFNumber.of(result.width));
      dictionary.set(PDFName.of('Height'), PDFNumber.of(result.height));
      pdf.context.assign(ref, PDFRawStream.of(dictionary, result.bytes));
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
    [output.byteLength < file.size ? (output as BlobPart) : file],
    `${file.name.replace(/\.pdf$/i, '')}-compressed.pdf`,
    { type: 'application/pdf' }
  );
}
