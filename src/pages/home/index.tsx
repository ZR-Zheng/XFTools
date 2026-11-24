import {
  Link,
  useLocation,
  useParams,
  useSearchParams
} from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { filterTools, getToolsByCategory, tools } from '@tools/index';
import { launchActions, normalizeLauncherAction } from '@tools/launch-actions';
import { validNamespaces } from '../../i18n';
import { useWorkbenchText } from '../../i18n/workbench';
import { usePageTitle } from '../../hooks/usePageTitle';
import Glyph from '../../components/workbench/Glyph';
import ToolTile from '../../components/workbench/ToolTile';

export default function Home() {
  const { t } = useTranslation(validNamespaces);
  const { w } = useWorkbenchText();
  const { categoryName } = useParams();
  const { pathname } = useLocation();
  const [params] = useSearchParams();
  const keyword = (params.get('q') ?? '').trim();
  const isHome = pathname === '/';
  const category = categoryName
    ? getToolsByCategory([], t).find((entry) => entry.type === categoryName)
    : undefined;
  const unknownCategory = Boolean(categoryName && !category);
  const title =
    category?.rawTitle ?? (isHome ? '工具箱' : w('categoryNotFound'));
  usePageTitle(isHome ? 'XFTools' : title);

  const source = categoryName ? (category?.tools ?? []) : tools;
  const actionQuery = normalizeLauncherAction(keyword);
  const firstActions = actionQuery
    ? source.filter((tool) =>
        launchActions[tool.path]?.some(
          ({ label }) => normalizeLauncherAction(label) === actionQuery
        )
      )
    : [];
  const matched = filterTools(source, keyword, [], t);
  const filtered = [
    ...firstActions,
    ...matched.filter((tool) => !firstActions.includes(tool))
  ];

  const searchAvailable = source.length > 0;
  return (
    <div className="workspace-page launcher">
      <h1 className={isHome ? 'sr-only' : 'launcher-heading'}>{title}</h1>

      <div id="launcher-results">
        {keyword && searchAvailable && (
          <p className="launcher-result-count" role="status">
            {filtered.length} 个匹配工具
          </p>
        )}
        {filtered.length > 0 ? (
          <div className="tool-grid launcher-grid">
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
    </div>
  );
}
