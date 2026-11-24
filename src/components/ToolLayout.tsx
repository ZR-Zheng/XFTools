import { uiText } from 'i18n/uiText';
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { IconifyIcon } from '@tools/icon';
import { tools } from '@tools/index';
import type { ToolCategory } from '@tools/defineTool';
import { FullI18nKey, validNamespaces } from '../i18n';
import { usePageTitle } from '../hooks/usePageTitle';
import Glyph, { categoryGlyph } from './workbench/Glyph';
import { ToolInteractionContext } from '../tools/interaction';
import {
  ToolPageContext,
  ToolHeaderActionsContext
} from '../tools/page-context';
import { defaultExperience, toolExperiences } from '../tools/experiences';
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
  const [headerActions, setHeaderActions] = useState<HTMLElement | null>(null);
  const tool = tools.find((tool) => tool.path === fullPath);
  const title = i18n ? t(i18n.name) : tool ? t(tool.name) : '';
  const description = i18n ? t(i18n.shortDescription) : '';
  usePageTitle(title);
  return (
    <div
      className={
        tool?.standalone ? 'tool-page tool-page-standalone' : 'tool-page'
      }
    >
      {tool?.standalone ? (
        <h1 className="sr-only">{uiText(title)}</h1>
      ) : (
        <header className="tool-page-header">
          <div className="tool-heading">
            <span className="tool-heading-icon">
              <Glyph name={categoryGlyph[type]} size={20} />
            </span>
            <div className="tool-heading-copy">
              <h1>{uiText(title)}</h1>
              {description && (
                <p title={uiText(description)}>{uiText(description)}</p>
              )}
            </div>
            <div className="tool-heading-controls">
              <div className="tool-header-actions" ref={setHeaderActions} />
            </div>
          </div>
        </header>
      )}
      <ToolInteractionContext.Provider value={tool?.interaction || 'text'}>
        <ToolPageContext.Provider
          value={{
            path: fullPath,
            title,
            experience: toolExperiences[fullPath] || defaultExperience
          }}
        >
          <ToolHeaderActionsContext.Provider value={headerActions}>
            <div
              className="tool-workspace"
              data-interaction={tool?.interaction}
              data-experience={toolExperiences[fullPath]?.layout}
            >
              {children}
            </div>
          </ToolHeaderActionsContext.Provider>
        </ToolPageContext.Provider>
      </ToolInteractionContext.Provider>
    </div>
  );
}
