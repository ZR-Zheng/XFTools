import { useContext, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { ToolHeaderActionsContext } from '../tools/page-context';

/** Portals preserve the tool's state and form context while sharing one header. */
export default function ToolHeaderActions({
  children
}: {
  children: ReactNode;
}) {
  const host = useContext(ToolHeaderActionsContext);
  return host ? (
    createPortal(children, host)
  ) : (
    <div className="tool-inline-actions">{children}</div>
  );
}
