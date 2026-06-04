/**
 * FormFieldFloating — input estilo Stripe/Linear con floating label.
 *
 * El label flota en el border-top del input. Focus ring tinted azul.
 * Border completo redondeado. Funciona para input/select/textarea.
 *
 * Uso:
 *   <FormFieldFloating label="Cantidad (cubetas)" value={cant} onChange={setCant} type="number" />
 *   <FormFieldFloating label="Fórmula" as="select" value={f} onChange={setF}>
 *     <option>BLANCO MATE 4.0</option>
 *   </FormFieldFloating>
 *   <FormFieldFloating label="Notas" as="textarea" rows={3} value={n} onChange={setN} />
 *
 * Props:
 *   - label:     texto del label (siempre flotante arriba)
 *   - value:     valor controlado
 *   - onChange:  callback (recibe el evento de input o el valor según `valueOnly`)
 *   - valueOnly: si true, onChange recibe solo el valor (no el evento)
 *   - type:      'text' | 'number' | 'password' | 'email' | etc. (default text)
 *   - as:        'input' (default) | 'select' | 'textarea'
 *   - error:     mensaje de error (cambia border a rojo + texto debajo)
 *   - hint:      texto descriptivo debajo (no error)
 *   - disabled
 *   - required
 *   - placeholder
 *   - rows:      solo para textarea
 *
 * Wrapper field group:
 *   <FormGroup title="Nuevo pedido">
 *     <FormFieldFloating ... />
 *     <FormFieldFloating ... />
 *   </FormGroup>
 */

import { useId, useState } from 'react';

export default function FormFieldFloating({
  label,
  value,
  onChange,
  valueOnly = false,
  type = 'text',
  as = 'input',
  error,
  hint,
  disabled = false,
  required = false,
  placeholder,
  rows = 3,
  children,
  style,
  ...rest
}) {
  const id = useId();
  const [focused, setFocused] = useState(false);

  const borderColor = error
    ? 'var(--lp-danger-600)'
    : (focused ? 'var(--lp-brand-600)' : 'var(--lp-border-subtle)');
  const ringStyle = focused
    ? (error ? 'var(--lp-focus-ring-danger)' : 'var(--lp-focus-ring)')
    : 'none';

  const handleChange = (e) => {
    if (!onChange) return;
    if (valueOnly) onChange(e.target.value);
    else onChange(e);
  };

  const inputBaseStyle = {
    width: '100%',
    border: 'none',
    background: 'transparent',
    fontSize: 15,
    fontWeight: as === 'select' ? 500 : 400,
    color: 'var(--lp-text-primary)',
    padding: 0,
    fontFamily: 'inherit',
    outline: 'none',
    minHeight: as === 'textarea' ? `${rows * 1.4}em` : 'auto',
    resize: as === 'textarea' ? 'vertical' : undefined,
  };

  return (
    <div style={{ position: 'relative', marginBottom: 14, ...style }}>
      {label && (
        <label
          htmlFor={id}
          style={{
            position: 'absolute',
            left: 12, top: -7,
            background: 'var(--lp-bg-base)',
            padding: '0 6px',
            fontSize: 11,
            fontWeight: 600,
            color: error ? 'var(--lp-danger-600)' : (focused ? 'var(--lp-brand-600)' : 'var(--lp-text-secondary)'),
            zIndex: 1,
            pointerEvents: 'none',
            transition: 'color .12s',
          }}
        >
          {label}{required && <span style={{ color: 'var(--lp-danger-600)', marginLeft: 2 }}>*</span>}
        </label>
      )}
      <div
        style={{
          background: disabled ? 'var(--lp-bg-sunken)' : 'var(--lp-bg-raised)',
          border: `1.5px solid ${borderColor}`,
          borderRadius: 'var(--lp-radius-md)',
          padding: '12px 14px',
          boxShadow: ringStyle,
          transition: 'border-color .12s, box-shadow .12s',
        }}
      >
        {as === 'select' ? (
          <select
            id={id}
            value={value ?? ''}
            onChange={handleChange}
            disabled={disabled}
            required={required}
            style={inputBaseStyle}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            {...rest}
          >
            {children}
          </select>
        ) : as === 'textarea' ? (
          <textarea
            id={id}
            value={value ?? ''}
            onChange={handleChange}
            disabled={disabled}
            required={required}
            placeholder={placeholder}
            rows={rows}
            style={inputBaseStyle}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            {...rest}
          />
        ) : (
          <input
            id={id}
            type={type}
            value={value ?? ''}
            onChange={handleChange}
            disabled={disabled}
            required={required}
            placeholder={placeholder}
            style={inputBaseStyle}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            {...rest}
          />
        )}
      </div>
      {(error || hint) && (
        <div style={{
          fontSize: 11,
          marginTop: 5,
          color: error ? 'var(--lp-danger-600)' : 'var(--lp-text-tertiary)',
          paddingLeft: 4,
        }}>
          {error || hint}
        </div>
      )}
    </div>
  );
}

/** Agrupa varios FormFieldFloating con un título de sección. */
export function FormGroup({ title, children, style }) {
  return (
    <div style={{ marginBottom: 18, ...style }}>
      {title && (
        <div style={{
          fontSize: 11, fontWeight: 700,
          color: 'var(--lp-text-secondary)',
          textTransform: 'uppercase', letterSpacing: '.05em',
          marginBottom: 14,
        }}>{title}</div>
      )}
      {children}
    </div>
  );
}
