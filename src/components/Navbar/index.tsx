import { uiText } from 'i18n/uiText';
import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Drawer } from '@components/ui';
import { tools, getToolsByCategory } from '@tools/index';
import { validNamespaces } from '../../i18n';
import { useWorkbenchText, WorkbenchKey } from '../../i18n/workbench';
import { useToolHistory } from '../../hooks/useToolHistory';
import Glyph, { categoryGlyph } from '../workbench/Glyph';
import type { Mode } from '../App';
import LanguageMenu from '../workbench/LanguageMenu';

export default function Navbar({
  mode,
  onChangeMode
}: {
  mode: Mode;
  onChangeMode: () => void;
}) {
  const { t } = useTranslation(validNamespaces);
  const { w } = useWorkbenchText();
  const { favorites } = useToolHistory();
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const menuButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    setOpen(false);
  }, [location.pathname, location.search]);
  const categories = getToolsByCategory([], t);
  const title =
    location.pathname === '/favorites'
      ? w('favorites')
      : location.pathname === '/recent'
        ? w('recent')
        : w('workspace');
  const sidebar = (
    <div className="sidebar-inner">
      <Link className="brand" to="/" aria-label="XFTools">
        <span className="brand-mark">
          <Glyph name="grid" size={22} />
        </span>
        <span>
          XF<span className="brand-light">Tools</span>
          <small>{w('tagline')}</small>
        </span>
      </Link>
      <nav aria-label={w('navigation')} className="side-nav">
        <NavLink to="/" end className="nav-item">
          <Glyph name="grid" />
          <span>{w('all')}</span>
          <span className="nav-count">{tools.length}</span>
        </NavLink>
        <NavLink to="/favorites" className="nav-item">
          <Glyph name="star" />
          <span>{w('favorites')}</span>
          {favorites.length > 0 && (
            <span className="nav-count">{favorites.length}</span>
          )}
        </NavLink>
        <NavLink to="/recent" className="nav-item">
          <Glyph name="clock" />
          <span>{w('recent')}</span>
        </NavLink>
        <p className="nav-caption">{w('categories')}</p>
        {categories.map((category) => (
          <NavLink
            key={category.type}
            to={`/categories/${category.type}`}
            className="nav-item category-nav"
          >
            <Glyph name={categoryGlyph[category.type]} size={18} />
            <span>
              {w(
                (category.type === 'image-generic'
                  ? 'image'
                  : category.type) as WorkbenchKey
              )}
            </span>
            <span className="category-count">{category.tools.length}</span>
          </NavLink>
        ))}
      </nav>
      <div className="sidebar-bottom">
        <span className="version">v{__APP_VERSION__}</span>
      </div>
    </div>
  );
  return (
    <>
      <a className="skip-link" href="#main-content">
        {w('skip')}
      </a>
      <aside className="sidebar">{sidebar}</aside>
      <Drawer
        open={open}
        onClose={() => setOpen(false)}
        slotProps={{
          paper: { sx: { width: 264, background: '#161b25', color: '#fff' } }
        }}
      >
        {sidebar}
      </Drawer>
      <header className="topbar">
        <div className="topbar-title">
          <button
            ref={menuButton}
            className="icon-button mobile-menu"
            onClick={() => setOpen(true)}
            aria-label={w('menu')}
            aria-expanded={open}
          >
            <Glyph name="menu" />
          </button>
          <span className="topbar-home">XFTools</span>
          <Glyph name="chevron" size={14} />
          <span>{uiText(title)}</span>
        </div>
        <div className="topbar-actions">
          <span className="privacy-badge">
            <Glyph name="shield" size={15} />
            {w('privacy')}
          </span>
          <LanguageMenu />
          <span className="toolbar-divider" />
          <button
            className="icon-button"
            onClick={onChangeMode}
            aria-label={w(mode === 'dark' ? 'light' : 'dark')}
            title={w(mode === 'dark' ? 'light' : 'dark')}
          >
            <Glyph name={mode === 'dark' ? 'sun' : 'moon'} size={19} />
          </button>
        </div>
      </header>
    </>
  );
}
