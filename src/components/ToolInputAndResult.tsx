import type { ReactNode } from 'react';
export default function ToolInputAndResult({
  input,
  result
}: {
  input?: ReactNode;
  result?: ReactNode;
}) {
  if (!input && !result) return null;
  return (
    <div
      id="tool"
      className={`tool-panels ${!input || !result ? 'single' : ''}`}
    >
      {input && <section className="tool-panel">{input}</section>}
      {result && <section className="tool-panel">{result}</section>}
    </div>
  );
}
