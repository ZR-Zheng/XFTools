import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { DefinedTool } from '@tools/defineTool';
import { validNamespaces } from '../../i18n';
import { useWorkbenchText, WorkbenchKey } from '../../i18n/workbench';
import { toggleBookmarked } from '@utils/bookmark';
import Glyph, { categoryGlyph } from './Glyph';

export default function ToolTile({
  tool,
  favorite,
  compact = false
}: {
  tool: DefinedTool;
  favorite: boolean;
  compact?: boolean;
}) {
  const { t } = useTranslation(validNamespaces);
  const { w } = useWorkbenchText();
  return (
    <article
      className={`tool-tile ${compact ? 'tool-tile-compact' : ''}`}
      data-category={tool.type}
    >
      <Link className="tile-link" to={`/${tool.path}`}>
        <span className="tile-icon">
          <Glyph name={categoryGlyph[tool.type]} size={compact ? 22 : 25} />
        </span>
        <div className="tile-content">
          <h3>{t(tool.name)}</h3>
          {!compact && <p>{t(tool.shortDescription)}</p>}
        </div>
        {compact ? (
          <Glyph name="chevron" size={17} />
        ) : (
          <span className="tile-bottom">
            <span>
              {w(
                (tool.type === 'image-generic'
                  ? 'image'
                  : tool.type) as WorkbenchKey
              )}
            </span>
            <Glyph name="arrow" size={17} />
          </span>
        )}
      </Link>
      {!compact && (
        <button
          className={`favorite-button ${favorite ? 'is-favorite' : ''}`}
          aria-label={`${w(favorite ? 'removeFavorite' : 'addFavorite')} · ${t(tool.name)}`}
          aria-pressed={favorite}
          onClick={() => toggleBookmarked(tool.path)}
        >
          <Glyph name="star" size={18} filled={favorite} />
        </button>
      )}
    </article>
  );
}
