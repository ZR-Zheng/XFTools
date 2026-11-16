import { uiText } from 'i18n/uiText';
import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import {
  Link,
  useLocation,
  useParams,
  useSearchParams
} from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { filterTools, getToolsByCategory, tools } from '@tools/index';
import { validNamespaces } from '../../i18n';
import { useWorkbenchText } from '../../i18n/workbench';
import { useToolHistory } from '../../hooks/useToolHistory';
import { usePageTitle } from '../../hooks/usePageTitle';
import Glyph from '../../components/workbench/Glyph';
import ToolTile from '../../components/workbench/ToolTile';
const featuredPaths = [
  'json/prettify',
  'pdf/merge-pdf',
  'image-generic/resize',
  'string/base64',
  'png/compress-png',
  'list/sort'
];

export default function Home() {
  const { t } = useTranslation(validNamespaces);
  const { w } = useWorkbenchText();
  const { categoryName } = useParams();
  const location = useLocation();
  const [params, setParams] = useSearchParams();
  const query = params.get('q') || '';
  const deferredQuery = useDeferredValue(query);
  const [limit, setLimit] = useState(24);
  const searchRef = useRef<HTMLInputElement>(null);
  const { favorites, recent } = useToolHistory();
  const isFavorites = location.pathname === '/favorites';
  const isRecent = location.pathname === '/recent';
  const categories = getToolsByCategory([], t);
  const category = categories.find((c) => c.type === categoryName);
  const isHome = !isFavorites && !isRecent && !categoryName;
  const title = isFavorites
    ? w('favorites')
    : isRecent
      ? w('recent')
      : category?.rawTitle ||
        (categoryName ? w('categoryNotFound') : w('browse'));
  usePageTitle(isHome ? 'XFTools' : title);
  useEffect(() => {
    setLimit(24);
  }, [query, location.pathname]);
  useEffect(() => {
    const shortcut = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        searchRef.current?.focus();
      }
      if (
        event.key === 'Escape' &&
        document.activeElement === searchRef.current
      )
        searchRef.current?.blur();
    };
    window.addEventListener('keydown', shortcut);
    return () => window.removeEventListener('keydown', shortcut);
  }, []);
  const source = isFavorites
    ? tools.filter((tool) => favorites.includes(tool.path))
    : isRecent
      ? recent.flatMap((path) => tools.find((tool) => tool.path === path) || [])
      : categoryName
        ? category?.tools || []
        : tools;
  const filtered = useMemo(
    () => filterTools(source, deferredQuery, [], t),
    [source, deferredQuery, t]
  );
  const featured = featuredPaths
    .flatMap((path) => tools.find((tool) => tool.path === path) || [])
    .slice(0, 6);
  const setQuery = (value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set('q', value);
    else next.delete('q');
    setParams(next, { replace: true });
  };
  return (
    <div className="workspace-page">
      {isHome ? (
        <section className="welcome">
          <div className="welcome-copy">
            <h1>
              XFTools
              <span className="brand-period" aria-hidden="true">
                .
              </span>
            </h1>
            <p className="welcome-tagline">Small tools. Clear focus.</p>
            <div className="welcome-meta">
              <span>
                <strong>{tools.length}</strong> {w('tools')}
              </span>
              <i />
              <span>
                <strong>{categories.length}</strong> {w('groups')}
              </span>
              <i />
              <span>
                <Glyph name="check" size={15} />
                {w('free')}
              </span>
            </div>
          </div>
          <div className="workspace-art" aria-hidden="true">
            <div className="art-grid" />
            <div className="art-card art-one">
              <span className="art-mini">
                <Glyph name="image" size={23} />
              </span>
              <span>
                {uiText('Image studio')}
                <small>{uiText('CREATE SOMETHING NEW')}</small>
              </span>
              <Glyph name="arrow" size={18} />
            </div>
            <div className="art-card art-two">
              <span className="art-mini">
                <Glyph name="code" size={24} />
              </span>
              <span>
                {'{'} JSON {'}'}
              </span>
              <span className="art-code-line" />
            </div>
            <div className="art-card art-three">
              <span className="art-mini">
                <Glyph name="file" size={24} />
              </span>
              <span>
                {uiText('PDF workspace')}
                <small>{uiText('LESS WORK. MORE FLOW.')}</small>
              </span>
              <span className="art-check">
                <Glyph name="check" size={15} />
              </span>
            </div>
            <span className="art-spark">
              <Glyph name="sparkle" size={30} />
            </span>
            <div className="art-caption">
              <span className="status-dot" />
              {uiText('READY WHEN YOU ARE')}
            </div>
          </div>
        </section>
      ) : (
        <section className="page-intro">
          <h1>{uiText(title)}</h1>
          <p>
            {isFavorites
              ? w('favoritesSub')
              : isRecent
                ? w('recentSub')
                : category?.description}
          </p>
        </section>
      )}
      <section className="search-section" aria-label={w('search')}>
        <div className="search-box">
          <Glyph name="search" size={22} />
          <label className="sr-only" htmlFor="tool-search">
            {w('search')}
          </label>
          <input
            ref={searchRef}
            id="tool-search"
            type="search"
            placeholder={w('searchPlaceholder')}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            autoComplete="off"
          />
          {query ? (
            <button
              className="icon-button"
              aria-label={w('resetSearch')}
              onClick={() => setQuery('')}
            >
              <Glyph name="close" size={18} />
            </button>
          ) : (
            <kbd>Ctrl K</kbd>
          )}
        </div>
        {isHome && !query && (
          <div className="search-suggestions">
            <span>{w('searchHint')}</span>
            {['JSON', 'PDF', 'Base64'].map((word) => (
              <button key={word} onClick={() => setQuery(word)}>
                {word}
                <Glyph name="arrow" size={12} />
              </button>
            ))}
          </div>
        )}
      </section>
      {isHome && !query && featured.length > 0 && (
        <section className="featured-section">
          <div className="section-heading">
            <div>
              <h2>
                <Glyph name="sparkle" size={19} />
                {w('featured')}
              </h2>
            </div>
          </div>
          <div className="featured-grid">
            {featured.map((tool) => (
              <ToolTile
                key={tool.path}
                tool={tool}
                favorite={favorites.includes(tool.path)}
                compact
              />
            ))}
          </div>
        </section>
      )}
      <section className="catalog-section">
        <div
          className={`section-heading ${!isHome && !query ? 'catalog-count-only' : ''}`}
        >
          {(isHome || query) && (
            <div>
              <h2>{query ? w('results') : title}</h2>
              {query && <p>{`${w('resultsFor')} “${query}”`}</p>}
            </div>
          )}
          <span className="result-count" role="status" aria-live="polite">
            {filtered.length} {w('count')}
          </span>
        </div>
        {isHome && (
          <div className="category-tabs" aria-label={w('categories')}>
            <span className="category-tab active">
              {w('all')}
              <span>{tools.length}</span>
            </span>
            {categories.map((c) => (
              <Link
                className="category-tab"
                key={c.type}
                to={`/categories/${c.type}${query ? '?q=' + encodeURIComponent(query) : ''}`}
              >
                {uiText(c.rawTitle)}
              </Link>
            ))}
          </div>
        )}
        {filtered.length ? (
          <>
            <div className="tool-grid" aria-busy={query !== deferredQuery}>
              {filtered.slice(0, limit).map((tool) => (
                <ToolTile
                  key={tool.path}
                  tool={tool}
                  favorite={favorites.includes(tool.path)}
                />
              ))}
            </div>
            {filtered.length > limit && (
              <div className="load-more">
                <button
                  className="secondary-button"
                  onClick={() => setLimit(limit + 24)}
                >
                  {w('loadMore')}
                  <span>
                    {Math.min(limit, filtered.length)} / {filtered.length}
                  </span>
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="empty-state">
            <span className="empty-icon">
              <Glyph
                name={isFavorites ? 'star' : isRecent ? 'clock' : 'search'}
                size={32}
              />
            </span>
            <h2>
              {query
                ? w('empty')
                : isFavorites
                  ? w('emptyFavorites')
                  : isRecent
                    ? w('emptyRecent')
                    : w('empty')}
            </h2>
            <p>
              {query
                ? w('emptySearch')
                : isFavorites
                  ? w('emptyFavoritesSub')
                  : isRecent
                    ? w('emptyRecentSub')
                    : w('emptySearch')}
            </p>
            {query ? (
              <button className="primary-button" onClick={() => setQuery('')}>
                {w('clear')}
              </button>
            ) : (
              <Link className="primary-button" to="/">
                {w('browse')}
                <Glyph name="arrow" size={17} />
              </Link>
            )}
          </div>
        )}
      </section>
      {isHome && !query && (
        <aside className="workspace-tip">
          <span className="tip-icon">
            <Glyph name="star" size={25} />
          </span>
          <div>
            <span className="eyebrow">{w('tip')}</span>
            <h2>{w('tipTitle')}</h2>
            <p>{w('tipText')}</p>
          </div>
          <Link to="/favorites" className="text-link">
            {w('favorites')}
            <Glyph name="arrow" size={18} />
          </Link>
        </aside>
      )}
    </div>
  );
}
