import { useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { useLocation, useNavigate } from 'react-router';

import { useAnchoDePantalla } from '@/shared/lib';
import { Icono } from '@/shared/ui';

import { conTransicion } from '../router/transicion';
import {
  ACCIONES_RAPIDAS,
  DESTINOS,
  destinoResaltado,
  NAV_ESCRITORIO,
  NAV_MOVIL,
  NAV_TABLET,
  seccionDeLaRuta,
  type IdDeSeccion,
} from './destinos';

function useIrA(): (ruta: string) => void {
  const navegar = useNavigate();
  const location = useLocation();
  return (ruta) => {
    if (ruta === location.pathname) return;
    conTransicion(() => {
      flushSync(() => {
        void navegar(ruta);
      });
    });
  };
}

function useEditando(): boolean {
  const [editando, setEditando] = useState(false);

  useEffect(() => {
    const esCampo = (destino: EventTarget | null) =>
      destino instanceof HTMLElement &&
      (destino.tagName === 'INPUT' || destino.tagName === 'TEXTAREA' || destino.isContentEditable);
    const entrar = (evento: FocusEvent) => {
      if (esCampo(evento.target)) setEditando(true);
    };
    const salir = (evento: FocusEvent) => {
      if (esCampo(evento.target)) setEditando(false);
    };

    document.addEventListener('focusin', entrar);
    document.addEventListener('focusout', salir);
    return () => {
      document.removeEventListener('focusin', entrar);
      document.removeEventListener('focusout', salir);
    };
  }, []);

  return editando;
}

function useMenuDeAcciones() {
  const [abierto, setAbierto] = useState(false);
  const contenedor = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!abierto) return;
    const alPresionar = (evento: KeyboardEvent) => {
      if (evento.key === 'Escape') setAbierto(false);
    };
    globalThis.addEventListener('keydown', alPresionar);
    return () => {
      globalThis.removeEventListener('keydown', alPresionar);
    };
  }, [abierto]);

  return { abierto, setAbierto, contenedor };
}

function MenuDeAcciones({
  abierto,
  cerrar,
  irA,
  className,
}: {
  abierto: boolean;
  cerrar: () => void;
  irA: (ruta: string) => void;
  className: string;
}) {
  if (!abierto) return null;

  return (
    <>
      <button
        type="button"
        aria-label="Cerrar el menú"
        className="fixed inset-0 z-20 bg-ink/20"
        onClick={cerrar}
      />
      <div
        role="menu"
        aria-label="Cargar algo nuevo"
        className={`z-30 flex min-w-[250px] flex-col gap-0.5 rounded-panel bg-ink p-1.5 text-paper shadow-menu ${className}`}
      >
        {ACCIONES_RAPIDAS.map((accion) => (
          <button
            key={accion.etiqueta}
            type="button"
            role="menuitem"
            className="flex min-h-tap items-center gap-3 rounded-field px-3 text-left text-body-lg hover:bg-paper/10"
            onClick={() => {
              cerrar();
              irA(accion.ruta);
            }}
          >
            <Icono nombre={accion.icono} tamano={18} />
            {accion.etiqueta}
          </button>
        ))}
      </div>
    </>
  );
}

function BarraInferior({
  activo,
  irA,
}: {
  activo: IdDeSeccion | undefined;
  irA: (r: string) => void;
}) {
  const { abierto, setAbierto, contenedor } = useMenuDeAcciones();
  const editando = useEditando();
  const columnas = ['col-start-1', 'col-start-2', 'col-start-4', 'col-start-5'];

  if (editando) return null;

  return (
    <div ref={contenedor}>
      <MenuDeAcciones
        abierto={abierto}
        cerrar={() => {
          setAbierto(false);
        }}
        irA={irA}
        className="fixed bottom-[calc(96px+env(safe-area-inset-bottom))] left-1/2 -translate-x-1/2"
      />
      <nav
        aria-label="Principal"
        className="fixed inset-x-4 bottom-[calc(14px+env(safe-area-inset-bottom))] z-30 grid h-bottom-nav grid-cols-[1fr_1fr_76px_1fr_1fr] items-center rounded-pill border border-ink/8 bg-paper/80 shadow-float backdrop-blur-nav"
      >
        {NAV_MOVIL.map((id, indice) => {
          const destino = DESTINOS[id];
          const esActivo = activo === id;
          return (
            <button
              key={id}
              type="button"
              aria-current={esActivo ? 'page' : undefined}
              className={`${columnas[indice] ?? ''} flex h-bottom-nav min-w-tap flex-col items-center justify-center gap-[3px] text-badge ${
                esActivo ? 'font-semibold text-ink' : 'font-medium text-text-3'
              }`}
              onClick={() => {
                irA(destino.ruta);
              }}
            >
              <Icono nombre={destino.icono} tamano={22} grosor={esActivo ? 2.25 : 1.75} />
              {destino.etiqueta}
            </button>
          );
        })}
        <button
          type="button"
          aria-label="Cargar algo nuevo"
          aria-expanded={abierto}
          className="absolute -top-4 left-1/2 flex size-fab -translate-x-1/2 items-center justify-center rounded-pill bg-ink text-paper shadow-fab transition-transform duration-(--dur-fast) ease-out"
          style={{ rotate: abierto ? '45deg' : '0deg' }}
          onClick={() => {
            setAbierto(!abierto);
          }}
        >
          <Icono nombre="plus" tamano={26} grosor={2} />
        </button>
      </nav>
    </div>
  );
}

