import { canExportSvg, editSize, type Edit, type ImageSource } from './session';
import { parseColorToRgb } from '@utils/color';

const svgNamespace = 'http://www.w3.org/2000/svg';
const svgMime = 'image/svg+xml';

export async function exportSvg(
  source: ImageSource,
  edits: readonly Edit[],
  filename: string
) {
  if (!canExportSvg(source, edits))
    throw new Error('当前编辑只支持导出为位图。');
  const xml = new DOMParser().parseFromString(
    await source.file.text(),
    svgMime
  );
  if (
    xml.documentElement.namespaceURI !== svgNamespace ||
    xml.documentElement.localName !== 'svg'
  )
    throw new Error('无法读取 SVG 图片。');
  const output = document.implementation.createDocument(svgNamespace, 'svg');
  const root = output.documentElement;
  let content: Element = output.importNode(xml.documentElement, true);
  let size = { width: source.width, height: source.height };
  const serializer = new XMLSerializer();
  const parser = new DOMParser();
  content.setAttribute('width', String(size.width));
  content.setAttribute('height', String(size.height));
  for (const edit of edits) {
    if (edit.type === 'mask') {
      const { processImage } = await import('../generic/change-colors/service');
      const original = new File(
        [serializer.serializeToString(content)],
        filename,
        { type: svgMime }
      );
      const from = parseColorToRgb(edit.from);
      const to = parseColorToRgb(edit.to);
      const updated = await processImage(
        original,
        [from.r, from.g, from.b, 255],
        [to.r, to.g, to.b, 255],
        edit.tolerance
      );
      content = output.importNode(
        parser.parseFromString(await updated.text(), svgMime).documentElement,
        true
      );
      continue;
    }
    const next = editSize(size, edit);
    const group = output.createElementNS(svgNamespace, 'g');
    if (edit.type === 'rotate') {
      group.setAttribute(
        'transform',
        [
          `translate(${next.width / 2} ${next.height / 2})`,
          `rotate(${edit.angle})`,
          `scale(${edit.flipX ? -1 : 1} ${edit.flipY ? -1 : 1})`,
          `translate(${-size.width / 2} ${-size.height / 2})`
        ].join(' ')
      );
    } else {
      group.setAttribute(
        'transform',
        `scale(${next.width / size.width} ${next.height / size.height})`
      );
    }
    group.append(content);
    content = group;
    size = next;
  }
  root.setAttribute('width', String(size.width));
  root.setAttribute('height', String(size.height));
  root.setAttribute('viewBox', `0 0 ${size.width} ${size.height}`);
  root.append(content);
  return new File([serializer.serializeToString(root)], filename, {
    type: svgMime
  });
}
