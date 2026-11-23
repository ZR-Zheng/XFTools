import type { PDFPage } from 'pdf-lib';

export const annotationKinds = [
  'note',
  'highlight',
  'ink',
  'freeText'
] as const;
export const fieldKinds = [
  'text',
  'textarea',
  'checkbox',
  'radio',
  'label'
] as const;
export type AnnotationKind = (typeof annotationKinds)[number];
export type FieldKind = (typeof fieldKinds)[number];
export type EditKind = AnnotationKind | FieldKind;
export type Point = { x: number; y: number };
export type Box = Point & { width: number; height: number };
export type PageEdit = {
  id: string;
  kind: EditKind;
  // Coordinates are normalized in the unrotated visible page, from its top left.
  box: Box;
  angle: number;
  color: string;
  text: string;
  name: string;
  required: boolean;
  checked: boolean;
  points?: Point[];
};

export const isFormEdit = (kind: EditKind) =>
  fieldKinds.some((field) => field === kind);

export function pageCropBox(page: PDFPage): Box {
  const media = page.getMediaBox();
  const crop = page.getCropBox();
  const x = Math.max(crop.x, media.x);
  const y = Math.max(crop.y, media.y);
  const width = Math.min(crop.x + crop.width, media.x + media.width) - x;
  const height = Math.min(crop.y + crop.height, media.y + media.height) - y;
  return width > 0 && height > 0 ? { x, y, width, height } : media;
}

export function rotatePoint({ x, y }: Point, angle: number): Point {
  switch (((angle % 360) + 360) % 360) {
    case 90:
      return { x: 1 - y, y: x };
    case 180:
      return { x: 1 - x, y: 1 - y };
    case 270:
      return { x: y, y: 1 - x };
    default:
      return { x, y };
  }
}

export function pointsBox(points: readonly Point[]): Box {
  let left = 1;
  let top = 1;
  let right = 0;
  let bottom = 0;
  for (const { x, y } of points) {
    left = Math.min(left, x);
    right = Math.max(right, x);
    top = Math.min(top, y);
    bottom = Math.max(bottom, y);
  }
  return { x: left, y: top, width: right - left, height: bottom - top };
}

export function rotateBox(box: Box, angle: number) {
  return pointsBox([
    rotatePoint(box, angle),
    rotatePoint({ x: box.x + box.width, y: box.y + box.height }, angle)
  ]);
}

export function editBoxToPdf(box: Box, crop: Box): Box {
  return {
    x: crop.x + box.x * crop.width,
    y: crop.y + (1 - box.y - box.height) * crop.height,
    width: box.width * crop.width,
    height: box.height * crop.height
  };
}
