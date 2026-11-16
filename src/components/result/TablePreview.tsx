import { useState } from 'react';
import { splitCsv } from '@utils/csv';
import { useWorkbenchText } from 'i18n/workbench';
export default function TablePreview({
  value,
  extension
}: {
  value: string;
  extension: string;
}) {
  const { english } = useWorkbenchText();
  const [delimiter, setDelimiter] = useState(extension === 'tsv' ? '\t' : ',');
  const rows = splitCsv(value, false, '', true, delimiter);
  const columns = Math.min(
    20,
    Math.max(0, ...rows.slice(0, 50).map((row) => row.length))
  );
  return (
    <div className="table-preview">
      <label className="table-delimiter">
        {english ? 'Preview separator' : '预览分隔符'}
        <select
          className="ui-input"
          value={delimiter}
          onChange={(event) => setDelimiter(event.target.value)}
        >
          <option value=",">{english ? 'Comma' : '逗号'} (,)</option>
          <option value=";">{english ? 'Semicolon' : '分号'} (;)</option>
          <option value={'\t'}>Tab</option>
          <option value="|">{english ? 'Pipe' : '竖线'} (|)</option>
        </select>
      </label>
      <div className="ui-table-scroll">
        <table className="ui-table">
          <caption className="sr-only">
            {english ? 'Result table preview' : '结果表格预览'}
          </caption>
          <thead>
            <tr>
              <th scope="col">#</th>
              {Array.from({ length: columns }, (_, index) => (
                <th scope="col" key={index}>
                  {english ? 'Column' : '列'} {index + 1}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, 50).map((row, index) => (
              <tr key={index}>
                <th scope="row">{index + 1}</th>
                {Array.from({ length: columns }, (_, i) => (
                  <td key={i}>{row[i] || ''}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="ui-helper">
        {english
          ? 'Preview shows up to 50 rows and 20 columns. Download includes all data.'
          : '预览最多显示 50 行、20 列；下载文件包含全部数据。'}
      </p>
    </div>
  );
}
