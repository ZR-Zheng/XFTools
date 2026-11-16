import React, {
  createContext,
  useContext,
  useEffect,
  useId,
  useInsertionEffect,
  useRef,
  useState
} from 'react';
import { createPortal } from 'react-dom';
import { uiText } from 'i18n/uiText';
import './ui.css';

// Native HTML controls shared by the tools, without external UI or styling dependencies.
const colors: Record<string, string> = {
  'background.paper': 'var(--surface)',
  'background.default': 'var(--page)',
  'background.hover': 'var(--surface-soft)',
  'background.lightSecondary': 'var(--surface)',
  'background.darkSecondary': 'var(--surface-soft)',
  'text.primary': 'var(--ink)',
  'text.secondary': 'var(--muted)',
  'primary.main': 'var(--blue)',
  divider: 'var(--line)',
  'success.main': 'var(--green)',
  'error.main': 'var(--danger)',
  'warning.main': '#b45309',
  'primary.light': 'var(--blue-soft)'
};
const theme = {
  palette: {
    mode: 'light' as 'light' | 'dark',
    background: { paper: 'var(--surface)', default: 'var(--page)' },
    text: { primary: 'var(--ink)', secondary: 'var(--muted)' },
    primary: { main: 'var(--blue)' },
    success: {
      main: 'var(--green)',
      light: '#dcfce7',
      dark: '#14532d',
      contrastText: 'var(--ink)'
    },
    error: {
      main: '#dc2626',
      light: '#fee2e2',
      dark: '#7f1d1d',
      contrastText: 'var(--ink)'
    },
    divider: 'var(--line)'
  },
  breakpoints: {
    down: (key: string) => `(max-width: ${key === 'sm' ? 599 : 899}px)`
  },
  transitions: {
    create: (..._args: unknown[]) =>
      'border-color 180ms ease, background-color 180ms ease',
    duration: { shorter: 180 }
  },
  spacing: (n: number) => `${n * 8}px`
};
type Theme = typeof theme;
type StyleMap = { [key: string]: unknown };
type Sx = StyleMap | ((theme: Theme) => StyleMap);
type BaseProps = Omit<React.HTMLAttributes<HTMLElement>, 'color'> & {
  sx?: Sx;
  component?: React.ElementType;
  children?: React.ReactNode;
  ref?: React.Ref<any>;
  [key: string]: any;
};
const aliases: Record<string, string[]> = {
  p: ['padding'],
  px: ['paddingLeft', 'paddingRight'],
  py: ['paddingTop', 'paddingBottom'],
  pt: ['paddingTop'],
  pb: ['paddingBottom'],
  pl: ['paddingLeft'],
  pr: ['paddingRight'],
  m: ['margin'],
  mx: ['marginLeft', 'marginRight'],
  my: ['marginTop', 'marginBottom'],
  mt: ['marginTop'],
  mb: ['marginBottom'],
  ml: ['marginLeft'],
  mr: ['marginRight'],
  bgcolor: ['backgroundColor']
};
const unitless = new Set([
  'opacity',
  'zIndex',
  'fontWeight',
  'lineHeight',
  'flex',
  'flexGrow',
  'flexShrink',
  'order',
  'gridColumn',
  'gridRow',
  'aspectRatio'
]);
const breakpoints: Record<string, number> = {
  xs: 0,
  sm: 600,
  md: 900,
  lg: 1200,
  xl: 1536
};
function cssValue(key: string, value: unknown, spacing: boolean) {
  if (typeof value === 'string') return colors[value] || value;
  if (typeof value !== 'number') return '';
  if (key === 'border') return value ? `${value}px solid var(--line)` : '0';
  if (key === 'boxShadow') return value ? '0 2px 8px #0000000a' : 'none';
  if (key === 'borderRadius') return `${value * 4}px`;
  if (unitless.has(key)) return String(value);
  if (
    /^(?:min|max)?(?:Width|Height)$|^(?:width|height)$/.test(key) &&
    value > 0 &&
    value <= 1
  )
    return `${value * 100}%`;
  return `${value * (spacing ? 8 : 1)}px`;
}
function serialize(selector: string, styles: StyleMap): string {
  let declarations = '',
    nested = '';
  for (const [rawKey, value] of Object.entries(styles)) {
    if (value == null || value === false) continue;
    if (typeof value === 'object') {
      const object = value as StyleMap;
      if (rawKey.startsWith('@'))
        nested += `${rawKey}{${serialize(selector, object)}}`;
      else if (Object.keys(object).every((k) => k in breakpoints)) {
        for (const [bp, v] of Object.entries(object))
          nested += `@media(min-width:${breakpoints[bp]}px){${serialize(selector, { [rawKey]: v })}}`;
      } else
        nested += serialize(
          rawKey.includes('&')
            ? rawKey.replaceAll('&', selector)
            : `${selector} ${rawKey}`,
          object
        );
      continue;
    }
    for (const key of aliases[rawKey] || [rawKey]) {
      const property = key.replace(/[A-Z]/g, (l) => '-' + l.toLowerCase());
      declarations += `${property}:${cssValue(key, value, /^(?:[mp][xytrbl]?|gap|rowGap|columnGap)$/.test(rawKey))};`;
    }
  }
  return `${selector}{${declarations}}${nested}`;
}
// Styles belong to their mounted component and are removed with it; changing a
// slider does not accumulate global rules. useInsertionEffect avoids layout flashes.
function useStyles(sx?: Sx, className = '') {
  const id = 'ui-' + useId().replace(/[^a-zA-Z0-9-]/g, '');
  const css = sx
    ? serialize('.' + id, typeof sx === 'function' ? sx(useTheme()) : sx)
    : '';
  useInsertionEffect(() => {
    if (!css) return;
    const element = document.createElement('style');
    element.textContent = css;
    document.head.append(element);
    return () => element.remove();
  }, [css]);
  return `${id} ${className}`;
}
export function useTheme(): Theme {
  return {
    ...theme,
    palette: {
      ...theme.palette,
      mode: document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light'
    }
  };
}
export function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(
    () => window.matchMedia(query).matches
  );
  useEffect(() => {
    const m = window.matchMedia(query);
    const update = () => setMatches(m.matches);
    update();
    m.addEventListener('change', update);
    return () => m.removeEventListener('change', update);
  }, [query]);
  return matches;
}
export function Box({
  component: Tag = 'div',
  sx,
  className,
  children,
  ...props
}: BaseProps) {
  return (
    <Tag className={useStyles(sx, className)} {...props}>
      {children}
    </Tag>
  );
}
export function Stack({
  direction = 'column',
  spacing = 0,
  sx,
  ...props
}: BaseProps) {
  return (
    <Box
      {...props}
      sx={{
        display: 'flex',
        flexDirection: direction,
        gap: spacing,
        ...(typeof sx === 'function' ? sx(useTheme()) : sx)
      }}
    />
  );
}
export function Grid({
  container,
  spacing = 0,
  size,
  sx,
  ...props
}: BaseProps) {
  const columns = typeof size === 'number' ? { xs: size } : size || { xs: 12 };
  const gridColumn = Object.fromEntries(
    Object.entries(columns).map(([bp, n]) => [
      bp,
      n === 'grow' ? 'auto' : `span ${n}`
    ])
  );
  return (
    <Box
      {...props}
      sx={{
        minWidth: 0,
        ...(container
          ? {
              display: 'grid',
              gridTemplateColumns: 'repeat(12, minmax(0, 1fr))',
              gap: spacing
            }
          : { gridColumn }),
        ...(typeof sx === 'function' ? sx(useTheme()) : sx)
      }}
    />
  );
}
export function Typography({
  variant = 'body1',
  component,
  sx,
  ...props
}: BaseProps) {
  return (
    <Box
      {...props}
      component={component || (/^h[1-6]$/.test(variant) ? variant : 'p')}
      className={`ui-type ui-${variant} ${props.className || ''}`}
      sx={sx}
    />
  );
}
export function Paper(props: BaseProps) {
  const { elevation, ...rest } = props;
  return <Box {...rest} className={`ui-paper ${props.className || ''}`} />;
}
export function Divider(props: BaseProps) {
  return <Box {...props} component="hr" className="ui-divider" />;
}
type ButtonProps = Omit<
  React.ButtonHTMLAttributes<HTMLButtonElement>,
  'color'
