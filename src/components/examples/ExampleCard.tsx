import { uiText } from 'i18n/uiText';
import type { GetGroupsType } from '@components/options/ToolOptions';
import { useWorkbenchText } from '../../i18n/workbench';
import Glyph from '../workbench/Glyph';
export interface ExampleCardProps<T> {
  title: string;
  description: string;
  sampleText?: string;
  sampleResult: string;
  sampleOptions: T;
  changeInputResult: (newInput: string | undefined, newOptions: T) => void;
  getGroups: GetGroupsType<T> | null;
}
export default function ExampleCard<T>({
  title,
  description,
  sampleText,
  sampleResult,
  sampleOptions,
  changeInputResult
}: ExampleCardProps<T>) {
  const { english } = useWorkbenchText();
  return (
    <article className="example-card">
      <h3>{uiText(title)}</h3>
      <p>{uiText(description)}</p>
      {sampleText !== undefined && (
        <>
          <label>
            {english ? 'Input' : '输入示例'}
            <textarea
              aria-label={english ? 'Example input' : '示例输入'}
              value={sampleText}
              readOnly
              rows={3}
            />
          </label>
          <span className="example-arrow">
            <Glyph name="arrow" size={16} />
          </span>
        </>
      )}
      <label>
        {english ? 'Result' : '输出示例'}
        <textarea
          aria-label={english ? 'Example result' : '示例结果'}
          value={sampleResult}
          readOnly
          rows={3}
        />
      </label>
      <button
        className="secondary-button"
        onClick={() => changeInputResult(sampleText, sampleOptions)}
      >
        {english ? 'Use this example' : '使用此示例'}
        <Glyph name="arrow" size={16} />
      </button>
    </article>
  );
}
