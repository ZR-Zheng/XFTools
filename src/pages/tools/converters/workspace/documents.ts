import { convertPdfToEpub } from '../../pdf/pdf-to-epub/service';
import { renderPdfPages } from '../../pdf/pdf-to-png/service';
import { extractPdfText } from '../../pdf/shared/document';
import { archiveFiles } from './archive';
import { outputName, presets, type Settings } from './formats';

export async function convertDocument(
  file: File,
  { format, pages, preset }: Settings,
  signal: AbortSignal,
  onProgress: (progress: number) => void
) {
  const job = {
    signal,
    onProgress: (done: number, total: number) =>
      onProgress(5 + (done / total) * 88)
  };
  if (
    pages.trim() &&
    !/^\s*[1-9]\d*(?:\s*-\s*[1-9]\d*)?(?:\s*,\s*[1-9]\d*(?:\s*-\s*[1-9]\d*)?)*\s*$/.test(
      pages
    )
  )
    throw new Error('请输入有效的页码范围，例如 1,3-5，或留空转换全部页面。');
  if (format === 'epub') return convertPdfToEpub(file, job, pages);
  if (format === 'txt') {
    const text = await extractPdfText(file, pages, job);
    return new File([text.join('\n\n')], outputName(file, 'txt'), {
      type: 'text/plain;charset=utf-8'
    });
  }
  if (format !== 'png' && format !== 'jpg')
    throw new Error('请选择 PDF 支持的输出格式。');
  const options = presets[preset];
  const images = await renderPdfPages(file, pages, options.pdfScale, job, {
    format,
    quality: options.quality,
    maxBytes: 96 * 1024 * 1024
  });
  return images.length === 1
    ? new File(images, outputName(file, format), { type: images[0].type })
    : archiveFiles(images, outputName(file, 'zip', '-pages'), signal);
}
