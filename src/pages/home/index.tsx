import { useEffect, useRef } from 'react';
import {
  Link,
  useLocation,
  useParams,
  useSearchParams
} from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { filterTools, getToolsByCategory, tools } from '@tools/index';
import { launchActions } from '@tools/launch-actions';
import { validNamespaces } from '../../i18n';
import { useWorkbenchText } from '../../i18n/workbench';
import { usePageTitle } from '../../hooks/usePageTitle';
import Glyph from '../../components/workbench/Glyph';
import ToolTile from '../../components/workbench/ToolTile';

const normalizeAction = (value: string) =>
  value.toLowerCase().replace(/\s+/g, '');

export default function Home() {
  const { t } = useTranslation(validNamespaces);
  const { w } = useWorkbenchText();
  const { categoryName } = useParams();
  const { pathname } = useLocation();
  const [params, setParams] = useSearchParams();
  const query = params.get('q') ?? '';
  const keyword = query.trim();
  const search = useRef<HTMLInputElement>(null);
  const results = useRef<HTMLDivElement>(null);
  const isHome = pathname === '/';
  const category = categoryName
    ? getToolsByCategory([], t).find((entry) => entry.type === categoryName)
    : undefined;
  const unknownCategory = Boolean(categoryName && !category);
  const title =
    category?.rawTitle ?? (isHome ? '工具箱' : w('categoryNotFound'));
  usePageTitle(isHome ? 'XFTools' : title);

  const source = categoryName ? (category?.tools ?? []) : tools;
  const actionQuery = normalizeAction(keyword);
  const firstActions = actionQuery
    ? source.filter((tool) =>
        launchActions[tool.path]?.some(
          ({ label }) => normalizeAction(label) === actionQuery
        )
      )
    : [];
  const matched = filterTools(source, keyword, [], t);
  const filtered = [
    ...firstActions,
    ...matched.filter((tool) => !firstActions.includes(tool))
  ];

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
        search.current
      ) {
        event.preventDefault();
        search.current.focus();
        search.current.select();
      }
    };
    window.addEventListener('keydown', onShortcut);
    return () => window.removeEventListener('keydown', onShortcut);
  }, []);

  const searchAvailable = source.length > 0;
  return (
    <div
      className="workspace-page launcher"
      data-view={isHome ? 'home' : undefined}
    >
      <header className="launcher-heading">
        <h1>{title}</h1>
        {searchAvailable && (
          <form
            className="launcher-search"
            role="search"
            onSubmit={(event) => {
              event.preventDefault();
              if (!keyword) return;
              const first = results.current?.querySelector('.launcher-card');
              const direct = Array.from(
                first?.querySelectorAll<HTMLAnchorElement>(
                  '.launcher-actions a'
                ) ?? []
              ).find(
                (link) =>
                  normalizeAction(link.textContent ?? '') === actionQuery
              );
              (
                direct ?? first?.querySelector<HTMLAnchorElement>('.tile-link')
              )?.click();
            }}
          >
            <Glyph name="search" size={20} />
            <input
              ref={search}
              aria-label={w('search')}
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
                  search.current?.focus();
                }}
              >
                <Glyph name="close" size={19} />
              </button>
            ) : (
              <kbd aria-hidden="true">Ctrl K</kbd>
            )}
          </form>
        )}
      </header>

      {keyword && searchAvailable && (
        <p className="launcher-result-count" role="status">
          {filtered.length} 个匹配工具
        </p>
      )}
      {filtered.length > 0 ? (
        <div className="tool-grid launcher-grid" ref={results}>
          {filtered.map((tool) => (
            <ToolTile key={tool.path} tool={tool} />
          ))}
        </div>
      ) : (
        <section className="empty-state launcher-empty">
          <span className="empty-icon">
            <Glyph name="search" size={29} />
          </span>
          {unknownCategory ? (
            <Link className="primary-button" to="/">
              {w('back')}
            </Link>
          ) : (
            <>
              <h2>{w('empty')}</h2>
              {keyword && searchAvailable ? (
                <p>试试工具名称或更短的关键词。</p>
              ) : (
                <Link className="primary-button" to="/">
                  {w('all')}
                  <Glyph name="arrow" size={17} />
                </Link>
              )}
            </>
          )}
        </section>
      )}
    </div>
  );
}
