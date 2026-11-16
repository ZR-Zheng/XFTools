import { createContext } from 'react';
import { defaultExperience, type ToolExperience } from './experiences';
export const ToolPageContext = createContext<{
  path: string;
  title: string;
  experience: ToolExperience;
}>({ path: '', title: '', experience: defaultExperience });
export const ToolSourceContext = createContext<unknown>(undefined);
export const ToolResultVisibleContext = createContext(true);
