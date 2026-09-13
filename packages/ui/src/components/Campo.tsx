import { useId, type ComponentPropsWithRef } from 'react';

export interface CampoProps extends Omit<ComponentPropsWithRef<'input'>, 'id'> {
  etiqueta: string;
  error?: string;
  ayuda?: string;
  contenedor?: string;
}

export function Campo({
  etiqueta,
  error,
  ayuda,
  contenedor = '',
  className = '',
  ...props
}: CampoProps) {
  const id = useId();
  const idAyuda = `${id}-ayuda`;
  const idError = `${id}-error`;
  const descripcion = [ayuda ? idAyuda : '', error ? idError : ''].filter(Boolean).join(' ');

  return (
    <div className={['flex flex-col gap-1.5', contenedor].join(' ')}>
      <label htmlFor={id} className="text-label text-text-2">
        {etiqueta}
      </label>
      <input
        {...props}
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={descripcion === '' ? undefined : descripcion}
        className={[
          'h-field min-w-0 rounded-field border bg-paper px-3.5 text-body-lg text-ink',
          error ? 'border-alerta' : 'border-border',
          className,
        ].join(' ')}
      />
      {(ayuda !== undefined || error !== undefined) && (
        <div className="flex flex-col gap-1.5">
          {ayuda !== undefined && (
            <span id={idAyuda} className="text-meta text-text-3">
              {ayuda}
            </span>
          )}
          {error !== undefined && (
            <span id={idError} role="alert" className="text-label font-medium text-alerta">
              {error}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
