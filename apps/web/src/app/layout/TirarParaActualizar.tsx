import type { ReactNode, RefObject } from 'react';

import {
  describirDesenlace,
  useSincronizarAhora,
  type DesenlaceDeLaSincronizacion,
} from '@/entities/replica';
import {
  describirEstadoSync,
  useEstadoSync,
  useTirarParaActualizar,
  type EstadoSync,
  type FaseDelTiron,
} from '@/shared/lib';
import { Icono } from '@/shared/ui';

const ALTO_DEL_INDICADOR = 40;
const RADIO_DEL_ANILLO = 12;
const VUELTA_DEL_ANILLO = 2 * Math.PI * RADIO_DEL_ANILLO;

type EstadoDelIndicador =
  'tirando' | 'listo-para-soltar' | 'sincronizando' | 'sin-conexion' | 'desenlace';

interface LoQueSeMuestra {
  estado: EstadoDelIndicador;
  texto: string;
  icono: ReactNode;
  lleno: boolean;
  anillo: number | null;
}

function queMostrar(
  fase: FaseDelTiron,
  avance: number,
  desenlace: DesenlaceDeLaSincronizacion | null,
  estadoSync: EstadoSync,
): LoQueSeMuestra {
  if (desenlace !== null && (fase === 'desenlace' || fase === 'volviendo')) {
    const { icono, texto } = describirDesenlace(desenlace);
    return {
      estado: 'desenlace',
      texto,
      icono: <Icono nombre={icono} tamano={16} grosor={2} />,
      lleno: false,
      anillo: null,
    };
  }
  if (fase === 'sincronizando' && estadoSync.tipo === 'sin-conexion') {
    return {
      estado: 'sin-conexion',
      texto: describirEstadoSync(estadoSync),
      icono: <Icono nombre="cloud-off" tamano={16} grosor={2} />,
      lleno: false,
      anillo: null,
    };
  }
  if (fase === 'sincronizando') {
    return {
      estado: 'sincronizando',
      texto: 'Sincronizando…',
      icono: (
        <Icono
          nombre="refresh-cw"
          tamano={16}
          grosor={2}
          className="motion-safe:animate-maun-spin"
        />
      ),
      lleno: true,
      anillo: null,
    };
  }
  const listo = avance >= 1;
  return {
    estado: listo ? 'listo-para-soltar' : 'tirando',
    texto: listo ? 'Soltá para actualizar' : 'Tirá para actualizar',
    icono: (
      <>
        <span
          data-flecha-que-gira
          className="flex motion-reduce:hidden"
          style={{ rotate: `${String(Math.round(avance * 180))}deg` }}
        >
          <Icono nombre="arrow-down" tamano={16} grosor={2} />
        </span>
        <span className="hidden motion-reduce:flex">
          <Icono nombre={listo ? 'arrow-up' : 'arrow-down'} tamano={16} grosor={2} />
        </span>
      </>
    ),
    lleno: listo,
    anillo: avance,
  };
}

export interface TirarParaActualizarProps {
  contenedor: RefObject<HTMLElement | null>;
  usuarioId: string;
  deshabilitado: boolean;
}

export function TirarParaActualizar({
  contenedor,
  usuarioId,
  deshabilitado,
}: TirarParaActualizarProps) {
  const sincronizarAhora = useSincronizarAhora(usuarioId);
  const { distancia, avance, fase, desenlace } = useTirarParaActualizar(
    sincronizarAhora,
    contenedor,
    deshabilitado,
  );
  const estadoSync = useEstadoSync();

  if (fase === 'quieto') return null;

  const { estado, texto, icono, lleno, anillo } = queMostrar(fase, avance, desenlace, estadoSync);

  return (
    <div
      aria-hidden
      data-tirar-para-actualizar={estado}
      className="pointer-events-none sticky top-0 z-10 h-0"
    >
      <div
        style={{
          transform: `translateY(${String(distancia - ALTO_DEL_INDICADOR)}px)`,
          opacity: fase === 'volviendo' ? 0 : 1,
        }}
        className={`absolute top-0 left-1/2 flex min-h-10 w-max max-w-[calc(100vw-40px)] -translate-x-1/2 items-center gap-2.5 rounded-pill border border-hairline bg-elevado py-1.5 pr-4 pl-1.5 text-label leading-tight font-medium text-ink shadow-float ${
          fase === 'tirando'
            ? ''
            : 'transition-[transform,opacity] duration-(--dur-medium) ease-out'
        }`}
      >
        <span
          className={`relative flex size-7 flex-none items-center justify-center rounded-pill ${
            lleno ? 'bg-ink text-paper' : 'text-ink'
          }`}
        >
          {anillo !== null && !lleno && (
            <svg viewBox="0 0 28 28" className="absolute inset-0 size-full -rotate-90">
              <circle
                cx="14"
                cy="14"
                r={RADIO_DEL_ANILLO}
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeDasharray={VUELTA_DEL_ANILLO}
                strokeDashoffset={VUELTA_DEL_ANILLO * (1 - anillo)}
              />
            </svg>
          )}
          {icono}
        </span>
        <span>{texto}</span>
      </div>
    </div>
  );
}
