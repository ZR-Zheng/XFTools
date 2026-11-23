import { createPdfiumEngine } from '@embedpdf/engines/pdfium-direct-engine';
import { PdfErrorCode, PdfPermissionFlag } from '@embedpdf/models';
import wasmUrl from '@embedpdf/pdfium/pdfium.wasm?url';

export type SecurityRequest = {
  mode: 'protect' | 'unlock';
  bytes: ArrayBuffer;
  password: string;
};
export type SecurityResponse = { bytes: ArrayBuffer } | { error: string };

self.onmessage = async ({ data }: MessageEvent<SecurityRequest>) => {
  try {
    const engine = await createPdfiumEngine(
      new URL(wasmUrl, self.location.href).href,
      { fontFallback: null }
    );
    try {
      const document = await engine
        .openDocumentBuffer(
          { id: 'pdf', content: data.bytes },
          {
            password: data.mode === 'unlock' ? data.password : undefined
          }
        )
        .toPromise();
      if (data.mode === 'unlock') {
        const unrestricted =
          (document.permissions & PdfPermissionFlag.AllowAll) ===
          PdfPermissionFlag.AllowAll;
        if (
          !document.isOwnerUnlocked &&
          !unrestricted &&
          !(await engine
            .unlockOwnerPermissions(document, data.password)
            .toPromise())
        ) {
          self.postMessage({
            error: '此文件限制编辑，请输入所有者密码。'
          } satisfies SecurityResponse);
          return;
        }
        if (!(await engine.removeEncryption(document).toPromise()))
          throw new Error();
      } else if (
        !(await engine
          .setDocumentEncryption(
            document,
            data.password,
            data.password,
            PdfPermissionFlag.AllowAll
          )
          .toPromise())
      ) {
        throw new Error();
      }
      const bytes = await engine.saveAsCopy(document).toPromise();
      self.postMessage({ bytes } satisfies SecurityResponse, {
        transfer: [bytes]
      });
    } finally {
      await engine.destroy().toPromise();
    }
  } catch (error) {
    const reason = (error as { reason?: { code?: number } }).reason;
    self.postMessage({
      error:
        reason?.code === PdfErrorCode.Password
          ? 'PDF 密码不正确。'
          : '无法处理此 PDF 的密码保护，请检查文件或重试。'
    } satisfies SecurityResponse);
  }
};