> & {
  sx?: Sx;
  variant?: string;
  startIcon?: React.ReactNode;
  endIcon?: React.ReactNode;
  size?: string;
  color?: string;
  component?: React.ElementType;
  [key: string]: any;
};
export function Button({
  sx,
  variant = 'text',
  startIcon,
  endIcon,
  size,
  color,
  component: Tag = 'button',
  className,
  children,
  ...props
}: ButtonProps) {
  return (
    <Tag
      type={Tag === 'button' ? 'button' : undefined}
      {...props}
      className={useStyles(
        sx,
        `ui-button ui-button-${variant} ${className || ''}`
      )}
    >
      {startIcon}
      {children}
      {endIcon}
    </Tag>
  );
}
export function IconButton(props: ButtonProps) {
  return (
    <Button {...props} className={`ui-icon-button ${props.className || ''}`} />
  );
}
export function Tooltip({
  title,
  children
}: {
  title?: React.ReactNode;
  children: React.ReactElement<Record<string, unknown>>;
}) {
  return (
    <span title={typeof title === 'string' ? title : undefined}>
      {React.cloneElement(children, {
        'aria-label':
          children.props['aria-label'] ||
          (typeof title === 'string' ? title : undefined)
      })}
    </span>
  );
}
export type TextFieldProps = Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  'size' | 'onChange'
> & {
  onChange?: React.ChangeEventHandler<
    HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
  >;
  sx?: Sx;
  label?: React.ReactNode;
  helperText?: React.ReactNode;
  error?: boolean;
  multiline?: boolean;
  rows?: number;
  minRows?: number;
  maxRows?: number;
  fullWidth?: boolean;
  select?: boolean;
  variant?: string;
  size?: string;
  slotProps?: Record<string, any>;
  InputProps?: Record<string, any>;
  inputProps?: Record<string, any>;
  inputRef?: React.Ref<any>;
  [key: string]: any;
};
export function TextField({
  sx,
  label,
  helperText,
  error,
  multiline,
  rows = 10,
  minRows,
  maxRows,
  fullWidth,
  select,
  variant,
  size,
  slotProps,
  InputProps,
  inputProps,
  inputRef,
  className,
  children,
  ...props
}: TextFieldProps) {
  const generatedId = useId();
  const id = props.id || generatedId;
  const hintId = id + '-hint';
  const native = { ...props, ...inputProps, ...slotProps?.htmlInput };
  delete native.sx;
  const adornments = slotProps?.input || InputProps;
  const controlProps = {
    ...native,
    id,
    ref: inputRef,
    className: 'ui-input',
    'aria-invalid': error || undefined,
    'aria-describedby': helperText ? hintId : native['aria-describedby']
  };
  return (
    <div
      className={useStyles(
        sx,
        `ui-field ${fullWidth ? 'ui-full' : ''} ${error ? 'ui-error' : ''} ${className || ''}`
      )}
    >
      {label && <label htmlFor={id}>{label}</label>}
      <div className="ui-input-wrap">
        {adornments?.startAdornment}
        {select ? (
          <select {...(controlProps as any)}>{children}</select>
        ) : multiline ? (
          <textarea {...(controlProps as any)} rows={minRows || rows} />
        ) : (
          <input {...(controlProps as any)} />
        )}
        {adornments?.endAdornment}
      </div>
      {helperText && (
        <span id={hintId} className="ui-helper">
          {helperText}
        </span>
      )}
    </div>
  );
}
export type SelectChangeEvent<T = string> = Omit<
  React.ChangeEvent<HTMLSelectElement>,
  'target'
