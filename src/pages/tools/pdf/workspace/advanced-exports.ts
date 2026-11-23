import type { CompressionLevel } from '../compress-pdf/types';
import type { PdfJob } from '../shared/task';

export const outputKinds = [
  'pdf',
  'png',
  'epub',
  'extract',
  'compress',
  'protect'
] as const;
export type OutputKind = (typeof outputKinds)[number];
export type OutputSettings = {
  kind: OutputKind;
  ranges: string;
  scale: number;
  compressionLevel: CompressionLevel;
  password: string;
  confirmPassword: string;
};
export type ExportResult = {
  file: File;
  items?: File[];
  originalSize?: number;
};

export async function convertOutput(
  file: File,
  settings: OutputSettings,
  job: PdfJob
): Promise<ExportResult> {
  switch (settings.kind) {
    case 'png': {
      const { convertPdfToPngImages } = await import('../pdf-to-png/service');
      const { files, zip } = await convertPdfToPngImages(
        file,
        settings.ranges,
        settings.scale,
        job
      );
      return { file: zip, items: files };
    }
    case 'epub': {
      const { convertPdfToEpub } = await import('../pdf-to-epub/service');
      return { file: await convertPdfToEpub(file, job) };
    }
    case 'extract': {
      const { processPDF } = await import('../extract-images-from-pdf/service');
      const result = await processPDF(file, job);
      if (!result) throw new Error('当前页面没有可提取的内嵌图片。');
      return {
        file: result.zipFile ?? result.extractedImages[0],
        items: result.zipFile ? result.extractedImages : undefined
      };
    }
    case 'compress': {
      const { compressPdf } = await import('../compress-pdf/service');
      return {
        file: await compressPdf(file, settings, job),
        originalSize: file.size
      };
    }
    case 'protect': {
      const { protectPdf } = await import('../protect-pdf/service');
      return { file: await protectPdf(file, settings, job.signal) };
    }
    default:
      return { file };
  }
}
