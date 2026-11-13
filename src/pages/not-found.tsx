import { Link } from 'react-router-dom';
import { useWorkbenchText } from '../i18n/workbench';
import { usePageTitle } from '../hooks/usePageTitle';
export default function NotFound() {
  const { w } = useWorkbenchText();
  usePageTitle(w('notFound'));
  return (
    <div className="empty-state not-found">
      <span className="error-code">404</span>
      <h1>{w('notFound')}</h1>
      <p>{w('notFoundSub')}</p>
      <Link to="/" className="primary-button">
        {w('back')}
      </Link>
    </div>
  );
}