> & { target: EventTarget & { value: T; name: string } };
export function Select<T = string>({
  sx,
  label,
  labelId,
  fullWidth,
  displayEmpty,
  size,
  variant,
  children,
  onChange,
  ...props
}: Omit<BaseProps, 'onChange'> & {
  value?: T;
  onChange?: (event: SelectChangeEvent<T>) => void;
}) {
  const generatedId = useId();
  const id = props.id || generatedId;
  return (
    <div className={useStyles(sx, `ui-field ${fullWidth ? 'ui-full' : ''}`)}>
      {label && <label htmlFor={id}>{label}</label>}
      <select
        {...props}
        id={id}
        value={String(props.value ?? '')}
        className="ui-input"
        aria-labelledby={labelId}
        onChange={
          onChange as unknown as React.ChangeEventHandler<HTMLSelectElement>
        }
      >
        {children}
      </select>
    </div>
  );
}
export function MenuItem({ children, selected, sx, ...props }: BaseProps) {
  const className = useStyles(sx, `ui-menu-item ${selected ? 'selected' : ''}`);
  if ('value' in props)
    return (
      <option value={String(props.value)} disabled={props.disabled}>
        {children}
      </option>
    );
  return (
    <button type="button" {...props} className={className}>
      {children}
    </button>
  );
}
type CheckProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> & {
  sx?: Sx;
  size?: string;
  color?: string;
  inputProps?: Record<string, any>;
};
export function Checkbox({
  sx,
  size,
  color,
  inputProps,
  ...props
}: CheckProps) {
  return (
    <input
      {...props}
      {...inputProps}
      type="checkbox"
      className={useStyles(sx, 'ui-check')}
    />
  );
}
const RadioContext = createContext<{
  name?: string;
  value?: unknown;
  onChange?: React.ChangeEventHandler<HTMLInputElement>;
}>({});
export function Radio({ sx, size, color, inputProps, ...props }: CheckProps) {
  const group = useContext(RadioContext);
  return (
    <input
      name={group.name}
      checked={
        group.value == null
          ? undefined
          : String(group.value) === String(props.value)
      }
      onChange={group.onChange}
      {...props}
      {...inputProps}
      type="radio"
      className={useStyles(sx, 'ui-check')}
    />
  );
}
export function Switch(props: CheckProps) {
  return <Checkbox {...props} role="switch" className="ui-switch" />;
}
export function FormControlLabel({
  control,
  label,
  sx,
  value,
  disabled,
  ...props
}: BaseProps & { control: React.ReactElement }) {
  return (
    <label {...props} className={useStyles(sx, 'ui-choice')}>
      {React.cloneElement(control as React.ReactElement<any>, {
        ...(value !== undefined ? { value } : {}),
        ...(disabled !== undefined ? { disabled } : {})
      })}
      <span>{uiText(label)}</span>
    </label>
  );
}
export function FormGroup({ row, ...props }: BaseProps) {
  return <Box {...props} className={`ui-choices ${row ? 'row' : ''}`} />;
}
export function RadioGroup({
  name,
  value,
  onChange,
  row,
  ...props
}: Omit<BaseProps, 'onChange'> & {
  onChange?: React.ChangeEventHandler<HTMLInputElement>;
}) {
  const generatedId = useId();
  return (
    <RadioContext.Provider
      value={{ name: name || generatedId, value, onChange }}
    >
      <FormGroup {...props} row={row} role="radiogroup" />
    </RadioContext.Provider>
  );
}
export function FormControl({ fullWidth, size, ...props }: BaseProps) {
  return <Box {...props} className="ui-field" />;
}
export function InputLabel(props: BaseProps) {
  return <Box {...props} component="label" />;
}
export function InputAdornment({ position, ...props }: BaseProps) {
  return <Box {...props} component="span" className="ui-adornment" />;
}
export function Slider({
  value,
  min = 0,
  max = 100,
  step = 1,
  onChange,
  sx,
  valueLabelDisplay,
  valueLabelFormat,
  marks,
  size,
  ...props
}: Omit<BaseProps, 'onChange'> & {
  value: number | number[];
  onChange?: (event: Event, value: number | number[]) => void;
  valueLabelFormat?: (value: number) => string;
}) {
  const numericValue = Array.isArray(value) ? value[0] : value;
  return (
    <div className={useStyles(sx, 'ui-range')}>
      <input
        {...props}
        type="range"
        min={min}
        max={max}
        step={step}
        value={numericValue}
        aria-valuetext={valueLabelFormat?.(numericValue)}
        onChange={(event) =>
          onChange?.(event.nativeEvent, Number(event.target.value))
        }
      />
      {valueLabelDisplay && (
        <output>{valueLabelFormat?.(numericValue) || numericValue}</output>
      )}
    </div>
  );
}
export function CircularProgress({
  size = 26,
  value,
  variant,
  sx,
  ...props
}: BaseProps) {
  return (
    <span
      {...props}
      role="progressbar"
      aria-label={uiText('Loading')}
      className={useStyles(sx, 'ui-spinner')}
      style={{ width: size, height: size }}
    />
  );
}
export function Alert({ severity = 'info', children, ...props }: BaseProps) {
  return (
    <Box
      {...props}
      role={severity === 'error' ? 'alert' : 'status'}
      className={`ui-alert ui-alert-${severity}`}
    >
      {children}
    </Box>
  );
}
export function Chip({
  label,
  variant,
  color,
  size,
  onClick,
  ...props
}: BaseProps) {
  return (
    <Button
      {...props}
      onClick={onClick as any}
      variant={variant === 'filled' ? 'contained' : 'outlined'}
    >
      {label}
    </Button>
  );
}
export function Table(props: BaseProps) {
  return (
    <div className="ui-table-scroll">
      <Box {...props} component="table" className="ui-table" />
    </div>
  );
}
export function TableBody(props: BaseProps) {
  return <Box {...props} component="tbody" />;
}
export function TableHead(props: BaseProps) {
  return <Box {...props} component="thead" />;
}
export function TableRow(props: BaseProps) {
  return <Box {...props} component="tr" />;
}
export function TableCell({ align, ...props }: BaseProps) {
  return <Box {...props} component="td" style={{ textAlign: align }} />;
}
export function Autocomplete({
  options,
  value,
  onChange,
  renderInput,
  sx,
  ...props
}: Omit<BaseProps, 'onChange'> & {
  options: string[];
  onChange: (event: React.SyntheticEvent, value: string | null) => void;
  renderInput: (params: Record<string, any>) => React.ReactNode;
}) {
  const id = useId();
  return (
    <div className={useStyles(sx)}>
      {renderInput({
        value: value || '',
        onChange: (event: React.ChangeEvent<HTMLInputElement>) =>
          onChange(event, event.target.value),
        slotProps: { htmlInput: { list: id } }
      })}
      <datalist id={id}>
        {options.map((option) => (
          <option value={option} key={option} />
        ))}
      </datalist>
    </div>
  );
}

