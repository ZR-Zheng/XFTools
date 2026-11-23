import { useRef, useState, type PointerEvent } from 'react';
import Glyph from '@components/workbench/Glyph';
import {
  isFormEdit,
  pointsBox,
  rotateBox,
  rotatePoint,
  type Box,
  type EditKind,
  type PageEdit,
  type Point
} from '../shared/page-edits';

export type Placement = { kind: EditKind; pageId?: string; edit?: PageEdit };
export type NewGeometry = Pick<PageEdit, 'box' | 'angle' | 'points'>;

function defaultBox(point: Point, kind: EditKind, aspect: number): Box {
  const small = kind === 'note' || kind === 'radio' || kind === 'checkbox';
  const width = small ? 0.043 : kind === 'highlight' ? 0.24 : 0.29;
  const height = Math.min(
    0.25,
    small ? width * aspect : kind === 'textarea' ? 0.13 : 0.055
  );
  return {
    x: Math.min(point.x, 1 - width),
    y: Math.min(point.y, 1 - height),
    width,
    height
  };
}

function presentation(box: Box) {
  return {
    left: `${box.x * 100}%`,
    top: `${box.y * 100}%`,
    width: `${box.width * 100}%`,
    height: `${box.height * 100}%`
  };
}

function pointInPage(event: PointerEvent<HTMLElement>): Point {
  const rect = event.currentTarget.getBoundingClientRect();
  const fit = (value: number) => Math.max(0, Math.min(1, value));
  return {
    x: fit((event.clientX - rect.left) / rect.width),
    y: fit((event.clientY - rect.top) / rect.height)
  };
}

function markLabel(edit: PageEdit, t: (zh: string, en: string) => string) {
  return (
    edit.name ||
    edit.text ||
    (edit.kind === 'highlight'
      ? t('高亮', 'Highlight')
      : edit.kind === 'ink'
        ? t('手绘', 'Ink')
        : t('批注', 'Annotation'))
  );
}

export default function PdfEditLayer({
  edits,
  angle,
  placement,
  selected,
  onSelect,
  onPlace,
  t
}: {
  edits: readonly PageEdit[];
  angle: number;
  placement: Placement | null;
  selected?: string;
  onSelect: (edit: PageEdit) => void;
  onPlace: (geometry: NewGeometry) => void;
  t: (zh: string, en: string) => string;
}) {
  const stroke = useRef<{ pointer: number; points: Point[] } | null>(null);
  const [draft, setDraft] = useState<Point[]>([]);
  const finish = (event: PointerEvent<HTMLDivElement>) => {
    if (!placement || stroke.current?.pointer !== event.pointerId) return;
    const points = [...stroke.current.points, pointInPage(event)];
    stroke.current = null;
    setDraft([]);
    if (placement.kind === 'ink') {
      const path = points.map((point) => rotatePoint(point, -angle));
      if (path.length > 2)
        onPlace({ box: pointsBox(path), points: path, angle });
      return;
    }
    const boundary = pointsBox(points);
    const rect = event.currentTarget.getBoundingClientRect();
    const box =
      boundary.width > 0.02 &&
      boundary.height > 0.015 &&
      placement.kind !== 'note'
        ? boundary
        : defaultBox(points[0], placement.kind, rect.width / rect.height);
    onPlace({ box: rotateBox(box, -angle), angle });
  };

  return (
    <div className="pdf-edit-layer">
      {edits.map((edit) => {
        const box = rotateBox(edit.box, angle);
        const style = presentation(box);
        const title = markLabel(edit, t);
        return (
          <div
            key={edit.id}
            className={`pdf-mark pdf-mark-${edit.kind} ${selected === edit.id ? 'is-current' : ''}`}
            style={{ ...style, ['--mark-color' as string]: edit.color }}
          >
            {edit.kind === 'ink' && (
              <svg
                viewBox="0 0 100 100"
                preserveAspectRatio="none"
                aria-hidden="true"
              >
                <polyline
                  points={(edit.points ?? [])
                    .map((point) => {
                      const turned = rotatePoint(point, angle);
                      return `${((turned.x - box.x) * 100) / (box.width || 1)},${((turned.y - box.y) * 100) / (box.height || 1)}`;
                    })
                    .join(' ')}
                  fill="none"
                  stroke={edit.color}
                  vectorEffect="non-scaling-stroke"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            )}
            <button
              type="button"
              aria-label={`${t('编辑', 'Edit')} ${title}`}
              title={title}
              onClick={() => onSelect(edit)}
            >
              {edit.kind === 'note' ? (
                <Glyph name="text" size={14} />
              ) : edit.kind === 'checkbox' ? (
                edit.checked ? (
                  '☑'
                ) : (
                  '☐'
                )
              ) : edit.kind === 'radio' ? (
                edit.checked ? (
                  '◉'
                ) : (
                  '○'
                )
              ) : edit.kind === 'freeText' || isFormEdit(edit.kind) ? (
                edit.text || edit.name
              ) : null}
            </button>
          </div>
        );
      })}
      {placement && (
        <div
          className="pdf-place-target"
          onPointerDown={(event) => {
            if (event.button !== 0 || stroke.current) return;
            event.currentTarget.setPointerCapture(event.pointerId);
            const points = [pointInPage(event)];
            stroke.current = { pointer: event.pointerId, points };
            setDraft(points);
          }}
          onPointerMove={(event) => {
            const active = stroke.current;
            if (active?.pointer !== event.pointerId) return;
            const point = pointInPage(event);
            if (placement.kind === 'ink') active.points.push(point);
            else active.points[1] = point;
            setDraft([...active.points]);
          }}
          onPointerUp={finish}
          onPointerCancel={() => {
            stroke.current = null;
            setDraft([]);
          }}
        >
          {draft.length > 1 &&
            (placement.kind === 'ink' ? (
              <svg
                viewBox="0 0 100 100"
                preserveAspectRatio="none"
                aria-hidden="true"
              >
                <polyline
                  points={draft
                    .map(({ x, y }) => `${x * 100},${y * 100}`)
                    .join(' ')}
                  fill="none"
                  stroke="#176852"
                  strokeWidth="2"
                  vectorEffect="non-scaling-stroke"
                />
              </svg>
            ) : (
              <div
                className="pdf-placement-draft"
                style={presentation(pointsBox(draft))}
              />
            ))}
        </div>
      )}
    </div>
  );
}
