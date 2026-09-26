import { useEffect, useRef, useState } from 'react';

import {
  descartarDePantalla,
  useAvisosEnPantalla,
  type AvisoEnPantalla,
  type TonoDelAviso,
} from '@/shared/lib';
import { Icono, RESPALDO_DE_LA_SALIDA_MS, type NombreDeIcono } from '@/shared/ui';

import { AvisoDeRechazo } from './AvisoDeRechazo';

const ASPECTO: Readonly<
  Record<TonoDelAviso, { icono: NombreDeIcono; tono: string; borde: string }>
> = {
  hecho: { icono: 'check', tono: 'text-hogar', borde: 'border-hairline' },
  'en-cola': { icono: 'cloud-off', tono: 'text-atencion', borde: 'border-atencion' },
  error: { icono: 'triangle-alert', tono: 'text-alerta', borde: 'border-alerta' },
};

interface AvisoMostrado {
  aviso: AvisoEnPantalla;
  saliendo: boolean;
}

function conLosQueSeVan(
  mostrados: readonly AvisoMostrado[],
  avisos: readonly AvisoEnPantalla[],
): AvisoMostrado[] {
  const vivos = new Map(avisos.map((aviso) => [aviso.id, aviso]));
  const siguen = mostrados.map((mostrado) => {
    const vivo = vivos.get(mostrado.aviso.id);
    return vivo === undefined
      ? { aviso: mostrado.aviso, saliendo: true }
      : { aviso: vivo, saliendo: false };
  });
  const yaEstaban = new Set(mostrados.map((mostrado) => mostrado.aviso.id));
  const nuevos = avisos
    .filter((aviso) => !yaEstaban.has(aviso.id))
    .map((aviso) => ({ aviso, saliendo: false }));
  return [...siguen, ...nuevos];
}

function useAvisosConSalida(): {
  mostrados: readonly AvisoMostrado[];
  termino: (id: number) => void;
} {
  const avisos = useAvisosEnPantalla();
  const [mostrados, setMostrados] = useState<AvisoMostrado[]>(() =>
    avisos.map((aviso) => ({ aviso, saliendo: false })),
  );
  const [previos, setPrevios] = useState(avisos);
  if (previos !== avisos) {
    setPrevios(avisos);
    setMostrados(conLosQueSeVan(mostrados, avisos));
  }
  return {
    mostrados,
    termino: (id) => {
      setMostrados((actuales) =>
        actuales.filter((mostrado) => !(mostrado.saliendo && mostrado.aviso.id === id)),
      );
    },
  };
}

function Tarjeta({
  aviso,
  saliendo,
  alTerminarDeSalir,
}: {
  aviso: AvisoEnPantalla;
  saliendo: boolean;
  alTerminarDeSalir: () => void;
}) {
  const aspecto = ASPECTO[aviso.tono];
  const { accion } = aviso;
  const tarjeta = useRef<HTMLDivElement>(null);
  const terminar = useRef(alTerminarDeSalir);

  useEffect(() => {
    terminar.current = alTerminarDeSalir;
  });

  useEffect(() => {
    const elemento = tarjeta.current;
    if (!saliendo || !elemento) return;
    let terminado = false;
    const listo = () => {
      if (terminado) return;
      terminado = true;
      terminar.current();
    };
    const alTerminarLaTransicion = (evento: TransitionEvent) => {
      if (evento.target === elemento && evento.propertyName === 'opacity') listo();
    };
    elemento.addEventListener('transitionend', alTerminarLaTransicion);
    const respaldo = setTimeout(listo, RESPALDO_DE_LA_SALIDA_MS);
    return () => {
      elemento.removeEventListener('transitionend', alTerminarLaTransicion);
      clearTimeout(respaldo);
    };
  }, [saliendo]);

  return (
    <div
      ref={tarjeta}
      inert={saliendo}
      data-saliendo={saliendo ? '' : undefined}
      className={`aviso-en-pantalla flex items-start gap-2.5 rounded-panel border bg-paper py-2.5 pr-1.5 pl-3.5 shadow-toast ${
        saliendo ? 'pointer-events-none' : 'pointer-events-auto'
      } ${aspecto.borde}`}
    >
      <span className={`mt-0.5 flex-none ${aspecto.tono}`}>
        <Icono nombre={aspecto.icono} tamano={18} />
      </span>
      <div className="min-w-0 flex-1 py-0.5">
        <p
          className={`text-label leading-snug font-semibold ${aviso.tono === 'error' ? 'text-alerta' : ''}`}
        >
          {aviso.texto}
        </p>
        {aviso.detalle !== null && (
          <p className="mt-0.5 text-meta leading-relaxed text-text-2">{aviso.detalle}</p>
        )}
      </div>
      {accion !== null && (
        <button
          type="button"
          onClick={() => {
            descartarDePantalla(aviso.id);
            accion.alTocar();
          }}
          className="flex min-h-9 flex-none items-center rounded-field px-2.5 text-label font-semibold text-ink underline underline-offset-3 hover:bg-surface"
        >
          {accion.etiqueta}
        </button>
      )}
      <button
        type="button"
        aria-label="Cerrar el aviso"
        onClick={() => {
          descartarDePantalla(aviso.id);
        }}
        className="flex size-9 flex-none items-center justify-center rounded-field text-text-3 hover:bg-surface"
      >
        <Icono nombre="x" tamano={16} />
      </button>
    </div>
  );
}

export function Avisos() {
  const { mostrados, termino } = useAvisosConSalida();
  const tarjeta = ({ aviso, saliendo }: AvisoMostrado) => (
    <Tarjeta
      key={aviso.id}
      aviso={aviso}
      saliendo={saliendo}
      alTerminarDeSalir={() => {
        termino(aviso.id);
      }}
    />
  );
  const transitorios = mostrados.filter(({ aviso }) => aviso.tono !== 'error');
  const errores = mostrados.filter(({ aviso }) => aviso.tono === 'error');

  return (
    <div className="pointer-events-none fixed inset-x-4 bottom-(--holgura-inferior) z-20 mx-auto flex max-w-[420px] flex-col gap-2">
      <div role="status" className="flex flex-col gap-2">
        {transitorios.map(tarjeta)}
      </div>
      {errores.map((mostrado) => (
        <div key={mostrado.aviso.id} role="alert" inert={mostrado.saliendo}>
          {tarjeta(mostrado)}
        </div>
      ))}
      <AvisoDeRechazo />
    </div>
  );
}
