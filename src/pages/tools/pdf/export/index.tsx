import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import ToolPdfInput from '@components/input/ToolPdfInput';
import Glyph from '@components/workbench/Glyph';
import useObjectUrl from 'hooks/useObjectUrl';
import { downloadFile } from '@utils/file';
import '../../../../components/workbench/image-batch-workbench.css';
import './pdf-export.css';

const accept = ['application/pdf', '.pdf'];
const formats = [
  { id: 'png', label: 'PNG', description: '逐页导出图片' },
  { id: 'epub', label: 'EPUB', description: '可重排的文字电子书' }
] as const;
type Format = (typeof formats)[number]['id'];
type Result =
  { format: 'png'; files: File[]; zip: File } | { format: 'epub'; file: File };

function ExportedPage({ file }: { file: File }) {
  const url = useObjectUrl(file);
  return (
    <li>
      {url && <img src={url} alt={file.name} loading="lazy" />}
      <button
        className="secondary-button"
        type="button"
        onClick={() => downloadFile(file)}
      >
        <Glyph name="download" size={16} /> {file.name}
      </button>
    </li>
  );
}

export default function PdfExporter() {
  const [params, setParams] = useSearchParams();
  const format: Format = params.get('format') === 'epub' ? 'epub' : 'png';
  const [file, setFile] = useState<File | null>(null);
  const [ranges, setRanges] = useState('');
  const [scale, setScale] = useState(2);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [output, setOutput] = useState<{
    source: File;
    ranges: string;
    scale: number;
    result: Result;
  }>();
  const current =
    output?.source === file &&
    output.result.format === format &&
    (format === 'epub' || (output.ranges === ranges && output.scale === scale))
      ? output.result
      : undefined;
  const validRange =
    !ranges.trim() ||
    /^\d+(?:\s*-\s*\d+)?(?:\s*,\s*\d+(?:\s*-\s*\d+)?)*$/.test(ranges.trim());

  function clearResult() {
    setOutput(undefined);
    setError('');
  }

  function updateRanges(value: string) {
    setRanges(value.replaceAll('，', ',').replaceAll('–', '-'));
    clearResult();
  }

  async function run() {
    if (!file || busy) return;
    clearResult();
    setBusy(true);
    try {
      let result: Result;
      if (format === 'png') {
        const { convertPdfToPngImages } = await import('../pdf-to-png/service');
        const { files, zip } = await convertPdfToPngImages(file, ranges, scale);
        result = { format, files, zip };
      } else {
        const { convertPdfToEpub } = await import('../pdf-to-epub/service');
        result = { format, file: await convertPdfToEpub(file) };
      }
      setOutput({ source: file, ranges, scale, result });
    } catch (cause) {
      setError(
        cause instanceof Error && cause.message === '请选择有效的 PDF 页码。'
          ? cause.message
          : '无法导出 PDF。请确认文件可打开且未受密码保护。'
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="pdf-export-workbench">
      <div className="pdf-export-grid">
        <section className="pdf-export-source tool-panel" inert={busy}>
          <ToolPdfInput
            title={format === 'png' ? 'PDF 页面预览' : '原始 PDF'}
            value={file}
            accept={accept}
            onChange={(next) => {
              setFile(next);
              updateRanges('');
            }}
            pageRanges={ranges}
            onPageRangesChange={format === 'png' ? updateRanges : undefined}
          />
        </section>
        <aside className="pdf-export-controls tool-panel">
          <h2>导出设置</h2>
          <fieldset className="image-batch-choices" disabled={busy}>
            <legend>输出格式</legend>
            <div className="image-batch-choice-row">
              {formats.map((item) => (
                <label className="image-batch-choice" key={item.id}>
                  <input
                    type="radio"
                    name="pdf-export-format"
                    aria-label={item.label}
                    checked={format === item.id}
                    onChange={() => {
                      setParams({ format: item.id }, { replace: true });
                      clearResult();
                    }}
                  />
                  <strong>{item.label}</strong>
                  <small>{item.description}</small>
                </label>
              ))}
            </div>
            {format === 'png' ? (
              <>
                <label className="image-batch-field">
                  <span>导出页码</span>
                  <input
                    className="ui-input"
                    value={ranges}
                    placeholder="全部页面"
                    aria-invalid={!validRange}
                    onChange={(event) => updateRanges(event.target.value)}
                  />
                  <small>可在预览中点选，或输入 1,3-5。</small>
                </label>
                <label className="image-batch-field">
                  <span>渲染倍率</span>
                  <select
                    className="ui-input"
                    value={scale}
                    onChange={(event) => {
                      setScale(Number(event.target.value));
                      clearResult();
                    }}
                  >
                    <option value={1}>1× · 标准</option>
                    <option value={2}>2× · 高清</option>
                    <option value={3}>3× · 超清</option>
                  </select>
                </label>
              </>
            ) : (
              <p className="pdf-export-note">
                提取整份 PDF
                中可选中的文字，按页生成电子书章节。扫描件中的图片文字需先做
                OCR。
              </p>
            )}
          </fieldset>
          {!validRange && format === 'png' && (
            <p className="tool-inline-error" role="alert">
              请用逗号分隔页码或页码范围。
            </p>
          )}
          {error && (
            <p className="tool-inline-error" role="alert">
              {error}
            </p>
          )}
          <button
            className="primary-button"
            data-testid="process-tool"
            type="button"
            disabled={
              !file ||
              busy ||
              (format === 'png' && (!validRange || ranges === '0'))
            }
            onClick={() => void run()}
          >
            {busy ? '正在导出…' : format === 'png' ? '导出 PNG' : '导出 EPUB'}
            <Glyph name="arrow" size={17} />
          </button>
        </aside>
      </div>
      {current && (
        <section
          className="pdf-export-result tool-panel"
          aria-labelledby="pdf-export-result"
        >
          <div className="pdf-export-result-header">
            <div>
              <h2 id="pdf-export-result">
                {current.format === 'png' ? 'PNG 导出结果' : 'EPUB 电子书'}
              </h2>
              <p role="status">
                {current.format === 'png'
                  ? '已导出 ' + current.files.length + ' 页'
                  : current.file.name}
              </p>
            </div>
            <button
              className="secondary-button"
              type="button"
              onClick={() =>
                downloadFile(
                  current.format === 'png' ? current.zip : current.file
                )
              }
            >
              <Glyph name="download" size={17} />
              {current.format === 'png' ? '下载全部为 ZIP' : '下载 EPUB'}
            </button>
          </div>
          {current.format === 'png' && (
            <ul className="pdf-export-pages">
              {current.files.map((item) => (
                <ExportedPage file={item} key={item.name} />
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
