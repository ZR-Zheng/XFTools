import { useContext } from 'react';
import { useFormikContext } from 'formik';
import { ToolPageContext } from '../../tools/page-context';
import { useWorkbenchText } from 'i18n/workbench';
import Glyph from './Glyph';

export default function ToolTaskbar({ onExample }: { onExample?: () => void }) {
  const { experience } = useContext(ToolPageContext);
  const { values, setFieldValue, resetForm } =
    useFormikContext<Record<string, unknown>>();
  const { english } = useWorkbenchText();
  const separator = experience.separator;
  const presets = [
    ['\\n', '换行', 'Newline'],
    [',', '逗号', 'Comma'],
    [' ', '空格', 'Space'],
    ['\\t', 'Tab', 'Tab'],
    [';', '分号', 'Semicolon']
  ];
  return (
    <div className="tool-taskbar">
      {separator && (
        <label className="separator-quick-control">
          {english ? 'Items separated by' : '列表分隔方式'}
          <select
            className="ui-input"
            value={
              presets.some(([value]) => value === values[separator.input])
                ? String(values[separator.input])
                : '__custom'
            }
            onChange={(event) => {
              if (event.target.value === '__custom') {
                const advanced = event.currentTarget
                  .closest('.tool-workspace')
                  ?.querySelector<HTMLDetailsElement>('.advanced-tool-options');
                if (advanced) {
                  advanced.open = true;
                  advanced.scrollIntoView({ block: 'nearest' });
                }
                return;
              }
              void setFieldValue(separator.input, event.target.value);
              if (separator.operator && separator.operator in values)
                void setFieldValue(separator.operator, 'symbol');
            }}
          >
            {presets.map(([value, zh, en]) => (
              <option key={value} value={value}>
                {english ? en : zh}
              </option>
            ))}
            <option value="__custom">
              {english ? 'Custom (advanced options)' : '自定义（高级选项）'}
            </option>
          </select>
        </label>
      )}
      <div className="taskbar-actions">
        {onExample && (
          <button type="button" className="text-link" onClick={onExample}>
            <Glyph name="sparkle" size={15} />
            {experience.entry === 'file'
              ? english
                ? 'Apply a preset'
                : '应用预设'
              : english
                ? 'Load example'
                : '载入示例'}
          </button>
        )}
        <button type="button" className="text-link" onClick={() => resetForm()}>
          {english ? 'Reset options' : '重置参数'}
        </button>
      </div>
    </div>
  );
}
