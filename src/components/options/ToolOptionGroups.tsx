import { uiText } from 'i18n/uiText';
import type { ReactNode } from 'react';
export interface ToolOptionGroup {
  title: string;
  component: ReactNode;
}
export default function ToolOptionGroups({
  groups,
  vertical
}: {
  groups: ToolOptionGroup[];
  vertical?: boolean;
}) {
  return (
    <div className={`tool-option-groups ${vertical ? 'vertical' : ''}`}>
      {groups.map((group, index) => (
        <div className="tool-option-group" key={group.title + index}>
          <h3>{uiText(group.title)}</h3>
          {group.component}
        </div>
      ))}
    </div>
  );
}
