import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type RefObject,
} from 'react';
import { useLocation, useRoutes, type Location } from 'react-router';

import { useNombreDeLaPersona, useSesionActiva } from '@/entities/sesion';
import { OfertaDeHuella } from '@/features/activar-huella';
import {
  describirEstadoSync,
  esRutaDeHoja,
  useAnchoDePantalla,
  useEstadoSync,
  useHayAlgoEnCurso,
  useScrollPorPantalla,
  useUbicacionVisible,
} from '@/shared/lib';
import { ConSalida } from '@/shared/ui';

import { RUTAS_DE_HOJA, RUTAS_DE_PANTALLA } from '../router/rutas';
import { Avisos } from './Avisos';
import { IndicadorSync } from './IndicadorSync';
import { Navegacion } from './Navegacion';
import { TirarParaActualizar } from './TirarParaActualizar';
import { DESTINOS, seccionDeLaRuta } from './destinos';
import { seActualizaTirando } from './pantallas-que-se-actualizan';

const RESPIRO = 12;

interface Holgura {
  anclados: number;
  contenido: number;
}

const SIN_HOLGURA: Holgura = { anclados: 0, contenido: 0 };

function seEstaEscribiendo(): boolean {
  const activo = document.activeElement;
  return (
    activo instanceof HTMLElement &&
    (activo.tagName === 'INPUT' || activo.tagName === 'TEXTAREA' || activo.isContentEditable)
  );
}

function useHolguraInferior(
  pie: HTMLDivElement | null,
  principal: RefObject<HTMLElement | null>,
): Holgura {
  const [holgura, setHolgura] = useState(SIN_HOLGURA);

  useLayoutEffect(() => {
    if (!pie) return;
    const contenedor = principal.current;

    const actualizar = () => {
      const caja = pie.getBoundingClientRect();
      const fondoDelContenido = contenedor?.getBoundingClientRect().bottom ?? caja.bottom;
      const anclados = Math.ceil(caja.height) + RESPIRO;
      const medido =
        pie.childElementCount === 0
          ? 0
          : Math.max(0, Math.ceil(fondoDelContenido - caja.top)) + RESPIRO;
      setHolgura((previa) => {
        const contenido = seEstaEscribiendo() ? Math.max(previa.contenido, medido) : medido;
        return previa.anclados === anclados && previa.contenido === contenido
          ? previa
          : { anclados, contenido };
      });
    };

    actualizar();
    const observador = 'ResizeObserver' in globalThis ? new ResizeObserver(actualizar) : null;
    observador?.observe(pie, { box: 'border-box' });
    if (contenedor) observador?.observe(contenedor, { box: 'border-box' });
    const alTerminarDeEscribir = () => {
      requestAnimationFrame(actualizar);
    };
    window.addEventListener('resize', actualizar);
    window.addEventListener('orientationchange', actualizar);
    globalThis.visualViewport?.addEventListener('resize', actualizar);
    document.addEventListener('focusout', alTerminarDeEscribir);
    return () => {
      observador?.disconnect();
      window.removeEventListener('resize', actualizar);
      window.removeEventListener('orientationchange', actualizar);
      globalThis.visualViewport?.removeEventListener('resize', actualizar);
      document.removeEventListener('focusout', alTerminarDeEscribir);
      setHolgura(SIN_HOLGURA);
    };
  }, [pie, principal]);

  return holgura;
}

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
  const { usuarioId, email, foto } = useSesionActiva();
  const nombre = useNombreDeLaPersona();
  const estadoSync = useEstadoSync();
  const ancho = useAnchoDePantalla();
  const location = useLocation();
  const visible = useUbicacionVisible();
  const hayAlgoEnCurso = useHayAlgoEnCurso();
  const pantalla = useRoutes(RUTAS_DE_PANTALLA, visible);
  const principal = useRef<HTMLElement>(null);
  const montado = useRef(false);
  const [anuncio, setAnuncio] = useState('');
  const [pie, setPie] = useState<HTMLDivElement | null>(null);
  const holgura = useHolguraInferior(pie, principal);
  useScrollPorPantalla(principal, visible);

  const seccion = seccionDeLaRuta(visible.pathname);
  const etiqueta = DESTINOS[seccion].etiqueta;
  const conElGesto =
    seActualizaTirando(visible.pathname) && !esRutaDeHoja(location.pathname) && !hayAlgoEnCurso;

  useEffect(() => {
    if (!montado.current) {
      montado.current = true;
      return;
    }
    const enfocado = document.activeElement;
    const yaEstaEnUnaHoja =
      enfocado instanceof HTMLElement && enfocado.closest('dialog[open], [role="dialog"]');
    if (!yaEstaEnUnaHoja) principal.current?.focus({ preventScroll: true });
    setAnuncio(etiqueta);
  }, [visible.pathname, etiqueta]);

  const navegacion = (
    <Navegacion
      email={email}
      nombre={nombre}
      foto={foto}
      sincronizacion={describirEstadoSync(estadoSync)}
    />
  );
  const conHolgura: CSSProperties & Record<'--holgura-inferior', string> = {
    '--holgura-inferior': `${String(holgura.anclados)}px`,
  };

  return (
    <div className="flex min-h-0 flex-1" style={conHolgura}>
      <a
        href="#contenido"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-40 focus:rounded-field focus:bg-ink focus:px-3 focus:py-2 focus:text-label focus:text-paper"
      >
        Saltar al contenido
      </a>

      {ancho !== 'movil' && navegacion}

      <div
        ref={setPie}
        data-lo-que-flota-abajo
        className="pointer-events-none fixed inset-x-0 bottom-0 z-30 flex flex-col items-center gap-2 px-4 pb-[calc(14px+env(safe-area-inset-bottom))]"
      >
        <IndicadorSync />
        {ancho === 'movil' && navegacion}
      </div>

      <main
        id="contenido"
        ref={principal}
        tabIndex={-1}
        style={{ paddingBottom: `${String(holgura.contenido)}px` }}
        className="min-h-0 flex-1 overflow-y-auto outline-none [scrollbar-gutter:stable]"
      >
        {ancho === 'movil' && (
          <TirarParaActualizar
            contenedor={principal}
            usuarioId={usuarioId}
            deshabilitado={!conElGesto}
          />
        )}
        {pantalla}
      </main>

      <CapaDeHoja />

      <Avisos />

      <OfertaDeHuella />

      <span aria-live="polite" className="sr-only">
        {anuncio}
      </span>
    </div>
  );
}
