import type { ToolCategory } from '@tools/defineTool';
import Glyph from './Glyph';
import './launcher-art.css';

export default function ToolTileArt({ category }: { category: ToolCategory }) {
  switch (category) {
    case 'converters':
      return (
        <span className="tile-art art-convert" aria-hidden="true">
          <span className="art-convert-file" />
          <span className="art-convert-file" />
          <Glyph name="convert" size={30} />
        </span>
      );
    case 'image-generic':
      return (
        <span className="tile-art art-photo" aria-hidden="true">
          <span />
        </span>
      );
    case 'pdf':
      return (
        <span className="tile-art art-pdf" aria-hidden="true">
          <span />
          <span />
        </span>
      );
    case 'video':
      return (
        <span className="tile-art art-timeline" aria-hidden="true">
          <span className="art-player">
            <Glyph name="play" size={18} filled />
          </span>
          <span className="art-tracks" />
        </span>
      );
    case 'audio':
      return (
        <span className="tile-art art-wave" aria-hidden="true">
          {[18, 32, 47, 27, 57, 70, 34, 54, 22, 35, 16].map((height, index) => (
            <span key={index} style={{ height: `${height}%` }} />
          ))}
        </span>
      );
    case 'time':
      return (
        <span className="tile-art art-calendar" aria-hidden="true">
          <span className="art-calendar-page" />
          <span className="art-calendar-clock">
            <Glyph name="clock" size={30} />
          </span>
        </span>
      );
    case 'charts':
      return (
        <span className="tile-art art-chart" aria-hidden="true">
          <Glyph name="chart" size={48} />
        </span>
      );
    default:
      return null;
  }
}
