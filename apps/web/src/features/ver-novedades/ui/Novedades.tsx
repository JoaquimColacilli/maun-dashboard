import { useEffect, useId, useLayoutEffect, useRef } from 'react';

import { useAnchoDePantalla, useHayAlgoEnCurso } from '@/shared/lib';
import { Icono } from '@/shared/ui';

import {
  abrirNovedades,
  cerrarNovedades,
  useNovedadesAbiertas,
  type NovedadesAbiertas,
} from '../model/abiertas';
import { etiquetaDeLaVersion } from '../model/version';
import { tomarNovedadesSinVer } from '../model/vistas';

const EN_EL_CELULAR =
  'inset-x-0 top-auto bottom-0 max-h-[75dvh] w-full rounded-t-sheet border-x-0 border-t border-b-0';

const EN_LA_PANTALLA_GRANDE =
  'top-auto right-auto bottom-4 max-h-[min(560px,calc(100dvh-32px))] w-[min(420px,calc(100%-32px))] rounded-panel border';

const AL_LADO_DE_LA_NAVEGACION = { tablet: 'left-[92px]', escritorio: 'left-[248px]' } as const;

function Capa({ abiertas }: { abiertas: NovedadesAbiertas }) {
  const ancho = useAnchoDePantalla();
  const idTitulo = useId();
  const capa = useRef<HTMLElement>(null);
  const abierta = useRef(false);
  const focoPrevio = useRef<HTMLElement | null>(null);

  useLayoutEffect(() => {
    const elemento = capa.current;
    if (elemento === null) return;
    if (!abierta.current) elemento.showPopover();
    abierta.current = true;
    if (abiertas.solas) return;
    const activo = document.activeElement;
    focoPrevio.current = activo instanceof HTMLElement ? activo : null;
    elemento.focus();
  }, [abiertas]);

  function cerrar(): void {
    const volverA = focoPrevio.current;
    cerrarNovedades();
    volverA?.focus();
  }

  const lugar =
    ancho === 'movil'
      ? EN_EL_CELULAR
      : `${EN_LA_PANTALLA_GRANDE} ${AL_LADO_DE_LA_NAVEGACION[ancho]}`;

  return (
    <section
      ref={capa}
      popover="auto"
      tabIndex={-1}
      aria-labelledby={idTitulo}
      onToggle={(evento) => {
        if (evento.newState !== 'closed') return;
        abierta.current = false;
        cerrarNovedades();
      }}
      className={`fixed m-0 flex-col overflow-hidden border-hairline bg-paper p-0 text-ink shadow-float outline-none open:flex ${lugar}`}
    >
      <header className="flex flex-none items-center justify-between gap-3 border-b border-hairline py-2.5 pr-2.5 pl-5">
        <h2 id={idTitulo} className="text-body-lg leading-snug font-semibold">
          Novedades de la app
        </h2>
        <button
          type="button"
          onClick={cerrar}
          aria-label="Cerrar las novedades"
          className="flex size-11 flex-none items-center justify-center rounded-field text-text-2 hover:bg-surface"
        >
          <Icono nombre="x" tamano={20} />
        </button>
      </header>
      <div className="flex min-h-0 flex-col gap-5 overflow-y-auto px-5 pt-4 pb-[calc(1.25rem+env(safe-area-inset-bottom))]">
        {abiertas.novedades.map((novedad) => (
          <div key={novedad.version} className="flex flex-col gap-2">
            <h3 className="text-label font-semibold text-text-2">
              {etiquetaDeLaVersion(novedad.version)}
            </h3>
            <ul className="flex list-disc flex-col gap-2 pl-5 text-body leading-relaxed">
              {novedad.lineas.map((linea) => (
                <li key={linea}>{linea}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}

export function Novedades() {
  const abiertas = useNovedadesAbiertas();
  const hayAlgoEnCurso = useHayAlgoEnCurso();
  const decidido = useRef(false);

  useEffect(() => {
    if (decidido.current || hayAlgoEnCurso) return;
    decidido.current = true;
    const sinVer = tomarNovedadesSinVer();
    if (sinVer.length > 0) abrirNovedades(sinVer, true);
  }, [hayAlgoEnCurso]);

  useEffect(
    () => () => {
      cerrarNovedades();
    },
    [],
  );

  if (abiertas === null) return null;
  return <Capa abiertas={abiertas} />;
}
