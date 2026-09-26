import { lazy, Suspense, useState } from 'react';

import { copiar, usePantallaDespierta } from '@/shared/lib';
import { Button, FilaDeAcciones, Hoja, Icono } from '@/shared/ui';

const DibujoDelQr = lazy(async () => import('./DibujoDelQr'));

export interface HojaDelQrProps {
  trabajo: string;
  url: string;
  alCerrar: () => void;
}

export const ESCANEALO = 'Escaneá con la cámara del celular';

export const ES_EL_MISMO_ENLACE =
  'Es el mismo enlace que le mandás por WhatsApp: si lo das de baja, este código deja de andar.';

const COPIADO_MS = 2_200;

export function HojaDelQr({ trabajo, url, alCerrar }: HojaDelQrProps) {
  const [copiado, setCopiado] = useState(false);
  usePantallaDespierta(true);

  function alCopiar(): void {
    void copiar(url).then((resultado) => {
      if (resultado !== 'copiado') return;
      setCopiado(true);
      setTimeout(() => {
        setCopiado(false);
      }, COPIADO_MS);
    });
  }

  return (
    <Hoja titulo="Mostrale el código" ancho="angosto" alCerrar={alCerrar}>
      <div className="flex flex-col gap-3.5 px-5 pt-3 pb-[calc(1.25rem+env(safe-area-inset-bottom))] md:px-6 md:pb-5">
        <div className="flex flex-col gap-1">
          <span className="text-body-lg leading-tight font-semibold text-pretty">{trabajo}</span>
          <span className="text-label text-text-2">{ESCANEALO}</span>
        </div>

        <div className="rounded-panel border border-hairline bg-paper-fijo p-4">
          <Suspense
            fallback={
              <div
                aria-busy="true"
                className="aspect-square w-full rounded-field bg-surface-2 motion-safe:animate-maun-shimmer"
              >
                <span className="sr-only" role="status">
                  Dibujando el código
                </span>
              </div>
            }
          >
            <DibujoDelQr texto={url} etiqueta={`Código QR del enlace de ${trabajo}`} />
          </Suspense>
        </div>

        <p className="text-label leading-normal break-all text-text-2 select-text">{url}</p>

        <FilaDeAcciones>
          <Button variant="secundario" onClick={alCopiar}>
            <Icono nombre={copiado ? 'check' : 'copy'} tamano={18} />
            {copiado ? 'Copiado' : 'Copiar el enlace'}
          </Button>
          <Button onClick={alCerrar}>Listo</Button>
        </FilaDeAcciones>

        <p className="text-meta leading-normal text-text-3">{ES_EL_MISMO_ENLACE}</p>
      </div>
    </Hoja>
  );
}
