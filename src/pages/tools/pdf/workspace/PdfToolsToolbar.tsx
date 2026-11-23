import { useEffect, useRef, useState } from 'react';
import Glyph from '@components/workbench/Glyph';

type ToolAction = {
  label: string;
  icon: string;
  description?: string;
  active?: boolean;
  disabled?: boolean;
  danger?: boolean;
  run: () => void;
};
export type PdfToolGroup = {
  id: string;
  label: string;
  short?: string;
  icon: string;
  actions: ToolAction[];
};

export default function PdfToolsToolbar({
  groups,
  more,
  undo,
  redo,
  canUndo,
  canRedo,
  t
}: {
  groups: PdfToolGroup[];
  more: ToolAction[];
  undo: () => void;
  redo: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
  t: (zh: string, en: string) => string;
}) {
  const [open, setOpen] = useState<string | null>(null);
  const activeGroup = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const dismiss = (event: Event) => {
      if (!activeGroup.current?.contains(event.target as Node)) setOpen(null);
    };
    document.addEventListener('pointerdown', dismiss);
    document.addEventListener('focusin', dismiss);
    return () => {
      document.removeEventListener('pointerdown', dismiss);
      document.removeEventListener('focusin', dismiss);
    };
  }, [open]);
  const close = () => {
    setOpen(null);
    trigger.current?.focus({ preventScroll: true });
  };

  const renderGroup = ({ id, label, short, icon, actions }: PdfToolGroup) => {
    const expanded = open === id;
    const utilities = id === 'more';
    return (
      <div
        key={id}
        className={`pdf-tool-group ${utilities ? 'pdf-tool-utilities' : ''}`}
        ref={expanded ? activeGroup : undefined}
      >
        <button
          type="button"
          ref={expanded ? trigger : undefined}
          className={utilities ? 'pdf-icon-button' : 'pdf-tool-category'}
          aria-label={label}
          title={label}
          aria-expanded={expanded}
          aria-controls={`pdf-tools-${id}`}
          data-current={
            !utilities && actions.some((item) => item.active) ? true : undefined
          }
          onClick={() => setOpen(expanded ? null : id)}
        >
          <Glyph name={icon} size={utilities ? 21 : 17} />
          {!utilities && (
            <>
              <span className="pdf-tool-full">{label}</span>
              <span className="pdf-tool-short">{short || label}</span>
              <span className="pdf-tool-caret">
                <Glyph name="chevron-down" size={12} />
              </span>
            </>
          )}
        </button>
        <div
          className="pdf-tool-dropdown"
          id={`pdf-tools-${id}`}
          role="group"
          aria-label={label}
          hidden={!expanded}
        >
          {actions.map(
            ({
              label: action,
              description,
              icon: glyph,
              active,
              disabled,
              danger,
              run
            }) => (
              <button
                type="button"
                key={action}
                aria-label={action}
                className={`pdf-tool-entry ${danger ? 'pdf-danger' : ''}`}
                disabled={disabled}
                aria-pressed={utilities ? active : undefined}
                aria-current={!utilities && active ? true : undefined}
                onClick={() => {
                  close();
                  run();
                }}
              >
                <Glyph name={glyph} size={17} />
                <span>
                  <strong>{action}</strong>
                  {description && <small>{description}</small>}
                </span>
                {active && <Glyph name="check" size={15} />}
              </button>
            )
          )}
        </div>
      </div>
    );
  };
  return (
    <div
      className="pdf-tools-toolbar"
      role="group"
      aria-label={t('PDF 工具栏', 'PDF tools toolbar')}
      onKeyDown={(event) => {
        if (event.key === 'Escape' && open) {
          event.stopPropagation();
          close();
        }
      }}
    >
      <div className="pdf-tools-modes">{groups.map(renderGroup)}</div>
      <div className="pdf-tool-extras">
        <div className="pdf-edit-history">
          <button
            type="button"
            className="pdf-icon-button"
            aria-label={t('撤销', 'Undo')}
            title={t('撤销', 'Undo')}
            disabled={!canUndo}
            onClick={undo}
          >
            <Glyph name="undo" size={18} />
          </button>
          <button
            type="button"
            className="pdf-icon-button"
            aria-label={t('重做', 'Redo')}
            title={t('重做', 'Redo')}
            disabled={!canRedo}
            onClick={redo}
          >
            <Glyph name="redo" size={18} />
          </button>
        </div>
        {renderGroup({
          id: 'more',
          label: t('更多工具', 'More tools'),
          icon: 'more',
          actions: more
        })}
      </div>
    </div>
  );
}
