import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { DefinedTool } from '@tools/defineTool';
import { launchActions } from '@tools/launch-actions';
import { validNamespaces } from '../../i18n';
import Glyph, { categoryGlyph } from './Glyph';
import ToolTileArt from './ToolTileArt';

export default function ToolTile({ tool }: { tool: DefinedTool }) {
  const { t } = useTranslation(validNamespaces);
  const actions = launchActions[tool.path];
  const title = t(tool.name);
  const target = tool.standalone ? '_blank' : undefined;
  const rel = tool.standalone ? 'noopener' : undefined;
  return (
    <article className="tool-tile launcher-card" data-category={tool.type}>
      <Link
        className="tile-link launcher-card-main"
        to={`/${tool.path}`}
        target={target}
        rel={rel}
        aria-label={tool.standalone ? `${title} · 在新标签页打开` : title}
      >
        <span className="tile-icon launcher-card-icon">
          <Glyph name={categoryGlyph[tool.type]} size={23} />
        </span>
        <div className="tile-content">
          <h2>{title}</h2>
          <p>{t(tool.shortDescription)}</p>
        </div>
        <ToolTileArt category={tool.type} />
        <span className="launcher-card-arrow">
          <Glyph name={tool.standalone ? 'external' : 'arrow'} size={17} />
        </span>
      </Link>
      {actions && (
        <div
          className="launcher-actions"
          role="group"
          aria-label={`${title} · 常用操作`}
        >
          {actions.map(({ label, to }) => (
            <Link
              key={to}
              to={to}
              target={target}
              rel={rel}
              title={tool.standalone ? `${label} · 在新标签页打开` : undefined}
            >
              {label}
            </Link>
          ))}
        </div>
      )}
    </article>
  );
}
