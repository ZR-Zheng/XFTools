import { useEffect, useLayoutEffect, useRef } from 'react';
import Glyph from '@components/workbench/Glyph';

export type PageMenuAnchor = {
  id: string;
  x: number;
  y: number;
  trigger: HTMLElement;
};

export default function PdfPageMenu({
  anchor,
  label,
  actions,
  onClose
}: {
  anchor: PageMenuAnchor;
  label: string;
  actions: {
    label: string;
    icon: string;
    run: () => void;
    danger?: boolean;
    disabled?: boolean;
  }[];
  onClose: () => void;
}) {
  const menu = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const element = menu.current;
    if (!element) return;
    const gap = 6;
    element.style.left = `${Math.max(gap, Math.min(anchor.x, window.innerWidth - element.offsetWidth - gap))}px`;
    element.style.top = `${Math.max(gap, Math.min(anchor.y, window.innerHeight - element.offsetHeight - gap))}px`;
    element.querySelector('button')?.focus({ preventScroll: true });
  }, [anchor]);

  useEffect(() => {
    const dismiss = (event: Event) => {
      if (!menu.current?.contains(event.target as Node)) onClose();
    };
    document.addEventListener('pointerdown', dismiss);
    document.addEventListener('scroll', dismiss, true);
    window.addEventListener('resize', onClose);
    return () => {
      document.removeEventListener('pointerdown', dismiss);
      document.removeEventListener('scroll', dismiss, true);
      window.removeEventListener('resize', onClose);
    };
  }, [onClose]);

  const closeAndFocus = () => {
    onClose();
    anchor.trigger.focus({ preventScroll: true });
  };
  return (
    <div
      className="pdf-page-menu"
      role="menu"
      aria-label={label}
      ref={menu}
      onKeyDown={(event) => {
        if (event.key === 'Escape' || event.key === 'Tab') {
          if (event.key === 'Escape') event.preventDefault();
          closeAndFocus();
          return;
        }
        const buttons = Array.from(
          event.currentTarget.querySelectorAll<HTMLButtonElement>(
            'button:not(:disabled)'
          )
        );
        const index = buttons.indexOf(
          document.activeElement as HTMLButtonElement
        );
        const destinations: Partial<Record<string, number>> = {
          ArrowDown: (index + 1) % buttons.length,
          ArrowUp: (index + buttons.length - 1) % buttons.length,
          Home: 0,
          End: buttons.length - 1
        };
        const next = destinations[event.key];
        if (next === undefined) return;
        event.preventDefault();
        buttons[next]?.focus();
      }}
    >
      {actions.map(({ label, icon, run, danger, disabled }) => (
        <button
          type="button"
          role="menuitem"
          tabIndex={-1}
          disabled={disabled}
          className={danger ? 'pdf-danger' : undefined}
          key={label}
          onClick={() => {
            closeAndFocus();
            run();
          }}
        >
          <Glyph name={icon} size={16} />
          {label}
        </button>
      ))}
    </div>
  );
}
