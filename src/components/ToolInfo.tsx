import { uiText } from 'i18n/uiText';
export default function ToolInfo({
  title,
  description
}: {
  title: string;
  description: string;
}) {
  return (
    <aside className="tool-info">
      <h2>{uiText(title)}</h2>
      <p>{uiText(description)}</p>
    </aside>
  );
}
