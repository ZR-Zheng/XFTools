import type { MaskMode } from '../generic/create-transparent/service';

export type Size = { width: number; height: number };
export type Rect = Size & { x: number; y: number };
export type ImageSource = Size & { file: File; image: HTMLImageElement };
export type WatermarkPosition =
  'top-left' | 'top-right' | 'center' | 'bottom-left' | 'bottom-right';

export type DraftEdit =
  | { type: 'crop'; rect: Rect; circle: boolean }
  | { type: 'rotate'; angle: number; flipX: boolean; flipY: boolean }
  | { type: 'resize'; width: number; height: number }
  | { type: 'color'; brightness: number; contrast: number; saturation: number }
  | {
      type: 'mask';
      enabled: boolean;
      mode: MaskMode;
      from: string;
      to: string;
      tolerance: number;
    }
  | {
      type: 'opacity';
      percent: number;
      mode: 'solid' | 'linear' | 'radial-in' | 'radial-out';
      background: string | null;
      area: Rect;
    }
  | {
      type: 'watermark';
      text: string;
      color: string;
      percent: number;
      size: number;
      position: WatermarkPosition;
    };

export type Edit = DraftEdit | { type: 'background'; result: ImageSource };
export type ImageTool = DraftEdit['type'];
export const maxCanvasSide = 8192;
export const maxCanvasPixels = 24_000_000;

export function isCanvasSize({ width, height }: Size) {
  return (
    Number.isInteger(width) &&
    Number.isInteger(height) &&
    width > 0 &&
    height > 0 &&
    width <= maxCanvasSide &&
    height <= maxCanvasSide &&
    width * height <= maxCanvasPixels
  );
}

export function editSize(size: Size, edit: Edit): Size {
  if (edit.type === 'crop') return edit.rect;
  if (edit.type === 'resize') return edit;
  if (edit.type === 'background') return edit.result;
  if (edit.type !== 'rotate') return size;
  const radians = (edit.angle * Math.PI) / 180;
  const sin = Math.abs(Math.sin(radians));
  const cos = Math.abs(Math.cos(radians));
  return {
    width: Math.ceil(size.width * cos + size.height * sin - 1e-8),
    height: Math.ceil(size.width * sin + size.height * cos - 1e-8)
  };
}

export function outputSize(size: Size, edits: readonly Edit[]): Size {
  return edits.reduce(editSize, size);
}

function initialDraft(
  tool: ImageTool,
  size: Size,
  maskMode: MaskMode
): DraftEdit {
  switch (tool) {
    case 'crop':
      return {
        type: tool,
        rect: { x: 0, y: 0, width: size.width, height: size.height },
        circle: false
      };
    case 'rotate':
      return { type: tool, angle: 0, flipX: false, flipY: false };
    case 'resize':
      return { type: tool, width: size.width, height: size.height };
    case 'color':
      return { type: tool, brightness: 100, contrast: 100, saturation: 100 };
    case 'mask':
      return {
        type: tool,
        enabled: false,
        mode: maskMode,
        from: '#ffffff',
        to: '#000000',
        tolerance: 10
      };
    case 'opacity':
      return {
        type: tool,
        percent: 100,
        mode: 'solid',
        background: null,
        area: { x: 0, y: 0, width: size.width, height: size.height }
      };
    case 'watermark':
      return {
        type: tool,
        text: '',
        color: '#ffffff',
        percent: 80,
        size: 8,
        position: 'bottom-right'
      };
  }
}

export function hasEdit(edit: DraftEdit | null, size: Size | null): boolean {
  if (!edit || !size) return false;
  switch (edit.type) {
    case 'crop':
      return (
        edit.circle ||
        edit.rect.x !== 0 ||
        edit.rect.y !== 0 ||
        edit.rect.width !== size.width ||
        edit.rect.height !== size.height
      );
    case 'rotate':
      return edit.angle % 360 !== 0 || edit.flipX || edit.flipY;
    case 'resize':
      return edit.width !== size.width || edit.height !== size.height;
    case 'color':
      return (
        edit.brightness !== 100 ||
        edit.contrast !== 100 ||
        edit.saturation !== 100
      );
    case 'opacity':
      return (
        edit.percent !== 100 ||
        edit.mode !== 'solid' ||
        edit.background !== null
      );
    case 'mask':
      return edit.enabled;
    case 'watermark':
      return Boolean(edit.text.trim());
  }
}

