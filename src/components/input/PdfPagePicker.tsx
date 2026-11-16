import { useState } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import workerUrl from '@react-pdf-worker/pdf.worker.min.mjs?url';
import { parsePageRanges } from '../../pages/tools/pdf/split-pdf/service';
import { useWorkbenchText } from '../../i18n/workbench';
import Glyph from '../workbench/Glyph';

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
const pageSize = 24;
export default function PdfPagePicker({
  url,
  ranges,
  onChange
}: {
  url: string;
  ranges: string;
  onChange: (value: string) => void;
}) {
  const { english } = useWorkbenchText();
  const [count, setCount] = useState(0),
    [offset, setOffset] = useState(0);
  const selected = parsePageRanges(ranges, count);
  return (
    <div className="pdf-page-picker">
      <div className="pdf-selection-toolbar">
        <span>
          {english
            ? `${selected.length} / ${count} pages selected`
            : `已选 ${selected.length} / ${count} 页`}
        </span>
        <button type="button" onClick={() => onChange('')}>
          {english ? 'Select all' : '全选'}
        </button>
        <button type="button" onClick={() => onChange('0')}>
          {english ? 'Clear' : '清空'}
        </button>
      </div>
      <Document
        file={url}
        onLoadSuccess={({ numPages }) => setCount(numPages)}
        loading={english ? 'Loading pages…' : '正在加载页面…'}
        error={
          english
            ? 'Unable to preview PDF. You can still enter page numbers.'
            : '无法预览 PDF，仍可手动输入页码。'
        }
      >
        <div className="pdf-thumbnail-grid">
          {Array.from(
            { length: Math.min(pageSize, Math.max(0, count - offset)) },
            (_, i) => offset + i + 1
          ).map((page) => (
            <button
              type="button"
              key={page}
              aria-label={english ? `Page ${page}` : `第 ${page} 页`}
              aria-pressed={selected.includes(page)}
              className={selected.includes(page) ? 'selected' : ''}
              onClick={() => {
                const next = selected.includes(page)
                  ? selected.filter((n) => n !== page)
                  : [...selected, page].sort((a, b) => a - b);
                onChange(next.length ? next.join(',') : '0');
              }}
            >
              {selected.includes(page) && (
                <span className="pdf-page-selected" aria-hidden="true">
                  <Glyph name="check" size={14} />
                </span>
              )}
              <Page
                pageNumber={page}
                width={100}
                renderTextLayer={false}
                renderAnnotationLayer={false}
                loading="…"
              />
              <span>{page}</span>
            </button>
          ))}
        </div>
      </Document>
      {count > pageSize && (
        <div className="pdf-selection-pagination">
          <button
            type="button"
            disabled={!offset}
            onClick={() => setOffset(Math.max(0, offset - pageSize))}
          >
            {english ? 'Previous' : '上一组'}
          </button>
          <span>
            {offset + 1}–{Math.min(count, offset + pageSize)} / {count}
          </span>
          <button
            type="button"
            disabled={offset + pageSize >= count}
            onClick={() => setOffset(offset + pageSize)}
          >
            {english ? 'Next' : '下一组'}
          </button>
        </div>
      )}
    </div>
  );
}
