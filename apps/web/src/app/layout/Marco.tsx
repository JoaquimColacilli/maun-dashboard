import { useEffect, useRef, useState } from 'react';
import { useLocation, useRoutes, type Location } from 'react-router';

import { useSesionActiva } from '@/entities/sesion';
import {
  describirEstadoSync,
  esRutaDeHoja,
  useAnchoDePantalla,
  useEstadoSync,
  useUbicacionVisible,
} from '@/shared/lib';
import { ConSalida } from '@/shared/ui';

import { RUTAS_DE_HOJA, RUTAS_DE_PANTALLA } from '../router/rutas';
import { AvisoDeRechazo } from './AvisoDeRechazo';
import { Navegacion } from './Navegacion';
import { DESTINOS, seccionDeLaRuta } from './destinos';

function HojaEnSuUbicacion({ ubicacion }: { ubicacion: Location }) {
  return useRoutes(RUTAS_DE_HOJA, ubicacion);
}

function CapaDeHoja() {
  const location = useLocation();
  return (
    <ConSalida valor={esRutaDeHoja(location.pathname) ? location : null}>
      {(ubicacion) => <HojaEnSuUbicacion ubicacion={ubicacion} />}
    </ConSalida>
  );
}

export function Marco() {
  const { email } = useSesionActiva();
  const estadoSync = useEstadoSync();
  const ancho = useAnchoDePantalla();
  const visible = useUbicacionVisible();
  const pantalla = useRoutes(RUTAS_DE_PANTALLA, visible);
  const principal = useRef<HTMLElement>(null);
  const montado = useRef(false);
  const [anuncio, setAnuncio] = useState('');

  const seccion = seccionDeLaRuta(visible.pathname);
  const etiqueta = DESTINOS[seccion].etiqueta;

  useEffect(() => {
    if (!montado.current) {
      montado.current = true;
      return;
    }
    const enfocado = document.activeElement;
    const yaEstaEnUnaHoja =
      enfocado instanceof HTMLElement && enfocado.closest('dialog[open], [role="dialog"]');
    if (!yaEstaEnUnaHoja) principal.current?.focus();
    setAnuncio(etiqueta);
  }, [visible.pathname, etiqueta]);

  return (
    <div className="flex min-h-0 flex-1">
      <a
        href="#contenido"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-40 focus:rounded-field focus:bg-ink focus:px-3 focus:py-2 focus:text-label focus:text-paper"
      >
        Saltar al contenido
      </a>

      <Navegacion email={email} sincronizacion={describirEstadoSync(estadoSync)} />

      <main
        id="contenido"
        ref={principal}
        tabIndex={-1}
        className={`min-h-0 flex-1 overflow-y-auto outline-none ${
          ancho === 'movil'
            ? 'pb-[calc(var(--bottom-nav-clearance)+env(safe-area-inset-bottom))]'
            : ''
        }`}
      >
        {pantalla}
      </main>

      <CapaDeHoja />

      <AvisoDeRechazo />

      <span aria-live="polite" className="sr-only">
        {anuncio}
      </span>
    </div>
  );
}