export function validEdit(edit: Edit, size: Size): boolean {
  if (edit.type === 'resize') return isCanvasSize(edit);
  const area =
    edit.type === 'crop'
      ? edit.rect
      : edit.type === 'opacity' && edit.mode !== 'solid'
        ? edit.area
        : null;
  if (!area) return true;
  const { x, y, width, height } = area;
  return (
    [x, y, width, height].every(Number.isInteger) &&
    x >= 0 &&
    y >= 0 &&
    width >= 1 &&
    height >= 1 &&
    x + width <= size.width &&
    y + height <= size.height &&
    (edit.type !== 'crop' || !edit.circle || width === height)
  );
}

export type Session = {
  source: ImageSource | null;
  edits: readonly Edit[];
  undone: readonly Edit[];
  tool: ImageTool;
  maskMode: MaskMode;
  draft: DraftEdit | null;
};

export const initialSession: Session = {
  source: null,
  edits: [],
  undone: [],
  tool: 'crop',
  maskMode: 'transparent',
  draft: null
};

type Action =
  | { type: 'load'; source: ImageSource }
  | { type: 'tool'; tool: ImageTool; maskMode: MaskMode }
  | { type: 'draft'; draft: DraftEdit }
  | { type: 'background'; result: ImageSource }
  | { type: 'apply' | 'discard' | 'undo' | 'redo' };

export function imageSession(state: Session, action: Action): Session {
  if (action.type === 'load') {
    return {
      ...initialSession,
      source: action.source,
      tool: state.tool,
      maskMode: state.maskMode,
      draft: initialDraft(state.tool, action.source, state.maskMode)
    };
  }

  const { source, tool, edits, undone, draft } = state;
  if (!source)
    return action.type === 'tool'
      ? { ...state, tool: action.tool, maskMode: action.maskMode }
      : state;
  const size = outputSize(source, edits);
  const dirty = hasEdit(draft, size);
  switch (action.type) {
    case 'draft':
      return action.draft.type === tool
        ? { ...state, draft: action.draft }
        : state;
    case 'tool':
    case 'background':
    case 'apply': {
      const nextTool = action.type === 'tool' ? action.tool : tool;
      const maskMode =
        action.type === 'tool' ? action.maskMode : state.maskMode;
      if (
        action.type === 'tool' &&
        nextTool === tool &&
        maskMode === state.maskMode
      )
        return state;
      if (draft && dirty && !validEdit(draft, size)) return state;
      const committed = draft && dirty ? [...edits, draft] : edits;
      const nextEdits =
        action.type === 'background' ? [...committed, action] : committed;
      return {
        ...state,
        tool: nextTool,
        maskMode,
        edits: nextEdits,
        undone: nextEdits === edits ? undone : [],
        draft: initialDraft(nextTool, outputSize(source, nextEdits), maskMode)
      };
    }
    case 'discard':
      return { ...state, draft: initialDraft(tool, size, state.maskMode) };
    case 'undo': {
      if (dirty)
        return { ...state, draft: initialDraft(tool, size, state.maskMode) };
      const previous = edits.at(-1);
      if (!previous) return state;
      const nextEdits = edits.slice(0, -1);
      return {
        ...state,
        edits: nextEdits,
        undone: [...undone, previous],
        draft: initialDraft(tool, outputSize(source, nextEdits), state.maskMode)
      };
    }
    case 'redo': {
      const next = undone.at(-1);
      if (!next || dirty) return state;
      const nextEdits = [...edits, next];
      return {
        ...state,
        edits: nextEdits,
        undone: undone.slice(0, -1),
        draft: initialDraft(tool, outputSize(source, nextEdits), state.maskMode)
      };
    }
  }
}

export function canExportSvg(source: ImageSource, edits: readonly Edit[]) {
  return (
    (source.file.type === 'image/svg+xml' ||
      /\.svg$/i.test(source.file.name)) &&
    edits.every(
      (edit) =>
        edit.type === 'rotate' ||
        edit.type === 'resize' ||
        (edit.type === 'mask' && edit.mode === 'replace')
    )
  );
}
