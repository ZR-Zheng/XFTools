import Glyph from '../workbench/Glyph';
import type { CSSProperties } from 'react';
const icon = (name: string) =>
  function ToolIcon({
    fontSize,
    sx,
    style
  }: {
    fontSize?: string;
    sx?: unknown;
    style?: CSSProperties;
  }) {
    return (
      <Glyph name={name} size={fontSize === 'small' ? 18 : 21} style={style} />
    );
  };
export const AddIcon = icon('add');
export const ClearIcon = icon('close');
export const ContentPasteIcon = icon('copy');
export const DeleteIcon = icon('trash');
export const DownloadIcon = icon('download');
export const ImageIcon = icon('image');
export const MusicNoteIcon = icon('audio');
export const PaletteIcon = icon('palette');
export const PictureAsPdfIcon = icon('file');
export const PublishIcon = icon('upload');
export const VideoFileIcon = icon('video');
