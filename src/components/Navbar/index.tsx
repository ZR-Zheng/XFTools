import { useEffect, useRef } from 'react';
import { Link, useMatch, useSearchParams } from 'react-router-dom';
import { getToolCategories, tools } from '@tools/index';
import { normalizeLauncherAction } from '@tools/launch-actions';
import { useWorkbenchText } from '../../i18n/workbench';
import Glyph from '../workbench/Glyph';

function LauncherSearch() {
  const { w } = useWorkbenchText();
  const [params, setParams] = useSearchParams();
  const query = params.get('q') ?? '';
  const input = useRef<HTMLInputElement>(null);

  function setQuery(value: string) {
    const next = new URLSearchParams(params);
    if (value) next.set('q', value);
    else next.delete('q');
    setParams(next, { replace: true });
  }

  useEffect(() => {
    const onShortcut = (event: KeyboardEvent) => {
      if (
        (event.metaKey || event.ctrlKey) &&
        event.key.toLowerCase() === 'k' &&
        input.current
      ) {
        event.preventDefault();
        input.current.focus();
        input.current.select();
      }
    };
    window.addEventListener('keydown', onShortcut);
    return () => window.removeEventListener('keydown', onShortcut);
  }, []);

  return (
    <form
      className="launcher-search"
      role="search"
      onSubmit={(event) => {
        event.preventDefault();
        const keyword = normalizeLauncherAction(query);
        if (!keyword) return;
        const first = document.querySelector(
          '#launcher-results .launcher-card'
        );
        if (!first) return;
        const direct = Array.from(
          first.querySelectorAll<HTMLAnchorElement>('.launcher-actions a')
        ).find(
          (link) => normalizeLauncherAction(link.textContent ?? '') === keyword
        );
        (
          direct ?? first.querySelector<HTMLAnchorElement>('.tile-link')
        )?.click();
      }}
    >
      <Glyph name="search" size={19} />
      <input
        ref={input}
        aria-label={w('search')}
        aria-controls="launcher-results"
        type="search"
        placeholder="搜索工具或操作"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Escape' && query) {
            event.preventDefault();
            setQuery('');
          }
        }}
        autoComplete="off"
      />
      {query ? (
        <button
          type="button"
          className="launcher-search-clear"
          aria-label={w('resetSearch')}
          onClick={() => {
            setQuery('');
            input.current?.focus();
          }}
        >
          <Glyph name="close" size={18} />
        </button>
      ) : (
        <kbd aria-hidden="true">Ctrl K</kbd>
      )}
    </form>
  );
}

export default function Navbar() {
  const { w } = useWorkbenchText();
  const home = useMatch('/');
  const category = useMatch('/categories/:categoryName')?.params.categoryName;
  const showSearch =
    home ||
    (category &&
      tools.some((tool) =>
        getToolCategories(tool).some((type) => type === category)
      ));
  return (
    <>
      <a className="skip-link" href="#main-content">
        {w('skip')}
      </a>
      <header className="launcher-bar">
        <div className="launcher-bar-inner">
          <Link className="launcher-brand" to="/" aria-label="XFTools">
            <span className="launcher-brand-mark">
              <Glyph name="grid" size={21} />
            </span>
            <span className="launcher-wordmark">
              XF<span>Tools</span>
            </span>
          </Link>
          {showSearch && <LauncherSearch />}
        </div>
      </header>
    </>
  );
}
