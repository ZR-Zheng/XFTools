import { useEffect, useRef, useState } from 'react';
import Glyph from '@components/workbench/Glyph';
import {
  acceptsDraftAsset,
  buildJianyingProject,
  matchDraftAssets,
  parseJianyingDraft,
  type JianyingDraft
} from './jianying';
import { assetKind, audioTypes, imageTypes, videoTypes } from './media';
import { type Asset, type Project } from './timeline';

interface Props {
  onApply: (project: Project, assets: Asset[]) => void;
  onClose: () => void;
}

export default function JianyingImportDialog({ onApply, onClose }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const task = useRef<AbortController>(null);
  const [draft, setDraft] = useState<JianyingDraft>();
  const [files, setFiles] = useState<File[]>([]);
  const [manual, setManual] = useState<Map<string, File>>(() => new Map());
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => {
      task.current?.abort();
      element?.close();
    };
  }, []);

  const matched = draft
    ? matchDraftAssets(draft, files)
    : new Map<string, File>();
  for (const [id, file] of manual) matched.set(id, file);

  async function readDraft(file: File) {
    const controller = new AbortController();
    task.current = controller;
    setBusy(true);
    setStatus('正在读取草稿…');
    setError('');
    setDraft(undefined);
    setManual(new Map());
    try {
      if (file.size > 16 * 1024 * 1024)
        throw new Error('草稿文件超过 16 MB，请使用只包含所需轨道的草稿。');
      const text = await file.text();
      controller.signal.throwIfAborted();
      setDraft(parseJianyingDraft(text, file.name));
    } catch (error) {
      if (!controller.signal.aborted)
        setError(error instanceof Error ? error.message : '无法读取剪映草稿。');
    } finally {
      if (!controller.signal.aborted) {
        setBusy(false);
        setStatus('');
      }
      task.current = null;
    }
  }

  async function apply() {
    if (!draft || matched.size !== draft.materials.length || task.current)
      return;
    const controller = new AbortController();
    task.current = controller;
    setBusy(true);
    setError('');
    setStatus('正在验证素材…');
    try {
      const { project, assets } = await buildJianyingProject(
        draft,
        matched,
        controller.signal,
        (done, total) => setStatus(`正在验证素材 ${done} / ${total}`)
      );
      if (controller.signal.aborted) {
        for (const asset of assets) URL.revokeObjectURL(asset.url);
      } else onApply(project, assets);
    } catch (error) {
      if (!controller.signal.aborted)
        setError(error instanceof Error ? error.message : '无法导入草稿素材。');
    } finally {
      if (!controller.signal.aborted) {
        setBusy(false);
        setStatus('');
      }
      task.current = null;
    }
  }

  return (
    <dialog
      className="vw-dialog vw-jianying-dialog"
      ref={dialog}
      aria-labelledby="vw-jianying-title"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <header className="vw-pane-header">
        <h2 id="vw-jianying-title">导入剪映草稿</h2>
        <button
          className="vw-icon"
          type="button"
          aria-label="关闭剪映导入"
          onClick={onClose}
        >
          <Glyph name="close" size={18} />
        </button>
      </header>
      <div className="vw-dialog-content">
        <label className="vw-field">
          <span>剪映草稿或模板文件</span>
          <input
            type="file"
            accept=".json,.bak,application/json"
            disabled={busy}
            onChange={(event) => {
              const file = event.currentTarget.files?.[0];
              if (file) void readDraft(file);
              event.currentTarget.value = '';
            }}
          />
          <small className="vw-muted">
            支持可直接读取的 draft_content.json、template.json 及备份。
          </small>
        </label>
        {draft && (
          <>
            <div className="vw-draft-summary">
              <strong>{draft.name}</strong>
              <span>
                {draft.clips.length} 个主轨片段 ·{' '}
                {draft.soundtrack ? '含配乐' : '无配乐'}
                {draft.dimensions &&
                  ` · ${draft.dimensions.width} × ${draft.dimensions.height}`}
                {draft.frameRate && ` · ${draft.frameRate} fps`}
              </span>
            </div>
            {draft.notes.length > 0 && (
              <ul className="vw-draft-notes">
                {draft.notes.map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
            )}
            <label className="vw-field">
              <span>关联本地素材</span>
              <input
                type="file"
                multiple
                accept={[...videoTypes, ...imageTypes, ...audioTypes].join(',')}
                disabled={busy}
                onChange={(event) => {
                  const picked = Array.from(
                    event.currentTarget.files ?? []
                  ).filter(assetKind);
                  setFiles((current) => [...current, ...picked]);
                  event.currentTarget.value = '';
                }}
              />
            </label>
            <p className="vw-muted" role="status">
              已关联 {matched.size} / {draft.materials.length}{' '}
              项素材。同名文件会自动匹配，也可手动替换。
            </p>
            <div className="vw-draft-materials">
              {draft.materials.map((material) => {
                const assigned = matched.get(material.id);
                return (
                  <label
                    className="vw-field vw-draft-material"
                    key={material.id}
                  >
                    <span title={material.path}>{material.name}</span>
                    <small className="vw-muted">
                      {assigned
                        ? assigned.name === material.name
                          ? '已关联'
                          : assigned.name
                        : '未关联'}
                    </small>
                    <span className="vw-draft-pick">
                      <span aria-hidden="true">
                        {assigned ? '更换' : '选择'}
                      </span>
                      <input
                        type="file"
                        aria-label={`关联 ${material.name}`}
                        disabled={busy}
                        accept={(material.kind === 'audio'
                          ? audioTypes
                          : [...videoTypes, ...imageTypes]
                        ).join(',')}
                        onChange={(event) => {
                          const file = event.currentTarget.files?.[0];
                          if (file && acceptsDraftAsset(material, file)) {
                            setManual((previous) =>
                              new Map(previous).set(material.id, file)
                            );
                            setError('');
                          } else if (file)
                            setError(
                              `素材 ${material.name} 的文件类型不匹配。`
                            );
                          event.currentTarget.value = '';
                        }}
                      />
                    </span>
                  </label>
                );
              })}
            </div>
          </>
        )}
        {status && (
          <p role="status" className="vw-muted">
            {status}
          </p>
        )}
        {error && (
          <p role="alert" className="vw-error">
            {error}
          </p>
        )}
      </div>
      {draft && (
        <footer className="vw-draft-footer">
          <p className="vw-muted">应用后会替换当前时间线，可撤销。</p>
          <button
            type="button"
            className="primary-button"
            disabled={busy || matched.size !== draft.materials.length}
            onClick={() => void apply()}
          >
            应用剪映草稿
          </button>
        </footer>
      )}
    </dialog>
  );
}
