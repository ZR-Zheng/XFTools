import { useEffect, useRef, useState } from 'react';
import Glyph from '@components/workbench/Glyph';
import { sourceCanvas, videoTemplates, type CanvasSettings } from './templates';

const choices = [
  ...videoTemplates,
  {
    id: 'source',
    title: '原始比例',
    label: '自动',
    width: 4,
    height: 3,
    description: '画布跟随时间线首段尺寸',
    format: '',
    framing: sourceCanvas.framing
  }
] as const;

export default function VideoTemplatesDialog({
  canvas,
  onApply,
  onClose,
  onImport
}: {
  canvas: CanvasSettings;
  onApply: (settings: CanvasSettings) => void;
  onClose: () => void;
  onImport: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [draft, setDraft] = useState(canvas);
  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => element?.close();
  }, []);
  const dimensions = canvas.dimensions;
  const options =
    dimensions || canvas.frameRate
      ? [
          ...choices,
          {
            id: 'jianying',
            title: '剪映画布',
            label: dimensions
              ? `${dimensions.width} × ${dimensions.height}`
              : `${canvas.frameRate} fps`,
            ...(dimensions ?? { width: 4, height: 3 }),
            framing: 'contain',
            description: '使用导入草稿的画布设置',
            format: 'mp4'
          } as const
        ]
      : choices;

  return (
    <dialog
      className="vw-dialog vw-templates-dialog"
      ref={dialog}
      aria-labelledby="vw-templates-title"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <header className="vw-pane-header">
        <h2 id="vw-templates-title">剪辑模板</h2>
        <button
          type="button"
          className="vw-icon"
          aria-label="关闭模板"
          onClick={onClose}
        >
          <Glyph name="close" size={18} />
        </button>
      </header>
      <form
        className="vw-dialog-content"
        onSubmit={(event) => {
          event.preventDefault();
          onApply(draft);
        }}
      >
        <fieldset className="vw-template-grid">
          <legend className="sr-only">选择剪辑模板</legend>
          {options.map((choice) => {
            const scale = 54 / Math.max(choice.width, choice.height);
            return (
              <label className="vw-template-card" key={choice.id}>
                <input
                  type="radio"
                  name="video-template"
                  className="sr-only"
                  aria-label={`${choice.title} ${choice.label}`}
                  checked={draft.template === choice.id}
                  onChange={() =>
                    setDraft({
                      ...draft,
                      template: choice.id,
                      framing: choice.framing
                    })
                  }
                />
                <span className="vw-template-preview" aria-hidden="true">
                  <span
                    style={{
                      width: choice.width * scale,
                      height: choice.height * scale
                    }}
                  />
                </span>
                <span className="vw-template-name">
                  <strong>{choice.title}</strong>
                  <span>{choice.label}</span>
                </span>
                <small>
                  {choice.description}
                  {choice.format && ' · ' + choice.format.toUpperCase()}
                </small>
              </label>
            );
          })}
        </fieldset>
        <div className="vw-template-actions">
          <label className="vw-field">
            <span>素材适配</span>
            <select
              className="ui-input"
              value={draft.framing}
              onChange={(event) =>
                setDraft({
                  ...draft,
                  framing: event.target.value === 'cover' ? 'cover' : 'contain'
                })
              }
            >
              <option value="contain">保留完整画面</option>
              <option value="cover">居中裁切铺满</option>
            </select>
          </label>
          <button type="submit" className="primary-button">
            应用模板
          </button>
        </div>
        <button
          type="button"
          className="secondary-button vw-import-draft"
          onClick={onImport}
        >
          <Glyph name="upload" size={16} /> 导入剪映草稿
        </button>
      </form>
    </dialog>
  );
}
