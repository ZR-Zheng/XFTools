import { uiText } from 'i18n/uiText';
import React, { useState, useRef, useContext } from 'react';
import { Box, Paper, Typography, Button } from '@components/ui';
import { Document, Page, pdfjs } from 'react-pdf';
import workerUrl from '@react-pdf-worker/pdf.worker.min.mjs?url';
import { Rnd } from 'react-rnd';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { useTranslation } from 'react-i18next';
import 'react-pdf/dist/Page/TextLayer.css';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import { useWorkbenchText } from 'i18n/workbench';
import { CustomSnackBarContext } from 'contexts/CustomSnackBarContext';

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

interface Field {
  id: string;
  type: 'text' | 'textarea' | 'checkbox' | 'radio' | 'label';
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
  value?: string;
}

export default function DragDropPdfEditor() {
  const { t } = useTranslation('pdf');
  const { english } = useWorkbenchText();
  const { showSnackBar } = useContext(CustomSnackBarContext);
  const [exporting, setExporting] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [numPages, setNumPages] = useState(0);
  const [fields, setFields] = useState<Field[]>([]);
  const [draggingField, setDraggingField] = useState<string | null>(null);
  const pageRectsRef = useRef<{
    [page: number]: { width: number; height: number };
  }>({});
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selectedField = fields.find((field) => field.id === selectedId);
  const addField = (type: Field['type']) => {
    if (!file || !numPages) return;
    const field: Field = {
      id: crypto.randomUUID(),
      type,
      page: 1,
      x: 24,
      y: 24,
      width: type === 'textarea' ? 160 : 120,
      height: type === 'textarea' ? 60 : 32
    };
    setFields((current) => [...current, field]);
    setSelectedId(field.id);
  };
  const updateSelectedField = (change: Partial<Field>) =>
    setFields((current) =>
      current.map((field) =>
        field.id === selectedId ? { ...field, ...change } : field
      )
    );
  const exportPdf = async () => {
    setExporting(true);
    try {
      await generatePdf();
    } catch (error) {
      showSnackBar(
        english
          ? 'Could not export. Check the document and field content.'
          : '无法导出，请检查文档和表单内容。',
        'error'
      );
    } finally {
      setExporting(false);
    }
  };

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setFields([]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => e.preventDefault();

  const handleClear = () => {
    setFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleRemoveField = (id: string) => {
    setFields((prev) => prev.filter((f) => f.id !== id));
  };
  const handleDropField = (e: React.DragEvent, pageNo: number) => {
    e.preventDefault();
    if (!draggingField) return;

    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const newField: Field = {
      id: Math.random().toString(36).slice(2),
      type: draggingField as Field['type'],
      page: pageNo,
      x,
      y,
      width: draggingField === 'textarea' ? 160 : 120,
      height: draggingField === 'textarea' ? 60 : 32
    };

    setFields((prev) => [...prev, newField]);
    setDraggingField(null);
  };

  const generatePdf = async () => {
    if (!file) return;

    const pdfBytes = await file.arrayBuffer();
    const pdfDoc = await PDFDocument.load(pdfBytes);

    const form = pdfDoc.getForm();

    for (const field of fields) {
      const page = pdfDoc.getPages()[field.page - 1];
      const rect = pageRectsRef.current[field.page];
      if (!rect) continue;

      // scaling
      const xRatio = page.getWidth() / rect.width;
      const yRatio = page.getHeight() / rect.height;

      const fieldX = field.x * xRatio;
      const fieldY = (rect.height - field.y - field.height) * yRatio;
      const fieldWidth = field.width * xRatio;
      const fieldHeight = field.height * yRatio;

      if (field.type === 'text' || field.type === 'textarea') {
        const tf = form.createTextField(field.id);
        tf.setText(field.value || '');
        tf.addToPage(page, {
          x: fieldX,
          y: fieldY,
          width: fieldWidth,
          height: fieldHeight
        });
      } else if (field.type === 'checkbox') {
        const cb = form.createCheckBox(field.id);
        cb.addToPage(page, {
          x: fieldX,
          y: fieldY,
          width: 18,
          height: 18
        });
      } else if (field.type === 'radio') {
        const rg = form.createRadioGroup(field.id);
        rg.addOptionToPage(field.id + '_opt', page, {
          x: fieldX,
          y: fieldY,
          width: 18,
          height: 18
        });
      } else if (field.type === 'label') {
        const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

        page.drawRectangle({
          x: fieldX,
          y: fieldY,
          width: fieldWidth,
          height: fieldHeight,
          color: rgb(1, 1, 1),
          opacity: 0.9
        });

        page.drawText(field.value || 'Label', {
          x: fieldX + 4,
          y: fieldY + fieldHeight / 2 - 7,
          size: 14,
          font: font,
          color: rgb(0, 0, 0)
        });
      }
    }

    const pdfBytesOut = await pdfDoc.save();
    const blob = new Blob([new Uint8Array(pdfBytesOut)], {
      type: 'application/pdf'
    });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = 'edited.pdf';
    a.click();
    URL.revokeObjectURL(url);
  };

  // styling
  const toolboxItemStyle = {
    width: '100%',
    p: 1,
    mb: 2,
    border: '1px dashed #aaa',
    borderRadius: 1,
    textAlign: 'center',
    cursor: 'grab',
    userSelect: 'none',
    bgcolor: '#fdfdfd',
    '&:hover': { bgcolor: '#f5f5f5' }
  };

  const inputStyle = {
    width: '100%',
    padding: '6px 8px',
    border: '1px solid #ccc',
    borderRadius: 4,
    fontSize: 14,
    backgroundColor: '#fff'
  };

  return (
    <Box
      className="pdf-form-builder"
      sx={{
        display: 'grid',
        gridTemplateColumns: {
          xs: 'minmax(0, 1fr)',
          md: file ? '220px minmax(0, 1fr)' : 'minmax(0, 1fr)'
        },
        gap: 2,
        alignItems: 'start'
      }}
    >
      {/* Toolbox */}
      {file && (
        <Paper sx={{ p: 2, width: '100%', minWidth: 0 }}>
          <Typography variant="h6" sx={{ mb: 2 }}>
            {t('formBuilder.toolbox.title')}
          </Typography>
          {/* draggable items */}
          <Box
            component="button"
            type="button"
            aria-label={t('formBuilder.toolbox.text')}
            onClick={() => addField('text')}
            draggable
            onDragStart={() => setDraggingField('text')}
            sx={toolboxItemStyle}
          >
            <span style={{ ...inputStyle, display: 'block', color: '#000' }}>
              {t('formBuilder.toolbox.text')}
            </span>
          </Box>
          <Box
            component="button"
            type="button"
            aria-label={t('formBuilder.toolbox.textarea')}
            onClick={() => addField('textarea')}
            draggable
            onDragStart={() => setDraggingField('textarea')}
            sx={toolboxItemStyle}
          >
            <span
              style={{
                ...inputStyle,
                display: 'block',
                height: 60,
                color: '#000'
              }}
            >
              {t('formBuilder.toolbox.textarea')}
            </span>
          </Box>
          <Box
            component="button"
            type="button"
            aria-label={t('formBuilder.toolbox.checkbox')}
            onClick={() => addField('checkbox')}
            draggable
            onDragStart={() => setDraggingField('checkbox')}
            sx={{
              ...toolboxItemStyle,
              display: 'flex',
              alignItems: 'center',
              gap: 1
            }}
          >
            <span
              aria-hidden="true"
              style={{
                display: 'inline-block',
                width: 18,
                height: 18,
                border: '1px solid #333',
                background: '#fff'
              }}
            />{' '}
            <span style={{ color: '#000' }}>
              {t('formBuilder.toolbox.checkbox')}
            </span>
          </Box>
          <Box
            component="button"
            type="button"
            aria-label={t('formBuilder.toolbox.radio')}
            onClick={() => addField('radio')}
            draggable
            onDragStart={() => setDraggingField('radio')}
            sx={{
              ...toolboxItemStyle,
              display: 'flex',
              alignItems: 'center',
              gap: 1
            }}
          >
            <span
              style={{
                width: 18,
                color: '#000',
                height: 18,
                borderRadius: '50%',
                border: '2px solid #000000ff',
                display: 'inline-block'
              }}
            />{' '}
            <span style={{ color: '#000' }}>
              {t('formBuilder.toolbox.radio')}
            </span>
          </Box>
          <Box
            component="button"
            type="button"
            aria-label={t('formBuilder.toolbox.label')}
            onClick={() => addField('label')}
            draggable
            onDragStart={(e) => {
              setDraggingField('label');

              const element = document.getElementById('lbl')!;
              const rect = element.getBoundingClientRect();

              const canvas = document.createElement('canvas');
              canvas.width = rect.width;
              canvas.height = rect.height;
              const ctx = canvas.getContext('2d')!;

              ctx.fillStyle = '#fafafa';
              ctx.fillRect(0, 0, rect.width, rect.height);

              ctx.fillStyle = '#000';
              ctx.font = '14px sans-serif';
              ctx.textBaseline = 'top';
              ctx.fillText(element.innerText, 6, 6);

              const img = new Image();
              img.src = canvas.toDataURL();
              img.onload = () => {
                e.dataTransfer.setDragImage(img, 0, 0);
              };
            }}
            sx={toolboxItemStyle}
          >
            <div
              id="lbl"
              style={{
                padding: '6px',
                color: '#000',
                border: '1px dashed #bbb',
                borderRadius: 4,
                background: '#fafafa',
                fontSize: 14
              }}
            >
              {t('formBuilder.toolbox.label')}
            </div>
          </Box>
          <p className="ui-helper">
            {english
              ? 'Click a control to add it to page 1, or drag it onto a page.'
              : '点击控件可添加到第 1 页，也可拖到指定页面。'}
          </p>
          {fields.length > 0 && (
            <div className="pdf-field-properties">
              <label>
                {english ? 'Selected field' : '当前控件'}
                <select
                  className="ui-input"
                  value={selectedId || ''}
                  onChange={(event) => setSelectedId(event.target.value)}
                >
                  <option value="">
                    {english ? 'Select a field' : '选择控件'}
                  </option>
                  {fields.map((field, index) => (
                    <option value={field.id} key={field.id}>
                      {index + 1}. {t(`formBuilder.toolbox.${field.type}`)}
                    </option>
                  ))}
                </select>
              </label>
              {selectedField && (
                <>
                  <div className="editor-crop-fields">
                    {(['x', 'y', 'width', 'height'] as const).map(
                      (key, index) => (
                        <label key={key}>
                          {
                            (english
                              ? ['Left', 'Top', 'Width', 'Height']
                              : ['左侧', '顶部', '宽度', '高度'])[index]
                          }
                          <input
                            className="ui-input"
                            type="number"
                            min={index < 2 ? 0 : 8}
                            value={selectedField[key]}
                            onChange={(event) =>
                              updateSelectedField({
                                [key]: Math.max(
                                  index < 2 ? 0 : 8,
                                  Number(event.target.value)
                                )
                              })
                            }
                          />
                        </label>
                      )
                    )}
                  </div>
                  <label>
                    {english ? 'Field content' : '控件内容'}
                    <input
                      className="ui-input"
                      value={selectedField.value || ''}
                      onChange={(event) =>
                        updateSelectedField({ value: event.target.value })
                      }
                    />
                  </label>
                  <Button
                    variant="outlined"
                    onClick={() => {
                      handleRemoveField(selectedField.id);
                      setSelectedId(null);
                    }}
                  >
                    {english ? 'Remove field' : '移除控件'}
                  </Button>
                </>
              )}
            </div>
          )}
        </Paper>
      )}

      <Box sx={{ minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <Box
          sx={{
            mb: 2,
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            flexWrap: 'wrap'
          }}
        >
          <Button variant="contained" component="label">
            {t('formBuilder.file.upload')}
            <input
              type="file"
              ref={fileInputRef}
              accept="application/pdf"
              onChange={handleUpload}
              hidden
            />
          </Button>

          {file && (
            <span style={{ overflowWrap: 'anywhere' }}>{file.name}</span>
          )}

          <Button
            variant="contained"
            sx={{ ml: 2 }}
            disabled={!fields.length || exporting}
            onClick={exportPdf}
          >
            {t('formBuilder.file.export')}
          </Button>

          <Button
            variant="contained"
            sx={{ ml: 2 }}
            disabled={!file}
            onClick={handleClear}
          >
            {t('formBuilder.file.clear')}
          </Button>
        </Box>

        <Box
          sx={{ minWidth: 0, maxHeight: '75vh', overflow: 'auto' }}
          onMouseDown={() => setSelectedId(null)}
        >
          {file && (
            <Document
              file={file}
              onLoadSuccess={({ numPages }) => setNumPages(numPages)}
              loading={english ? 'Loading PDF…' : '正在加载 PDF…'}
            >
              {Array.from({ length: numPages }, (_, i) => {
                const pageNo = i + 1;
                return (
                  <Box
                    key={pageNo}
                    sx={{
                      width: 'fit-content',
                      mx: 'auto',
                      border: '1px solid #ccc',
                      mb: 2,
                      position: 'relative'
                    }}
                    onDrop={(e) => handleDropField(e, pageNo)}
                    onDragOver={handleDragOver}
                    ref={(node) => {
                      const el = node as HTMLDivElement | null;
                      if (el) {
                        pageRectsRef.current[pageNo] = {
                          width: el.clientWidth,
                          height: el.clientHeight
                        };
                      }
                    }}
                  >
                    <Page pageNumber={pageNo} width={600} />

                    {fields
                      .filter((f) => f.page === pageNo)
                      .map((f) => (
                        <Rnd
                          key={f.id}
                          size={{ width: f.width, height: f.height }}
                          cancel=".delete-btn"
                          onMouseDown={(e) => {
                            e.stopPropagation();
                            setSelectedId(f.id);
                          }}
                          position={{ x: f.x, y: f.y }}
                          bounds="parent"
                          style={{ zIndex: 10 }}
                          onDragStop={(_, d) =>
                            setFields((prev) =>
                              prev.map((p) =>
                                p.id === f.id ? { ...p, x: d.x, y: d.y } : p
                              )
                            )
                          }
                          onResizeStop={(_, __, ref, ___, pos) =>
                            setFields((prev) =>
                              prev.map((p) =>
                                p.id === f.id
                                  ? {
                                      ...p,
                                      width: ref.offsetWidth,
                                      height: ref.offsetHeight,
                                      x: pos.x,
                                      y: pos.y
                                    }
                                  : p
                              )
                            )
                          }
                        >
                          {f.type === 'label' ? (
                            <div
                              contentEditable
                              suppressContentEditableWarning
                              onBlur={(e) => {
                                const newValue =
                                  e.currentTarget.innerText || '';
                                setFields((prev) =>
                                  prev.map((p) =>
                                    p.id === f.id
                                      ? { ...p, value: newValue }
                                      : p
                                  )
                                );
                              }}
                              style={{
                                width: '100%',
                                height: '100%',
                                padding: '4px 6px',
                                border: '1px dashed #999',
                                background: 'rgba(255,255,255,0.9)',
                                borderRadius: 4,
                                fontSize: 14,
                                textAlign: 'center',
                                cursor: 'text',
                                color: '#000'
                              }}
                            >
                              {f.value || 'Label'}
                            </div>
                          ) : f.type === 'radio' ? (
                            <div
                              style={{
                                width: '100%',
                                height: '100%',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'flex-start'
                              }}
                            >
                              <span
                                style={{
                                  width: Math.min(f.width, f.height) - 4,
                                  height: Math.min(f.width, f.height) - 4,
                                  borderRadius: '50%',
                                  border: '2px solid #1976d2',
                                  background: '#fff',
                                  display: 'inline-block'
                                }}
                              />
                            </div>
                          ) : f.type === 'checkbox' ? (
                            <input
                              type="checkbox"
                              style={{
                                width: 18,
                                height: 18,
                                margin: 0,
                                display: 'block'
                              }}
                            />
                          ) : (
                            <input
                              type="text"
                              value={f.value || ''}
                              onChange={(event) =>
                                setFields((current) =>
                                  current.map((field) =>
                                    field.id === f.id
                                      ? { ...field, value: event.target.value }
                                      : field
                                  )
                                )
                              }
                              placeholder={
                                f.type === 'textarea'
                                  ? t('formBuilder.toolbox.textarea')
                                  : t('formBuilder.toolbox.text')
                              }
                              style={{
                                width: '100%',
                                height: '100%',
                                border: '1px solid #333',
                                borderRadius: 4,
                                padding: '4px 6px',
                                backgroundColor: 'white',
                                fontSize: 14
                              }}
                            />
                          )}

                          {selectedId === f.id && (
                            <button
                              type="button"
                              title={uiText('Remove')}
                              onMouseDown={(e) => e.stopPropagation()}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRemoveField(f.id);
                              }}
                              style={{
                                position: 'absolute',
                                top: -10,
                                left: -10,
                                width: 20,
                                height: 20,
                                borderRadius: '50%',
                                border: 'none',
                                background: '#2e36bf',
                                color: '#fff',
                                fontSize: 12,
                                lineHeight: '20px',
                                padding: 0,
                                cursor: 'pointer',
                                zIndex: 20
                              }}
                            >
                              ×
                            </button>
                          )}
                        </Rnd>
                      ))}
                  </Box>
                );
              })}
            </Document>
          )}
        </Box>
      </Box>
    </Box>
  );
}
