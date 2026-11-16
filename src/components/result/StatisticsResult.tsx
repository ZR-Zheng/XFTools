import ToolTextResult from './ToolTextResult';
import { useWorkbenchText } from 'i18n/workbench';
export default function StatisticsResult({
  value,
  title
}: {
  value: string;
  title: string;
}) {
  const { english } = useWorkbenchText();
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
              {value.match(new RegExp(`^${key}: (\\d+)`, 'm'))?.[1] || '0'}
            </dd>
          </div>
        ))}
      </dl>
      <ToolTextResult title={title} value={value} />
    </div>
  );
}
