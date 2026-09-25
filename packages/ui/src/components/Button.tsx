import type { ButtonHTMLAttributes } from 'react';

const BASE =
  'inline-flex items-center justify-center gap-2 rounded-pill py-1.5 text-center font-medium transition-colors duration-(--dur-fast) ease-out';

const VARIANTES = {
  primario: 'bg-ink px-[18px] text-paper enabled:hover:bg-ink-hover',
  secundario: 'border border-border bg-paper px-4 text-ink enabled:hover:bg-surface',
  terciario: 'bg-transparent px-3 text-ink underline underline-offset-3',
  peligro: 'bg-alerta px-[18px] text-paper',
  herramienta: 'border border-hairline bg-paper text-ink enabled:hover:bg-surface',
} as const;

const TAMANOS = {
  grande: 'min-h-field text-body-lg',
  normal: 'min-h-button text-body',
  chico: 'min-h-button-sm text-label',
  herramienta: 'min-h-11 min-w-11 text-label',
} as const;

const DESHABILITADO = 'cursor-not-allowed bg-hairline px-[18px] text-text-3';
const HERRAMIENTA_DESHABILITADA = 'cursor-not-allowed border border-hairline bg-paper text-text-3';

export type ButtonVariant = keyof typeof VARIANTES;
export type ButtonSize = keyof typeof TAMANOS;

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  cargando?: boolean;
}

export function Button({
  variant = 'primario',
  size = 'normal',
  cargando = false,
  disabled = false,
  type = 'button',
  className = '',
  children,
  ...props
}: ButtonProps) {
  const deshabilitado = variant === 'herramienta' ? HERRAMIENTA_DESHABILITADA : DESHABILITADO;
  const apariencia = disabled && !cargando ? deshabilitado : VARIANTES[variant];
  return (
    <button
      {...props}
      type={type}
      disabled={disabled || cargando}
      aria-busy={cargando || undefined}
      className={[BASE, TAMANOS[size], apariencia, cargando ? 'opacity-70' : '', className].join(
        ' ',
      )}
    >
      {cargando && (
        <span
          aria-hidden
          className="size-4 animate-maun-spin rounded-full border-2 border-paper/35 border-t-paper"
        />
      )}
      {children}
    </button>
  );
}