// Native dialog supplies focus trapping, Escape handling and focus restoration.
export function Drawer({
  open,
  onClose,
  children,
  slotProps
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  slotProps?: Record<string, any>;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (open) dialog.current?.showModal();
    else dialog.current?.close();
  }, [open]);
  return (
    <dialog
      ref={dialog}
      aria-label={uiText('Navigation')}
      className="ui-drawer"
      onCancel={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="ui-drawer-panel">
        <button
          className="ui-drawer-close"
          aria-label={uiText('Close')}
          onClick={onClose}
        >
          ×
        </button>
        {children}
      </div>
    </dialog>
  );
}
export function Menu({
  open,
  onClose,
  anchorEl,
  children,
  id,
  slotProps
}: {
  open: boolean;
  onClose: () => void;
  anchorEl: HTMLElement | null;
  children: React.ReactNode;
  id?: string;
  anchorOrigin?: unknown;
  transformOrigin?: unknown;
  slotProps?: Record<string, any>;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    ref.current
      ?.querySelector<HTMLElement>('[aria-checked="true"],button')
      ?.focus();
    const close = (event: PointerEvent) => {
      if (
        !ref.current?.contains(event.target as Node) &&
        !anchorEl?.contains(event.target as Node)
      )
        onClose();
    };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [open]);
  if (!open || !anchorEl) return null;
  const bounds = anchorEl.getBoundingClientRect();
  return createPortal(
    <div
      ref={ref}
      id={id}
      role="menu"
      aria-label={slotProps?.list?.['aria-label']}
      className="ui-menu"
      style={{
        top: bounds.bottom + 8,
        right: Math.max(12, window.innerWidth - bounds.right)
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          onClose();
          anchorEl.focus();
        }
        const buttons = [
          ...(ref.current?.querySelectorAll<HTMLButtonElement>('button') || [])
        ];
        if (['ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) {
          event.preventDefault();
          const index = buttons.indexOf(
            document.activeElement as HTMLButtonElement
          );
          buttons[
            event.key === 'Home'
              ? 0
              : event.key === 'End'
                ? buttons.length - 1
                : (index +
                    (event.key === 'ArrowUp' ? -1 : 1) +
                    buttons.length) %
                  buttons.length
          ]?.focus();
        }
        if (event.key === 'Tab') {
          onClose();
          anchorEl.focus();
        }
      }}
      onClick={() => anchorEl.focus()}
    >
      {children}
    </div>,
    document.body
  );
}
