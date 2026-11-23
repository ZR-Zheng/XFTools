import {
  annotationKinds,
  fieldKinds,
  type EditKind,
  type PageEdit
} from '../shared/page-edits';
import Glyph from '@components/workbench/Glyph';

export function editKindName(
  kind: EditKind,
  t: (zh: string, en: string) => string
) {
  const labels: Record<EditKind, [string, string]> = {
    note: ['便签', 'Sticky note'],
    highlight: ['区域高亮', 'Area highlight'],
    ink: ['手绘', 'Freehand'],
    freeText: ['文本批注', 'Text annotation'],
    text: ['文本框', 'Text field'],
    textarea: ['多行文本框', 'Multiline field'],
    checkbox: ['复选框', 'Checkbox'],
    radio: ['单选项', 'Radio option'],
    label: ['静态文字', 'Label']
  };
  return t(...labels[kind]);
}

export default function PdfEditPanel({
  mode,
  currentPage,
  edits,
  selected,
  busy,
  compact,
  onClose,
  onPlace,
  onSelect,
  onSave,
  onDelete,
  onAdvanced,
  t
}: {
  mode: 'annotation' | 'form';
  currentPage: number;
  edits: readonly PageEdit[];
  selected?: PageEdit;
  busy: boolean;
  compact: boolean;
  onClose: () => void;
  onPlace: (kind: EditKind, edit?: PageEdit) => void;
  onSelect: (edit: PageEdit) => void;
  onSave: (edit: PageEdit) => void;
  onDelete: (edit: PageEdit) => void;
  onAdvanced: () => void;
  t: (zh: string, en: string) => string;
}) {
  const formMode = mode === 'form';
  const title = formMode
    ? t('表单设计', 'Form design')
    : t('批注', 'Annotations');
  const kinds = formMode ? fieldKinds : annotationKinds;
  const hasFieldOptions = selected && formMode && selected.kind !== 'label';
  const hasText = selected && selected.kind !== 'checkbox';
  return (
    <aside
      className="pdf-output pdf-edit-panel"
      id="pdf-edit-panel"
      aria-label={title}
    >
      <div className="pdf-output-heading">
        <h3>{title}</h3>
        <button
          type="button"
          className="pdf-icon-button"
          aria-label={t('关闭编辑面板', 'Close edit panel')}
          onClick={onClose}
        >
          <Glyph name="close" size={compact ? 21 : 17} />
        </button>
      </div>
      <div
        className="pdf-mark-tools"
        role="group"
        aria-label={t('添加到页面', 'Add to page')}
      >
        {kinds.map((kind) => (
          <button
            type="button"
            key={kind}
            disabled={!currentPage || busy}
            onClick={() => onPlace(kind)}
          >
            {editKindName(kind, t)}
          </button>
        ))}
      </div>
      {!currentPage && (
        <p className="pdf-help">
          {t('打开 PDF 后可在页面上添加。', 'Open a PDF to start editing.')}
        </p>
      )}
      {selected && (
        <form
          className="pdf-edit-properties"
          key={`${selected.id}-${JSON.stringify(selected)}`}
          onSubmit={(event) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            onSave({
              ...selected,
              text: String(data.get('text') ?? selected.text),
              name: String(data.get('name') ?? selected.name),
              color: String(data.get('color') ?? selected.color),
              checked: data.has('checked'),
              required: data.has('required')
            });
          }}
        >
          <fieldset disabled={busy}>
            {hasFieldOptions && (
              <label className="pdf-output-name">
                {t('字段名称', 'Field name')}
                <input
                  name="name"
                  type="text"
                  required
                  maxLength={80}
                  defaultValue={selected.name}
                />
              </label>
            )}
            {hasText && (
              <label className="pdf-output-name">
                {selected.kind === 'radio'
                  ? t('选项值', 'Option value')
                  : hasFieldOptions
                    ? t('默认值', 'Default value')
                    : t('批注内容', 'Annotation text')}
                <textarea
                  name="text"
                  rows={3}
                  maxLength={4000}
                  defaultValue={selected.text}
                />
              </label>
            )}
            {(!hasFieldOptions || selected.kind === 'label') && (
              <label className="pdf-bookmarks">
                {t('颜色', 'Color')}{' '}
                <input
                  name="color"
                  type="color"
                  defaultValue={selected.color}
                />
              </label>
            )}
            {hasFieldOptions && (
              <label className="pdf-bookmarks">
                <input
                  name="required"
                  type="checkbox"
                  defaultChecked={selected.required}
                />
                {t('必填', 'Required')}
              </label>
            )}
            {(selected.kind === 'checkbox' || selected.kind === 'radio') && (
              <label className="pdf-bookmarks">
                <input
                  name="checked"
                  type="checkbox"
                  defaultChecked={selected.checked}
                />
                {t('默认选中', 'Checked by default')}
              </label>
            )}
            <div className="pdf-edit-property-actions">
              <button type="submit" className="pdf-primary">
                {t('保存属性', 'Save properties')}
              </button>
              <button
                type="button"
                onClick={() => onPlace(selected.kind, selected)}
              >
                {selected.kind === 'ink'
                  ? t('重新绘制', 'Redraw')
                  : t('重新定位', 'Reposition')}
              </button>
              <button
                type="button"
                className="pdf-danger"
                onClick={() => onDelete(selected)}
              >
                {t('删除', 'Delete')}
              </button>
            </div>
          </fieldset>
        </form>
      )}
      {currentPage > 0 && edits.length > 0 && (
        <div
          className="pdf-mark-list"
          role="group"
          aria-label={t('当前页的编辑', 'Edits on this page')}
        >
          {edits.map((edit) => (
            <button
              type="button"
              key={edit.id}
              disabled={busy}
              aria-pressed={selected?.id === edit.id}
              onClick={() => onSelect(edit)}
            >
              {edit.name || edit.text || editKindName(edit.kind, t)}
            </button>
          ))}
        </div>
      )}
      <button
        type="button"
        className="pdf-advanced-trigger"
        disabled={!currentPage || busy}
        onClick={onAdvanced}
      >
        {t('编辑原有批注与表单', 'Edit existing annotations and forms')}
      </button>
    </aside>
  );
}
