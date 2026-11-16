import ToolLayout from '../components/ToolLayout';
import React, {
  JSXElementConstructor,
  LazyExoticComponent,
  useEffect,
  useState
} from 'react';
import { IconifyIcon } from '@tools/icon';
import { FullI18nKey, validNamespaces, ensureToolLocale } from '../i18n';
import Loading from '../components/Loading';
import { useTranslation } from 'react-i18next';
import {
  classifyTool,
  getToolInteraction,
  type ToolInteraction
} from './catalog';

export type UserType = 'generalUsers' | 'developers';

export interface ToolMeta {
  path: string;
  component: LazyExoticComponent<JSXElementConstructor<ToolComponentProps>>;
  keywords: string[];
  icon: IconifyIcon | string;
  alternativeCategories?: ToolCategory[];
  i18n: {
    name: FullI18nKey;
    description: FullI18nKey;
    shortDescription: FullI18nKey;
    longDescription?: FullI18nKey;
    userTypes?: UserType[];
  };
}

export type ToolCategory =
  | 'string'
  | 'image-generic'
  | 'png'
  | 'number'
  | 'gif'
  | 'list'
  | 'json'
  | 'time'
  | 'csv'
  | 'video'
  | 'pdf'
  | 'audio'
  | 'xml'
  | 'converters'
  | 'encoding'
  | 'security'
  | 'network'
  | 'calculator';

export interface DefinedTool {
  interaction: ToolInteraction;
  type: ToolCategory;
  alternativeCategories?: ToolCategory[];
  path: string;
  name: FullI18nKey;
  description: FullI18nKey;
  shortDescription: FullI18nKey;
  icon: IconifyIcon | string;
  keywords: string[];
  component: () => React.JSX.Element;
  userTypes?: UserType[];
}

export interface ToolComponentProps {
  title: string;
  longDescription?: string;
}

export const defineTool = (
  basePath: ToolCategory,
  options: ToolMeta
): DefinedTool => {
  const { icon, path, keywords, component, i18n, alternativeCategories } =
    options;
  const Component = component;
  const fullPath = `${basePath}/${path}`;
  const classification = classifyTool(
    fullPath,
    basePath,
    alternativeCategories
  );
  return {
    type: classification.primary,
    alternativeCategories: classification.alternativeCategories,
    interaction: getToolInteraction(fullPath, classification.primary),
    path: `${basePath}/${path}`,
    name: i18n.name,
    icon,
    description: i18n.description,
    shortDescription: i18n.shortDescription,
    keywords,
    userTypes: i18n.userTypes,
    component: function ToolComponent() {
      const { t } = useTranslation(validNamespaces);
      const [ready, setReady] = useState(false);
      const [error, setError] = useState('');
      useEffect(() => {
        let active = true;
        ensureToolLocale(i18n.name.split(':')[0])
          .then(() => {
            if (active) setReady(true);
          })
          .catch((error) => {
            if (active) setError(String(error));
          });
        return () => {
          active = false;
        };
      }, []);
      if (error)
        return (
          <p className="tool-inline-error" role="alert">
            {error}
          </p>
        );
      if (!ready) return <Loading />;
      return (
        <ToolLayout
          icon={icon}
          type={classification.primary}
          i18n={i18n}
          fullPath={`${basePath}/${path}`}
        >
          <Component
            title={t(i18n.name)}
            longDescription={
              i18n.longDescription ? t(i18n.longDescription) : undefined
            }
          />
        </ToolLayout>
      );
    }
  };
};
