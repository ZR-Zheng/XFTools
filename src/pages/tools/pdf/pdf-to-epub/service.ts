import JSZip from 'jszip';
import { extractPdfText } from '../shared/document';
import type { PdfJob } from '../shared/task';

function escapeXml(value: string): string {
  const entities: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&apos;'
  };
  return value.replace(/[&<>"']/g, (character) => entities[character]);
}

function formatTextToParagraphs(raw: string): string {
  return raw
    .split(/\n{2,}|\r{2,}/g) // Split on double line breaks
    .map((p) => p.trim())
    .filter((p) => p.length > 0)
    .map((p) => `<p>${escapeXml(p.replace(/\n/g, ' '))}</p>`)
    .join('\n');
}

export async function convertPdfToEpub(
  pdfFile: File,
  job: PdfJob = {},
  ranges = ''
): Promise<File> {
  const pages = await extractPdfText(pdfFile, ranges, job);
  job.signal?.throwIfAborted();

  const zip = new JSZip();

  zip.file('mimetype', 'application/epub+zip', { compression: 'STORE' });

  const metaInf = zip.folder('META-INF');
  metaInf!.file(
    'container.xml',
    `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`
  );

  const oebps = zip.folder('OEBPS');
  const bookName = pdfFile.name.replace(/\.pdf$/i, '');
  const bookTitle = escapeXml(bookName);
  const bookId = `urn:uuid:${crypto.randomUUID()}`;

  const contentOpf = `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" unique-identifier="bookid" version="2.0">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:title>${bookTitle}</dc:title>
    <dc:creator>Converted by xftools</dc:creator>
    <dc:identifier id="bookid">${bookId}</dc:identifier>
    <dc:language>en</dc:language>
  </metadata>
  <manifest>
    <item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>
    ${pages
      .map(
        (_, index) =>
          `<item id="chapter${index + 1}" href="chapter${
            index + 1
          }.xhtml" media-type="application/xhtml+xml"/>`
      )
      .join('\n    ')}
  </manifest>
  <spine toc="ncx">
    ${pages
      .map((_, index) => `<itemref idref="chapter${index + 1}"/>`)
      .join('\n    ')}
  </spine>
</package>`;

  oebps!.file('content.opf', contentOpf);

  const tocNcx = `<?xml version="1.0" encoding="UTF-8"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
  <head>
    <meta name="dtb:uid" content="${bookId}"/>
    <meta name="dtb:depth" content="1"/>
    <meta name="dtb:totalPageCount" content="0"/>
    <meta name="dtb:maxPageNumber" content="0"/>
  </head>
  <docTitle>
    <text>${bookTitle}</text>
  </docTitle>
  <navMap>
    ${pages
      .map(
        (_, index) =>
          `<navPoint id="navpoint-${index + 1}" playOrder="${index + 1}">
        <navLabel>
          <text>Page ${index + 1}</text>
        </navLabel>
        <content src="chapter${index + 1}.xhtml"/>
      </navPoint>`
      )
      .join('\n    ')}
  </navMap>
</ncx>`;

  oebps!.file('toc.ncx', tocNcx);

  pages.forEach((pageText, index) => {
    const formattedBody = formatTextToParagraphs(pageText);

    const chapterXhtml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.1//EN" "http://www.w3.org/TR/xhtml11/DTD/xhtml11.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <title>Page ${index + 1}</title>
  <meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
  <style>
    body {
      font-family: serif;
      line-height: 1.6;
      margin: 1em;
    }
    p {
      margin-bottom: 1em;
      text-align: justify;
    }
  </style>
</head>
<body>
  <h1>Page ${index + 1}</h1>
  ${formattedBody}
</body>
</html>`;

    oebps!.file(`chapter${index + 1}.xhtml`, chapterXhtml);
  });

  const epubBuffer = await zip.generateAsync({ type: 'arraybuffer' });
  job.signal?.throwIfAborted();

  return new File([epubBuffer], bookName + '.epub', {
    type: 'application/epub+zip'
  });
}
