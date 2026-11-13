import { uiText } from 'i18n/uiText';
import { useEffect, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { IconifyIcon } from '@iconify/react';
import { tools, getToolsByCategory } from '@tools/index';
import type { ToolCategory } from '@tools/defineTool';
import { FullI18nKey, validNamespaces } from '../i18n';
import { useWorkbenchText } from '../i18n/workbench';
import { usePageTitle } from '../hooks/usePageTitle';
import { recordTool, useToolHistory } from '../hooks/useToolHistory';
import { toggleBookmarked } from '@utils/bookmark';
import Glyph, { categoryGlyph } from './workbench/Glyph';
import ToolTile from './workbench/ToolTile';
export default function ToolLayout({
  children,
  type,
  fullPath,
  i18n
}: {
  icon?: IconifyIcon | string;
  type: ToolCategory;
  fullPath: string;
  children: ReactNode;
  i18n?: {
    name: FullI18nKey;
    description: FullI18nKey;
    shortDescription: FullI18nKey;
  };
}) {
  const { t } = useTranslation(validNamespaces);
  const { w } = useWorkbenchText();
  const { favorites } = useToolHistory();
  const tool = tools.find((tool) => tool.path === fullPath);
  const title = i18n ? t(i18n.name) : tool ? t(tool.name) : '';
  const description = i18n ? t(i18n.description) : '';
  const category = getToolsByCategory([], t).find((c) => c.type === type);
  const related =
    category?.tools.filter((tool) => tool.path !== fullPath).slice(0, 6) || [];
  const favorite = favorites.includes(fullPath);
  usePageTitle(title);
  useEffect(() => {
    recordTool(fullPath);
  }, [fullPath]);
  return (
    <div className="tool-page">
      <nav className="tool-breadcrumb" aria-label={uiText('Breadcrumb')}>
        <Link to="/">{w('all')}</Link>
        <Glyph name="chevron" size={12} />
        <Link to={`/categories/${type}`}>{uiText(category?.rawTitle)}</Link>
        <Glyph name="chevron" size={12} />
        <span aria-current="page">{uiText(title)}</span>
      </nav>
      <header className="tool-heading">
        <span className="tool-heading-icon">
          <Glyph name={categoryGlyph[type]} size={28} />
        </span>
        <div className="tool-heading-copy">
          <h1>{uiText(title)}</h1>
          <p>{uiText(description)}</p>
          <span className="tool-local-badge">
            <Glyph name="shield" size={14} />
            {w('localDetail')}
          </span>
        </div>
        <button
          className={`favorite-button ${favorite ? 'is-favorite' : ''}`}
          aria-label={w(favorite ? 'removeFavorite' : 'addFavorite')}
          aria-pressed={favorite}
          onClick={() => toggleBookmarked(fullPath)}
        >
          <Glyph name="star" filled={favorite} />
        </button>
      </header>
      <div className="tool-workspace">{children}</div>
      {related.length > 0 && (
        <section className="tool-related">
          <h2>{w('related')}</h2>
          <div className="featured-grid">
            {related.map((tool) => (
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
    </div>
  );
}
