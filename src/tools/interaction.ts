import { createContext } from 'react';
import type { ToolInteraction } from './catalog';
export const ToolInteractionContext = createContext<ToolInteraction>('text');
