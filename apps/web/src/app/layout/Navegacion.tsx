import { useEffect, useState, type ReactNode } from 'react';
import { useLocation } from 'react-router';

import { VersionDeLaApp } from '@/features/ver-novedades';
import {
  conFondo,
  esRutaDeHoja,
  Ir,
  useAnchoDePantalla,
  useIr,
  useUbicacionVisible,
} from '@/shared/lib';
import { Avatar, Icono, Isotipo, Logotipo } from '@/shared/ui';

import { historialDelNavegador } from '../navegacion/historial';
import { destinoDeLaBarra } from '../navegacion/pila';
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
  const ir = useIr();
  const location = useLocation();
  const visible = useUbicacionVisible();
  return (ruta) => {
    if (ruta === location.pathname) return;
    ir(ruta, {
      state: esRutaDeHoja(ruta) ? conFondo(visible) : undefined,
      desdeLaNavegacion: true,
    });
  };
}

function useIrALaSeccion(irA: (ruta: string) => void): (ruta: string) => void {
  const location = useLocation();
  return (ruta) => {
    const historial = historialDelNavegador();
    const destino = destinoDeLaBarra(ruta, {
      actual: `${location.pathname}${location.search}`,
      anteriores: historial.anteriores(),
      movil: true,
      conHistorial: historial.disponible(),
    });
    if (destino !== null) irA(destino);
  };
}

function LogoAInicio({
  irA,
  className,
  children,
}: {
  irA: (ruta: string) => void;
  className: string;
  children: ReactNode;
}) {
  return (
    <Ir
      a={DESTINOS.inicio.ruta}
      aria-label="NUMA, ir a Inicio"
      className={className}
      alTocar={() => {
        irA(DESTINOS.inicio.ruta);
      }}
    >
      {children}
    </Ir>
  );
}

function useEditando(): boolean {
  const [editando, setEditando] = useState(false);

  useEffect(() => {
    let apretado = false;
    let volverAlSoltar = false;
    let reloj: ReturnType<typeof setTimeout> | undefined;

    const esCampo = (destino: EventTarget | null) =>
      destino instanceof HTMLElement &&
      (destino.tagName === 'INPUT' || destino.tagName === 'TEXTAREA' || destino.isContentEditable);
    const volverDespuesDelToque = () => {
      clearTimeout(reloj);
      reloj = setTimeout(() => {
        setEditando(false);
      }, 0);
    };
    const apretar = () => {
      apretado = true;
    };
    const soltar = () => {
      apretado = false;
      if (!volverAlSoltar) return;
      volverAlSoltar = false;
      volverDespuesDelToque();
    };
    const entrar = (evento: FocusEvent) => {
      if (!esCampo(evento.target)) return;
      volverAlSoltar = false;
      clearTimeout(reloj);
      setEditando(true);
    };
    const salir = (evento: FocusEvent) => {
      if (!esCampo(evento.target)) return;
      if (apretado) volverAlSoltar = true;
      else volverDespuesDelToque();
    };

    document.addEventListener('pointerdown', apretar, true);
    document.addEventListener('pointerup', soltar, true);
    document.addEventListener('pointercancel', soltar, true);
    document.addEventListener('focusin', entrar);
    document.addEventListener('focusout', salir);
    return () => {
      clearTimeout(reloj);
      document.removeEventListener('pointerdown', apretar, true);
      document.removeEventListener('pointerup', soltar, true);
      document.removeEventListener('pointercancel', soltar, true);
      document.removeEventListener('focusin', entrar);
      document.removeEventListener('focusout', salir);
    };
  }, []);

  return editando;
}

function useMenuDeAcciones() {
  const [abierto, setAbierto] = useState(false);

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

  return { abierto, setAbierto };
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
        className="pointer-events-auto fixed inset-0 z-20 bg-velo-suave"
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
  const { abierto, setAbierto } = useMenuDeAcciones();
  const editando = useEditando();
  const irALaSeccion = useIrALaSeccion(irA);
  const columnas = ['col-start-1', 'col-start-2', 'col-start-4', 'col-start-5'];

  if (editando) return null;

  return (
    <>
      <MenuDeAcciones
        abierto={abierto}
        cerrar={() => {
          setAbierto(false);
        }}
        irA={irA}
        className="pointer-events-auto fixed bottom-(--holgura-inferior) left-1/2 -translate-x-1/2"
      />
      <nav aria-label="Principal" className="grid w-full grid-cols-1">
        <div
          aria-hidden
          className="pointer-events-auto col-start-1 row-start-1 mt-3.75 h-bottom-nav rounded-pill border border-ink/8 bg-paper/80 shadow-float backdrop-blur-nav"
        />
        <div className="pointer-events-auto relative col-start-1 row-start-1 mt-3.75 grid h-bottom-nav grid-cols-[1fr_1fr_76px_1fr_1fr] items-center">
          {NAV_MOVIL.map((id, indice) => {
            const destino = DESTINOS[id];
            const esActivo = activo === id;
            return (
              <button
                key={id}
                type="button"
                aria-current={esActivo ? 'page' : undefined}
                className={`${columnas[indice] ?? ''} flex h-[50px] min-w-tap flex-col items-center justify-center gap-[3px] rounded-pill text-badge first:ml-1.5 last:mr-1.5 ${
                  esActivo ? 'bg-ink/7 font-semibold text-ink' : 'font-medium text-text-2'
                }`}
                onClick={() => {
                  irALaSeccion(destino.ruta);
                }}
              >
                <Icono nombre={destino.icono} tamano={22} grosor={esActivo ? 2.25 : 1.75} />
                {destino.etiqueta}
              </button>
            );
          })}
        </div>
        <button
          type="button"
          aria-label="Cargar algo nuevo"
          aria-expanded={abierto}
          className="pointer-events-auto relative col-start-1 row-start-1 flex size-fab items-center justify-center self-start justify-self-center rounded-pill bg-ink text-paper shadow-fab transition-transform duration-(--dur-fast) ease-out"
          style={{ rotate: abierto ? '45deg' : '0deg' }}
          onClick={() => {
            setAbierto(!abierto);
          }}
        >
          <Icono nombre="plus" tamano={26} grosor={2} />
        </button>
      </nav>
    </>
  );
}

