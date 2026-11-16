import type { ReactNode } from 'react';
export default function ToolInputAndResult({
  input,
  result,
  settings,
  action,
  layout = 'text',
  experience = 'editor',
  phase = 'ready'
}: {
  input?: ReactNode;
  result?: ReactNode;
  settings?: ReactNode;
  action?: ReactNode;
  layout?: string;
  experience?: string;
  phase?: string;
}) {
  return (
    <div
      id="tool"
      className={`tool-flow flow-${layout} experience-${experience} phase-${phase} ${!input ? 'no-input' : ''} ${!result ? 'no-result' : ''} ${!settings ? 'no-settings' : ''}`}
    >
      {input && <section className="tool-panel flow-input">{input}</section>}
      {settings && <aside className="flow-settings">{settings}</aside>}
      {action && <div className="flow-action">{action}</div>}
      {result && <section className="tool-panel flow-result">{result}</section>}
    </div>
  );
}
