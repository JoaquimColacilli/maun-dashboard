import { useMutation } from '@tanstack/react-query';

import {
  esImagen,
  MUTACION_DE_ARCHIVO_COMPARTIDO,
  pesoLegible,
  loQueVeElCliente,
  type Archivo,
} from '@/entities/archivo';
import { fechaLarga, hoyLocal } from '@/shared/lib';
import { Icono } from '@/shared/ui';

import { cuantosVeElCliente } from '../model/compartir';

export interface ArchivosQueVeElClienteProps {
  archivos: readonly Archivo[];
}

export function ArchivosQueVeElCliente({ archivos }: ArchivosQueVeElClienteProps) {
  const compartir = useMutation(MUTACION_DE_ARCHIVO_COMPARTIDO);
  const vistos = loQueVeElCliente(archivos);
  const hoy = hoyLocal();

  return (
    <section aria-label="Qué archivos ve" className="mt-7">
      <div className="flex flex-wrap items-baseline justify-between gap-2.5">
        <h2 className="text-section font-semibold">Qué archivos ve</h2>
        <span className="text-label text-text-2">{cuantosVeElCliente(archivos)}</span>
      </div>
      <p className="mt-1.5 mb-2.5 text-body leading-normal text-text-2">
        Marcá uno por uno. Lo que no marques, no existe para él.
      </p>

      {vistos.ninguno && (
        <p
          role="alert"
          className="mb-2.5 flex items-baseline gap-2 rounded-panel bg-surface px-3.5 py-3 text-body leading-normal"
        >
          <Icono nombre="eye-off" tamano={16} className="flex-none translate-y-0.5 text-text-2" />
          <span>
            <span className="font-semibold">
              {vistos.total === 1
                ? 'Tenés un archivo y el cliente no lo ve.'
                : `Tenés ${String(vistos.total)} archivos y el cliente no ve ninguno.`}
            </span>{' '}
            Prendé abajo los que quieras mostrarle.
          </span>
        </p>
      )}

      {archivos.length === 0 ? (
        <p className="border-t border-hairline py-3.5 text-body text-text-2">
          Este trabajo todavía no tiene archivos. Se suben desde su ficha.
        </p>
      ) : (
        <ul className="list-none">
          {archivos.map((archivo) => (
            <li
              key={archivo.id}
              className="flex min-h-15 items-center gap-3 border-t border-hairline-soft py-2.5"
            >
              <span
                aria-hidden
                className={`flex size-10 flex-none items-center justify-center rounded-field bg-surface ${
                  archivo.visible_para_cliente ? 'text-ink' : 'text-text-3'
                }`}
              >
                <Icono nombre={esImagen(archivo) ? 'image' : 'file-text'} tamano={18} />
              </span>
              <span className="min-w-0 flex-1">
                <span
                  className={`block truncate text-body leading-normal font-medium ${
                    archivo.visible_para_cliente ? '' : 'text-text-2'
                  }`}
                >
                  {archivo.nombre}
                </span>
                <span className="block text-label text-text-3">
                  {pesoLegible(archivo.bytes)} · {fechaLarga(archivo.created_at.slice(0, 10), hoy)}
                </span>
              </span>
              <button
                type="button"
                role="switch"
                aria-checked={archivo.visible_para_cliente}
                aria-label={`Compartir ${archivo.nombre}`}
                onClick={() => {
                  compartir.mutate({ id: archivo.id, visible: !archivo.visible_para_cliente });
                }}
                className={`flex h-8 w-13 flex-none rounded-pill p-[3px] transition-colors ${
                  archivo.visible_para_cliente ? 'justify-end bg-hogar' : 'justify-start bg-border'
                }`}
              >
                <span className="size-6.5 rounded-pill bg-paper shadow-float" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