function Riel({ activo, irA }: { activo: IdDeSeccion | undefined; irA: (r: string) => void }) {
  const { abierto, setAbierto } = useMenuDeAcciones();

  return (
    <nav
      aria-label="Principal"
      className="relative flex w-[76px] flex-none flex-col items-center gap-1.5 py-4.5"
    >
      <LogoAInicio
        irA={irA}
        className="mb-3.5 flex size-tap items-center justify-center rounded-pill hover:bg-ink/5"
      >
        <Isotipo decorativa className="h-[23px] w-auto" />
      </LogoAInicio>
      <button
        type="button"
        aria-label="Cargar algo nuevo"
        aria-expanded={abierto}
        className="mb-4.5 flex size-tap items-center justify-center rounded-pill bg-ink text-paper shadow-fab"
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
            className={`flex h-12 w-13 items-center justify-center rounded-pill border ${
              esActivo
                ? 'border-hairline bg-paper text-ink'
                : 'border-transparent text-text-2 hover:bg-ink/5'
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
        className={`flex h-12 w-13 items-center justify-center rounded-pill border ${
          activo === 'ajustes'
            ? 'border-hairline bg-paper text-ink'
            : 'border-transparent text-text-2 hover:bg-ink/5'
        }`}
        onClick={() => {
          irA(DESTINOS.ajustes.ruta);
        }}
      >
        <Icono nombre="settings" tamano={22} grosor={activo === 'ajustes' ? 2.25 : 1.75} />
      </button>
    </nav>
  );
}

function Sidebar({
  activo,
  irA,
  email,
  nombre,
  foto,
  sincronizacion,
}: {
  activo: IdDeSeccion | undefined;
  irA: (r: string) => void;
  email: string;
  nombre: string;
  foto: string;
  sincronizacion: string;
}) {
  const { abierto, setAbierto } = useMenuDeAcciones();

  return (
    <nav
      aria-label="Principal"
      className="relative flex w-[232px] flex-none flex-col gap-0.5 px-3.5 pt-5.5 pb-4.5"
    >
      <div className="flex items-baseline justify-between pb-4.5">
        <LogoAInicio
          irA={irA}
          className="flex min-h-tap items-center rounded-pill px-2.5 hover:bg-ink/5"
        >
          <Logotipo decorativa className="h-[27px] w-auto" />
        </LogoAInicio>
        <span className="text-meta text-text-3">Taller</span>
      </div>
      <button
        type="button"
        aria-expanded={abierto}
        className="mb-4 flex h-10 items-center justify-center gap-2 rounded-pill bg-ink text-label font-medium text-paper shadow-fab"
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
        className="absolute top-[71px] left-3.5"
      />
      {NAV_ESCRITORIO.map((id) => {
        const destino = DESTINOS[id];
        const esActivo = activo === id;
        return (
          <button
            key={id}
            type="button"
            aria-current={esActivo ? 'page' : undefined}
            className={`flex h-10 items-center gap-3 rounded-pill border px-2.5 text-left text-label ${
              esActivo
                ? 'border-hairline bg-paper font-semibold text-ink'
                : 'border-transparent font-medium text-text-2 hover:bg-ink/5'
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
      <div className="flex items-start gap-2.5 border-t border-hairline px-2.5 pt-3">
        <Avatar nombre={nombre === '' ? email : nombre} foto={foto} className="mt-0.5" />
        <div className="flex min-w-0 flex-col gap-0.5 text-meta text-text-3">
          {nombre !== '' && (
            <span className="truncate text-label font-medium text-ink">{nombre}</span>
          )}
          <span className={nombre === '' ? 'truncate text-label font-medium text-ink' : 'truncate'}>
            {email}
          </span>
          <span>{sincronizacion}</span>
        </div>
      </div>
      <VersionDeLaApp className="mt-1 flex min-h-9 items-center self-start rounded-field px-2.5 text-left text-meta text-balance text-text-3 underline-offset-3 hover:text-ink hover:underline" />
    </nav>
  );
}

export function Navegacion({
  email,
  nombre,
  foto,
  sincronizacion,
}: {
  email: string;
  nombre: string;
  foto: string;
  sincronizacion: string;
}) {
  const ancho = useAnchoDePantalla();
  const visible = useUbicacionVisible();
  const irA = useIrA();
  const seccion = seccionDeLaRuta(visible.pathname);

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
      nombre={nombre}
      foto={foto}
      sincronizacion={sincronizacion}
    />
  );
}
