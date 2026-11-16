import { useContext, useEffect, useRef, useState } from 'react';
import ToolImageInput from '../input/ToolImageInput';
import { useWorkbenchText } from 'i18n/workbench';
import { CustomSnackBarContext } from '../../contexts/CustomSnackBarContext';
import ToolHeaderActions from '../ToolHeaderActions';

const defaults = {
  rotation: 0,
  flipX: false,
  flipY: false,
  brightness: 100,
  contrast: 100,
  saturation: 100,
  x: 0,
  y: 0,
  width: 100,
  height: 100,
  text: '',
  textSize: 6,
  textColor: '#ffffff'
};
type Edit = typeof defaults;
export default function NativeImageEditor() {
  const { english } = useWorkbenchText();
  const tr = (zh: string, en: string) => (english ? en : zh);
  const { showSnackBar } = useContext(CustomSnackBarContext);
  const [file, setFile] = useState<File | null>(null);
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [history, setHistory] = useState<Edit[]>([defaults]);
  const [format, setFormat] = useState('image/png');
  const [saving, setSaving] = useState(false);
  const canvas = useRef<HTMLCanvasElement>(null);
  const upload = useRef<HTMLInputElement>(null);
  const edit = history[history.length - 1];
  const update = (next: Partial<Edit>) =>
    setHistory((current) => [
      ...current.slice(-39),
      { ...current[current.length - 1], ...next }
    ]);
  useEffect(() => {
    setImage(null);
    setHistory([defaults]);
    if (!file) return;
    const url = URL.createObjectURL(file),
      loaded = new Image();
    let active = true;
    loaded.onload = () => {
      if (active) setImage(loaded);
    };
    loaded.onerror = () => {
      if (active)
        showSnackBar(
          tr(
            '无法读取图片，请选择 PNG、JPG 或 WebP。',
            'Could not read the image. Choose PNG, JPG or WebP.'
          ),
          'error'
        );
    };
    loaded.src = url;
    return () => {
      active = false;
      URL.revokeObjectURL(url);
    };
  }, [file]);
  useEffect(() => {
    if (!image || !canvas.current) return;
    const target = canvas.current,
      context = target.getContext('2d');
    if (!context) return;
    const sx = (image.naturalWidth * edit.x) / 100,
      sy = (image.naturalHeight * edit.y) / 100;
    const width = Math.max(
      1,
      Math.round(
        (image.naturalWidth * Math.min(edit.width, 100 - edit.x)) / 100
      )
    );
    const height = Math.max(
      1,
      Math.round(
        (image.naturalHeight * Math.min(edit.height, 100 - edit.y)) / 100
      )
    );
    const swapped = edit.rotation % 180 !== 0;
    target.width = swapped ? height : width;
    target.height = swapped ? width : height;
    context.clearRect(0, 0, target.width, target.height);
    if (format === 'image/jpeg') {
      context.fillStyle = '#fff';
      context.fillRect(0, 0, target.width, target.height);
    }
    context.save();
    context.translate(target.width / 2, target.height / 2);
    context.rotate((edit.rotation * Math.PI) / 180);
    context.scale(edit.flipX ? -1 : 1, edit.flipY ? -1 : 1);
    context.filter = `brightness(${edit.brightness}%) contrast(${edit.contrast}%) saturate(${edit.saturation}%)`;
    context.drawImage(
      image,
      sx,
      sy,
      width,
      height,
      -width / 2,
      -height / 2,
      width,
      height
    );
    context.restore();
    if (edit.text) {
      context.font = `600 ${Math.max(12, (target.width * edit.textSize) / 100)}px system-ui`;
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      context.fillStyle = edit.textColor;
      context.shadowColor = '#0009';
      context.shadowBlur = 4;
      context.fillText(
        edit.text,
        target.width / 2,
        target.height * 0.85,
        target.width * 0.9
      );
    }
  }, [edit, image, format]);
  const save = () => {
    if (!canvas.current || !image) return;
    setSaving(true);
    canvas.current.toBlob(
      (blob) => {
        setSaving(false);
        if (!blob) {
          showSnackBar(tr('图片导出失败', 'Image export failed'), 'error');
          return;
        }
        const url = URL.createObjectURL(blob),
          link = document.createElement('a');
        link.href = url;
        link.download = `${file?.name.replace(/\.[^.]+$/, '') || 'image'}-edited.${format.split('/')[1]}`;
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      },
      format,
      0.92
    );
  };
  if (!file)
    return (
      <ToolImageInput
        value={null}
        onChange={setFile}
        accept={[
          'image/png',
          'image/jpeg',
          'image/webp',
          'image/avif',
          'image/gif',
          'image/bmp'
        ]}
        title={tr('选择要编辑的图片', 'Choose an image to edit')}
      />
    );
  return (
    <div className="native-image-editor">
      <ToolHeaderActions>
        <span className="tool-source-name" title={file.name}>
          {file.name}
        </span>
        <button
          className="secondary-button"
          onClick={() => upload.current?.click()}
        >
          {tr('更换图片', 'Change image')}
        </button>
        <button
          className="secondary-button"
          disabled={history.length < 2}
          onClick={() => setHistory((current) => current.slice(0, -1))}
        >
          {tr('撤销', 'Undo')}
        </button>
        <button
          className="secondary-button"
          onClick={() => setHistory([defaults])}
        >
          {tr('重置', 'Reset')}
        </button>
      </ToolHeaderActions>
      <input
        ref={upload}
        type="file"
        accept="image/*"
        hidden
        onChange={(event) => {
          const next = event.target.files?.[0];
          if (next) setFile(next);
        }}
      />
      <div className="image-editor-grid">
        <div className="image-canvas-stage" aria-busy={!image}>
          <canvas
            ref={canvas}
            aria-label={tr('编辑后的图片预览', 'Edited image preview')}
          />
          {!image && (
            <span role="status">{tr('正在读取图片…', 'Loading image…')}</span>
          )}
        </div>
        <aside className="image-editor-controls">
          <fieldset>
            <legend>{tr('方向', 'Orientation')}</legend>
            <div className="editor-button-row">
              <button
                className="secondary-button"
                onClick={() => update({ rotation: (edit.rotation + 90) % 360 })}
              >
                {tr('旋转 90°', 'Rotate 90°')}
              </button>
              <button
                className="secondary-button"
                aria-pressed={edit.flipX}
                onClick={() => update({ flipX: !edit.flipX })}
              >
                {tr('水平翻转', 'Flip horizontal')}
              </button>
              <button
                className="secondary-button"
                aria-pressed={edit.flipY}
                onClick={() => update({ flipY: !edit.flipY })}
              >
                {tr('垂直翻转', 'Flip vertical')}
              </button>
            </div>
          </fieldset>
          <fieldset>
            <legend>{tr('色彩调整', 'Adjustments')}</legend>
            {(['brightness', 'contrast', 'saturation'] as const).map(
              (key, index) => (
                <label className="editor-range" key={key}>
                  <span>
                    {
                      [
                        tr('亮度', 'Brightness'),
                        tr('对比度', 'Contrast'),
                        tr('饱和度', 'Saturation')
                      ][index]
                    }{' '}
                    <output>{edit[key]}%</output>
                  </span>
                  <input
                    type="range"
                    min="0"
                    max="200"
                    value={edit[key]}
                    onChange={(event) =>
                      update({ [key]: Number(event.target.value) })
                    }
                  />
                </label>
              )
            )}
          </fieldset>
          <fieldset>
            <legend>{tr('裁剪区域（%）', 'Crop area (%)')}</legend>
            <div className="editor-crop-fields">
              {(['x', 'y', 'width', 'height'] as const).map((key, index) => (
                <label key={key}>
                  {
                    [
                      tr('左侧', 'Left'),
                      tr('顶部', 'Top'),
                      tr('宽度', 'Width'),
                      tr('高度', 'Height')
                    ][index]
                  }
                  <input
                    className="ui-input"
                    type="number"
                    min={index < 2 ? 0 : 1}
                    max={index < 2 ? 99 : 100}
                    value={edit[key]}
                    onChange={(event) =>
                      update({
                        [key]: Math.max(
                          index < 2 ? 0 : 1,
                          Math.min(
                            index < 2 ? 99 : 100,
                            Number(event.target.value)
                          )
                        )
                      })
                    }
                  />
                </label>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend>{tr('文字标注', 'Text annotation')}</legend>
            <label>
              {tr('文字内容', 'Text')}
              <input
                className="ui-input"
                value={edit.text}
                onChange={(event) => update({ text: event.target.value })}
              />
            </label>
            <div className="editor-button-row">
              <label>
                {tr('颜色', 'Color')}
                <input
                  type="color"
                  value={edit.textColor}
                  onChange={(event) =>
                    update({ textColor: event.target.value })
                  }
                />
              </label>
              <label>
                {tr('字号（占图片宽度 %）', 'Size (% of image width)')}
                <input
                  className="ui-input"
                  type="number"
                  min="1"
                  max="30"
                  value={edit.textSize}
                  onChange={(event) =>
                    update({
                      textSize: Math.max(
                        1,
                        Math.min(30, Number(event.target.value))
                      )
                    })
                  }
                />
              </label>
            </div>
          </fieldset>
          <label>
            {tr('导出格式', 'Export format')}
            <select
              className="ui-input"
              value={format}
              onChange={(event) => setFormat(event.target.value)}
            >
              <option value="image/png">PNG</option>
              <option value="image/jpeg">JPEG</option>
              <option value="image/webp">WebP</option>
            </select>
          </label>
          <button
            className="primary-button"
            disabled={!image || saving}
            onClick={save}
          >
            {saving
              ? tr('正在导出…', 'Exporting…')
              : tr('下载图片', 'Download image')}
          </button>
        </aside>
      </div>
    </div>
  );
}
