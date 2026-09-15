import { useState, type KeyboardEvent } from 'react';

import { pesoLegible, rutaDelArchivo, type Archivo } from '@/entities/archivo';
import { urlDelArchivo } from '@/shared/api';
import { Button, Hoja, Icono } from '@/shared/ui';

export interface VisorDeImagenesProps {
  imagenes: readonly Archivo[];
  inicial: string;
  alCerrar: () => void;
  alBorrar: (archivo: Archivo) => void;
}

export function VisorDeImagenes({ imagenes, inicial, alCerrar, alBorrar }: VisorDeImagenesProps) {
  const [elegido, setElegido] = useState(inicial);
  const indice = Math.max(
    0,
    imagenes.findIndex((imagen) => imagen.id === elegido),
  );
  const imagen = imagenes[indice];
  const total = imagenes.length;

  function mover(paso: number): void {
    const siguiente = imagenes[(indice + paso + total) % total];
    if (siguiente) setElegido(siguiente.id);
  }

  function alTeclear(evento: KeyboardEvent<HTMLDivElement>): void {
    if (total < 2) return;
    if (evento.key === 'ArrowRight') mover(1);
    if (evento.key === 'ArrowLeft') mover(-1);
  }

  if (imagen === undefined) return null;
  const url = urlDelArchivo(rutaDelArchivo(imagen));

  return (
    <Hoja titulo={imagen.nombre} ancho="visor" alCerrar={alCerrar}>
      <div
        onKeyDown={alTeclear}
        className="flex min-h-0 flex-1 flex-col gap-3 px-3 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] md:px-4 md:pb-4"
      >
        <div className="flex min-h-0 flex-auto items-center justify-center overflow-hidden rounded-field bg-surface">
          <img
            key={imagen.id}
            src={url}
            alt={imagen.nombre}
            width={imagen.ancho ?? undefined}
            height={imagen.alto ?? undefined}
            decoding="async"
            className="h-auto max-h-[68dvh] w-auto max-w-full object-contain"
          />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-meta text-text-2 tabular-nums">
            {total > 1 ? `${String(indice + 1)} de ${String(total)} · ` : ''}
            {pesoLegible(imagen.bytes)}
          </span>
          <div className="flex flex-wrap items-center gap-2">
            {total > 1 && (
              <>
                <Button
                  variant="secundario"
                  size="chico"
                  aria-label="Anterior"
                  onClick={() => {
                    mover(-1);
                  }}
                >
                  <Icono nombre="chevron-left" tamano={16} />
                </Button>
                <Button
                  variant="secundario"
                  size="chico"
                  aria-label="Siguiente"
                  onClick={() => {
                    mover(1);
                  }}
                >
                  <Icono nombre="chevron-right" tamano={16} />
                </Button>
              </>
            )}
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex min-h-tap items-center gap-1.5 rounded-field px-2 text-label font-medium underline underline-offset-3"
            >
              <Icono nombre="maximize-2" tamano={15} />
              Abrir en otra pestaña
            </a>
            <Button
              variant="secundario"
              size="chico"
              onClick={() => {
                alBorrar(imagen);
              }}
            >
              <Icono nombre="trash-2" tamano={15} />
              Borrar
            </Button>
          </div>
        </div>
      </div>
    </Hoja>
  );
}
