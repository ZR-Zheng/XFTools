import { CircularProgress } from '@components/ui';
import { useWorkbenchText } from '../i18n/workbench';
export default function Loading() {
  const { english } = useWorkbenchText();
  return (
    <div
      role="status"
      style={{
        minHeight: 320,
        display: 'grid',
        placeContent: 'center',
        justifyItems: 'center',
        gap: 18
      }}
    >
      <CircularProgress size={26} />
      <span style={{ fontSize: 13 }}>
        {english ? 'Loading your workspace…' : '正在准备工具…'}
      </span>
    </div>
  );
}
