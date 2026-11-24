import { Link } from 'react-router-dom';
import { useWorkbenchText } from '../../i18n/workbench';
import Glyph from '../workbench/Glyph';

export default function Navbar() {
  const { w } = useWorkbenchText();
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
        </div>
      </header>
    </>
  );
}