function Riel({ activo, irA }: { activo: IdDeSeccion | undefined; irA: (r: string) => void }) {
  const { abierto, setAbierto } = useMenuDeAcciones();

  return (
    <nav
      aria-label="Principal"
      className="relative flex w-[76px] flex-none flex-col items-center gap-1.5 border-r border-hairline bg-surface-3 py-4.5"
    >
      <span className="mb-3.5 font-display text-h1">M</span>
      <button
        type="button"
        aria-label="Cargar algo nuevo"
        aria-expanded={abierto}
        className="mb-4.5 flex size-tap items-center justify-center rounded-pill bg-ink text-paper"
        onClick={() => {
          setAbierto(!abierto);
        }}
      >
        <Icono nombre="plus" tamano={22} grosor={2} />
      </button>
      <MenuDeAcciones
        abierto={abierto}
        cerrar={() => {
          setAbierto(false);
        }}
        irA={irA}
        className="absolute top-[84px] left-[68px]"
      />
      {NAV_TABLET.map((id) => {
        const destino = DESTINOS[id];
        const esActivo = activo === id;
        return (
          <button
            key={id}
            type="button"
            title={destino.etiqueta}
            aria-label={destino.etiqueta}
            aria-current={esActivo ? 'page' : undefined}
            className={`flex h-12 w-13 items-center justify-center rounded-panel ${
              esActivo ? 'bg-surface-2 text-ink' : 'text-text-3'
            }`}
            onClick={() => {
              irA(destino.ruta);
            }}
          >
            <Icono nombre={destino.icono} tamano={22} grosor={esActivo ? 2.25 : 1.75} />
          </button>
        );
      })}
      <div className="flex-1" />
      <button
        type="button"
        title="Ajustes"
        aria-label="Ajustes"
        aria-current={activo === 'ajustes' ? 'page' : undefined}
        className="flex h-12 w-13 items-center justify-center rounded-panel text-text-3"
        onClick={() => {
          irA(DESTINOS.ajustes.ruta);
        }}
      >
        <Icono nombre="settings" tamano={22} />
      </button>
    </nav>
  );
}

function Sidebar({
  activo,
  irA,
  email,
  sincronizacion,
}: {
  activo: IdDeSeccion | undefined;
  irA: (r: string) => void;
  email: string;
  sincronizacion: string;
}) {
  const { abierto, setAbierto } = useMenuDeAcciones();

  return (
    <nav
      aria-label="Principal"
      className="relative flex w-[232px] flex-none flex-col gap-0.5 border-r border-hairline bg-surface-3 px-3.5 pt-5.5 pb-4.5"
    >
      <div className="flex items-baseline justify-between px-2.5 pb-4.5">
        <span className="font-display text-h1-lg">MAUN</span>
        <span className="text-meta text-text-3">Taller</span>
      </div>
      <button
        type="button"
        aria-expanded={abierto}
        className="mb-4 flex h-10 items-center justify-center gap-2 rounded-field bg-ink text-label font-medium text-paper"
        onClick={() => {
          setAbierto(!abierto);
        }}
      >
        <Icono nombre="plus" tamano={18} grosor={2} />
        Cargar algo nuevo
      </button>
      <MenuDeAcciones
        abierto={abierto}
        cerrar={() => {
          setAbierto(false);
        }}
        irA={irA}
        className="absolute top-[72px] left-3.5"
      />
      {NAV_ESCRITORIO.map((id) => {
        const destino = DESTINOS[id];
        const esActivo = activo === id;
        return (
          <button
            key={id}
            type="button"
            aria-current={esActivo ? 'page' : undefined}
            className={`flex h-10 items-center gap-3 rounded-field px-2.5 text-left text-label ${
              esActivo ? 'bg-surface-2 font-semibold text-ink' : 'font-medium text-text-3'
            }`}
            onClick={() => {
              irA(destino.ruta);
            }}
          >
            <Icono nombre={destino.icono} tamano={20} grosor={esActivo ? 2.25 : 1.75} />
            {destino.etiqueta}
          </button>
        );
      })}
      <div className="flex-1" />
      <div className="flex flex-col gap-0.5 border-t border-hairline px-2.5 pt-3 text-meta text-text-3">
        <span className="text-label font-medium text-ink">{email}</span>
        <span>{sincronizacion}</span>
      </div>
    </nav>
  );
}

export function Navegacion({ email, sincronizacion }: { email: string; sincronizacion: string }) {
  const ancho = useAnchoDePantalla();
  const location = useLocation();
  const irA = useIrA();
  const seccion = seccionDeLaRuta(location.pathname);

  if (ancho === 'movil') {
    return <BarraInferior activo={destinoResaltado(seccion, NAV_MOVIL)} irA={irA} />;
  }
  if (ancho === 'tablet') {
    return <Riel activo={destinoResaltado(seccion, NAV_TABLET)} irA={irA} />;
  }
  return (
    <Sidebar
      activo={destinoResaltado(seccion, NAV_ESCRITORIO)}
      irA={irA}
      email={email}
      sincronizacion={sincronizacion}
    />
  );
}
