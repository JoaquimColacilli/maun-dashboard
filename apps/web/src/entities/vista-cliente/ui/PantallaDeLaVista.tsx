import type { ReactNode } from 'react';

import { hoyLocal } from '@/shared/lib';
import {
  Button,
  ESCENA_EN_LA_LAMINA,
  Ilustracion,
  Pagina,
  TarjetaConLamina,
  TITULO_DE_LAMINA,
  type NombreDeIlustracion,
} from '@/shared/ui';

import type { ResultadoDeLaVista } from '../api/consulta';
import { VistaDelCliente } from './VistaDelCliente';

export interface PantallaDeLaVistaProps {
  resultado: ResultadoDeLaVista;
  tituloMuerto: string;
  textoMuerto: string;
}

function Aviso({
  titulo,
  texto,
  ilustracion,
  accion,
}: {
  titulo: string;
  texto: string;
  ilustracion: NombreDeIlustracion;
  accion?: ReactNode;
}) {
  return (
    <Pagina>
      <div className="mx-auto flex min-h-[60vh] w-full max-w-[520px] flex-col justify-center gap-3">
        <span className="px-1 font-display text-lema text-text-2">Taller MAUN</span>
        <TarjetaConLamina
          como="div"
          dibujo={<Ilustracion nombre={ilustracion} />}
          lamina={ESCENA_EN_LA_LAMINA}
        >
          <h1 className={TITULO_DE_LAMINA}>{titulo}</h1>
          <p className="text-body leading-relaxed text-text-2">{texto}</p>
          {accion !== undefined && <div className="w-full pt-2">{accion}</div>}
        </TarjetaConLamina>
      </div>
    </Pagina>
  );
}

function Esqueleto() {
  return (
    <Pagina>
      <div aria-busy="true" className="flex flex-col gap-3 md:gap-4">
        <span className="sr-only" role="status">
          Abriendo tu mueble
        </span>
        <div className="mx-1 h-4 w-30 rounded-control bg-ink/6" />
        <div className="flex flex-col gap-5 rounded-panel border border-hairline bg-paper px-4 py-4 md:px-5">
          <div className="flex flex-col gap-2.5">
            <div className="h-5.5 w-3/4 rounded-field bg-ink/6" />
            <div className="h-13 w-1/2 rounded-field bg-ink/6" />
            <div className="h-3.5 w-2/5 rounded-control bg-ink/6" />
          </div>
          <div className="flex gap-2.5 pt-2">
            {[1, 2, 3, 4, 5].map((puesto) => (
              <div key={puesto} className="flex flex-1 flex-col gap-2">
                <div className="size-3.5 rounded-pill bg-ink/6" />
                <div className="h-2.5 rounded-control bg-ink/6" />
              </div>
            ))}
          </div>
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
    return <Aviso titulo={tituloMuerto} texto={textoMuerto} ilustracion="anulado" />;
  }

  if (resultado.estado === 'sin-senal') {
    return (
      <Aviso
        titulo="Sin conexión"
        texto="Necesitás señal para ver el trabajo. Probá de nuevo cuando vuelva."
        ilustracion="sin-senal"
      />
    );
  }

  if (resultado.estado === 'error') {
    const reintentar = resultado.reintentar;
    return (
      <Aviso
        titulo="No pudimos cargar tu mueble"
        texto="Se cortó la conexión antes de que llegaran los datos. El enlace sigue siendo válido."
        ilustracion="se-corto"
        accion={<Button onClick={reintentar}>Probar de nuevo</Button>}
      />
    );
  }

  return <Esqueleto />;
}
