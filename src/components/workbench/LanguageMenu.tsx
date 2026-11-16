import { useId, useState } from 'react';
import { Menu, MenuItem } from '@components/ui';
import { useTranslation } from 'react-i18next';
import Glyph from './Glyph';

const languages = [
  { code: 'zh', label: '简体中文' },
  { code: 'en', label: 'English' }
];

export default function LanguageMenu() {
  const { i18n } = useTranslation();
  const id = useId();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  return (
    <>
      <button
        type="button"
        className="language-trigger"
        aria-label="语言 / Language"
        aria-haspopup="menu"
        aria-expanded={Boolean(anchor)}
        aria-controls={anchor ? id : undefined}
        onClick={(event) => setAnchor(event.currentTarget)}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();
            setAnchor(event.currentTarget);
          }
        }}
      >
        <Glyph name="globe" size={17} />
        <span>{i18n.language === 'en' ? 'English' : '简体中文'}</span>
        <Glyph
          name="chevron"
          size={13}
          style={{ transform: 'rotate(90deg)' }}
        />
      </button>
      <Menu
        id={id}
        anchorEl={anchor}
        open={Boolean(anchor)}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{
          paper: { className: 'language-menu-paper' },
          list: { 'aria-label': '语言 / Language' }
        }}
      >
        {languages.map((language) => (
          <MenuItem
            key={language.code}
            role="menuitemradio"
            aria-checked={i18n.language === language.code}
            selected={i18n.language === language.code}
            onClick={() => {
              void i18n.changeLanguage(language.code);
              setAnchor(null);
            }}
          >
            <span>{language.label}</span>
            {i18n.language === language.code && (
              <Glyph name="check" size={17} />
            )}
          </MenuItem>
        ))}
      </Menu>
    </>
  );
}
