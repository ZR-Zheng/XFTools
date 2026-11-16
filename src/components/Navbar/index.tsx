import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Drawer } from '@components/ui';
import { tools, getToolsByCategory } from '@tools/index';
import { validNamespaces } from '../../i18n';
import { useWorkbenchText, WorkbenchKey } from '../../i18n/workbench';
import { useToolHistory } from '../../hooks/useToolHistory';
import Glyph, { categoryGlyph } from '../workbench/Glyph';

export default function Navbar() {
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
  const sidebar = (
    <div className="sidebar-inner">
      <Link className="brand" to="/" aria-label="XFTools">
        <span className="brand-mark">
          <Glyph name="grid" size={22} />
        </span>
        <span>
          XF<span className="brand-light">Tools</span>
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
        <span className="sidebar-processing">
          <Glyph name="shield" size={15} />
          {w('privacy')}
        </span>
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
        {open ? sidebar : null}
      </Drawer>
      <button
        type="button"
        ref={menuButton}
        className="mobile-nav-toggle"
        onClick={() => setOpen(true)}
        aria-label={w('menu')}
        aria-expanded={open}
      >
        <Glyph name="menu" size={20} />
        <span>导航</span>
      </button>
    </>
  );
}
