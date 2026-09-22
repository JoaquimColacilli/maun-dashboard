import type { ReactNode } from 'react';

import { hoyLocal } from '@/shared/lib';
import { Button, Pagina } from '@/shared/ui';

import type { ResultadoDeLaVista } from '../api/consulta';
import { VistaDelCliente } from './VistaDelCliente';

export interface PantallaDeLaVistaProps {
  resultado: ResultadoDeLaVista;
  tituloMuerto: string;
  textoMuerto: string;
}

function Aviso({ titulo, texto, accion }: { titulo: string; texto: string; accion?: ReactNode }) {
  return (
    <Pagina ancho="ficha">
      <div className="flex min-h-[60vh] items-center">
        <div className="flex max-w-[420px] flex-col items-start gap-3.5">
          <span className="font-display text-lema text-text-2">Taller MAUN</span>
          <h1 className="text-h1 leading-tight font-semibold">{titulo}</h1>
          <p className="text-body leading-relaxed text-text-2">{texto}</p>
          {accion}
        </div>
      </div>
    </Pagina>
  );
}

function Esqueleto() {
  return (
    <Pagina ancho="ficha">
      <div aria-busy="true" className="flex flex-col gap-5">
        <span className="sr-only" role="status">
          Abriendo tu mueble
        </span>
        <div className="h-4 w-30 rounded-control bg-surface-2" />
        <div className="flex flex-col gap-2.5">
          <div className="h-5.5 w-3/4 rounded-field bg-surface-2" />
          <div className="h-13 w-1/2 rounded-field bg-surface-2" />
          <div className="h-3.5 w-2/5 rounded-control bg-surface-2" />
        </div>
        <div className="flex gap-2.5 pt-2">
          {[1, 2, 3, 4, 5].map((puesto) => (
            <div key={puesto} className="flex flex-1 flex-col gap-2">
              <div className="size-3.5 rounded-pill bg-surface-2" />
              <div className="h-2.5 rounded-control bg-surface-2" />
            </div>
          ))}
        </div>
      </div>
    </Pagina>
  );
}

export function PantallaDeLaVista({
  resultado,
  tituloMuerto,
  textoMuerto,
}: PantallaDeLaVistaProps) {
  if (resultado.estado === 'lista') {
    return <VistaDelCliente vista={resultado.vista} hoy={hoyLocal()} />;
  }

  if (resultado.estado === 'muerto') {
    return <Aviso titulo={tituloMuerto} texto={textoMuerto} />;
  }

  if (resultado.estado === 'sin-senal') {
    return (
      <Aviso
        titulo="Sin conexión"
        texto="Necesitás señal para ver el trabajo. Probá de nuevo cuando vuelva."
      />
    );
  }

  if (resultado.estado === 'error') {
    const reintentar = resultado.reintentar;
    return (
      <Aviso
        titulo="No pudimos cargar tu mueble"
        texto="Se cortó la conexión antes de que llegaran los datos. El enlace sigue siendo válido."
        accion={<Button onClick={reintentar}>Probar de nuevo</Button>}
      />
    );
  }

  return <Esqueleto />;
}
