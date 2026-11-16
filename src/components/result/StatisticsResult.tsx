import ToolTextResult from './ToolTextResult';
import { useWorkbenchText } from 'i18n/workbench';
import { useContext } from 'react';
import { ToolResultVisibleContext } from '../../tools/page-context';
export default function StatisticsResult({
  value,
  title
}: {
  value: string;
  title: string;
}) {
  const { english } = useWorkbenchText();
  const ready = useContext(ToolResultVisibleContext);
  const metrics = [
    ['Characters', '字符'],
    ['Words', '词语'],
    ['Lines', '行数'],
    ['Sentences', '句子'],
    ['Paragraphs', '段落']
  ];
  return (
    <div>
      <dl className="statistics-grid">
        {metrics.map(([key, label]) => (
          <div className="statistic-card" key={key}>
            <dt>{english ? key : label}</dt>
            <dd>
              {ready
                ? value.match(new RegExp(`^${key}: (\\d+)`, 'm'))?.[1] || '0'
                : '0'}
            </dd>
          </div>
        ))}
      </dl>
      <p className="statistics-note">
        {english
          ? 'Characters count visible grapheme clusters, including spaces. Words and sentences use language-aware segmentation unless custom separators are set.'
          : '字符按可见字素计数，包含空格；词语和句子默认使用语言分词，自定义分隔符时按指定规则统计。'}
      </p>
      <ToolTextResult title={title} value={value} />
    </div>
  );
}
