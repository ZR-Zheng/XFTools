import { useRef } from 'react';
import { useWorkbenchText } from 'i18n/workbench';
export default function CodeEditor({
  value = '',
  onChange,
  language,
  options,
  ...props
}: {
  value?: string;
  onChange?: (value: string) => void;
  language: string;
  options?: { readOnly?: boolean; [key: string]: unknown };
  height?: string;
  theme?: string;
  'aria-label'?: string;
}) {
  const { english } = useWorkbenchText();
  const gutter = useRef<HTMLPreElement>(null);
  const lines = value.split('\n').length;
  return (
    <div className="code-editor">
      <div className="code-editor-meta">
        <span>{language.toUpperCase()}</span>
        <span>
          {lines} {english ? 'lines' : '行'} · {value.length.toLocaleString()}{' '}
          {english ? 'characters' : '字符'}
        </span>
      </div>
      <div className="code-editor-body">
        <pre ref={gutter} aria-hidden="true" className="code-gutter">
          {Array.from({ length: Math.min(lines, 2000) }, (_, i) => i + 1).join(
            '\n'
          )}
        </pre>
        <textarea
          aria-label={
            props['aria-label'] ||
            (english
              ? options?.readOnly
                ? 'Code result'
                : 'Code input'
              : options?.readOnly
                ? '代码结果'
                : '代码输入')
          }
          className="code-textarea"
          value={value}
          onChange={(event) => onChange?.(event.target.value)}
          readOnly={options?.readOnly}
          spellCheck={false}
          autoCapitalize="off"
          autoComplete="off"
          onScroll={(event) => {
            if (gutter.current)
              gutter.current.scrollTop = event.currentTarget.scrollTop;
          }}
        />
      </div>
    </div>
  );
}
