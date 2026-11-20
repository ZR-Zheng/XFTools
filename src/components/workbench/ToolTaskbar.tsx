import { useContext } from 'react';
import { useFormikContext } from 'formik';
import { ToolPageContext } from '../../tools/page-context';
import { useWorkbenchText } from 'i18n/workbench';
import Glyph from './Glyph';
import ToolHeaderActions from '../ToolHeaderActions';

export default function ToolTaskbar({
  onExample,
  canReset = true
}: {
  onExample?: () => void;
  canReset?: boolean;
}) {
  const { experience } = useContext(ToolPageContext);
  const { resetForm } = useFormikContext();
  const { english } = useWorkbenchText();
  if (!onExample && !canReset) return null;
  return (
    <ToolHeaderActions>
      <div className="tool-taskbar">
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
          {canReset && (
            <button
              type="button"
              className="text-link"
              onClick={() => resetForm()}
            >
              {english ? 'Reset options' : '重置参数'}
            </button>
          )}
        </div>
      </div>
    </ToolHeaderActions>
  );
}
