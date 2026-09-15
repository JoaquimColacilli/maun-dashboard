import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import { Button, FilaDeAcciones, Icono } from '@maun/ui';

import { useAlgoEnCurso, useAltoVisible, useAnchoDePantalla } from '@/shared/lib';

interface Salida {
  saliendo: boolean;
  alTerminar: () => void;
}

const ContextoDeSalida = createContext<Salida | null>(null);

const RESPALDO_DE_LA_SALIDA_MS = 400;

type Ausente = null | undefined | false;

function estaPresente<T>(valor: T | Ausente): valor is T {
  return valor !== null && valor !== undefined && valor !== false;
}

export interface ConSalidaProps<T> {
  valor: T | Ausente;
  children: (valor: T) => ReactNode;
}

export function ConSalida<T>({ valor, children }: ConSalidaProps<T>) {
  const [ultimo, setUltimo] = useState<{ valor: T } | null>(() =>
    estaPresente(valor) ? { valor } : null,
  );
  const [previo, setPrevio] = useState(valor);
  if (previo !== valor) {
    setPrevio(valor);
    if (estaPresente(valor)) setUltimo({ valor });
  }

  const presente = estaPresente(valor);
  const alTerminar = useCallback(() => {
    setUltimo(null);
  }, []);
  const salida = useMemo(() => ({ saliendo: !presente, alTerminar }), [presente, alTerminar]);

  if (ultimo === null) return null;
  return <ContextoDeSalida value={salida}>{children(ultimo.valor)}</ContextoDeSalida>;
}

const ANCHO = {
  angosto: 'w-[min(440px,calc(100%-40px))]',
  normal: 'w-[min(560px,calc(100%-40px))]',
  amplio: 'w-[min(600px,calc(100%-40px))]',
  visor: 'w-[min(1100px,calc(100%-40px))]',
} as const;

const TRANSICION =
  'transition-[translate,scale,opacity,display,overlay] transition-discrete duration-(--dur-medium) ease-out backdrop:bg-transparent backdrop:transition-[background-color,display,overlay] backdrop:transition-discrete backdrop:duration-(--dur-medium) open:backdrop:bg-velo starting:open:backdrop:bg-transparent';

const DESDE_ABAJO =
  'inset-x-0 top-auto bottom-0 max-h-[calc(100dvh-40px)] w-full rounded-t-sheet translate-y-full open:translate-y-0 starting:open:translate-y-full';

const CENTRADA =
  'inset-0 m-auto h-fit max-h-[88dvh] rounded-dialog scale-96 opacity-0 open:scale-100 open:opacity-100 starting:open:scale-96 starting:open:opacity-0';

export interface HojaProps {
  titulo: string;
  alCerrar: () => void;
  children: ReactNode | ((pedirCierre: () => void) => ReactNode);
  rol?: 'dialog' | 'alertdialog';
  ancho?: keyof typeof ANCHO;
  desdeAbajo?: boolean;
  conCambios?: boolean;
}

export function Hoja({
  titulo,
  alCerrar,
  children,
  rol = 'dialog',
  ancho = 'normal',
  desdeAbajo = false,
  conCambios = false,
}: HojaProps) {
  const pantalla = useAnchoDePantalla();
  const altoVisible = useAltoVisible();
  const idTitulo = useId();
  const idPregunta = useId();
  const dialogo = useRef<HTMLDialogElement>(null);
  const cerrandoDesdeAca = useRef(false);
  const tocoElFondo = useRef(false);
  const [preguntando, setPreguntando] = useState(false);
  const [focoAntesDePreguntar, setFocoAntesDePreguntar] = useState<HTMLElement | null>(null);

  const salida = useContext(ContextoDeSalida);
  const saliendo = salida?.saliendo ?? false;
  const alTerminar = salida?.alTerminar;
  const enCelular = pantalla === 'movil';
  const abajo = desdeAbajo || enCelular;
  const mostrarPregunta = preguntando && conCambios && !saliendo;
  useAlgoEnCurso(!saliendo);

  useLayoutEffect(() => {
    const elemento = dialogo.current;
    if (!elemento) return;
    if (!saliendo && !elemento.open) {
      cerrandoDesdeAca.current = false;
      elemento.showModal();
    }
    if (saliendo && elemento.open) {
      cerrandoDesdeAca.current = true;
      elemento.close();
    }
  }, [saliendo]);

  useEffect(() => {
    const elemento = dialogo.current;
    if (!saliendo || !elemento || !alTerminar) return;
    let terminado = false;
    const terminar = () => {
      if (terminado) return;
      terminado = true;
      alTerminar();
    };
    const alTerminarLaTransicion = (evento: Event) => {
      if (evento.target === elemento) terminar();
    };
    elemento.addEventListener('transitionend', alTerminarLaTransicion);
    const respaldo = setTimeout(terminar, RESPALDO_DE_LA_SALIDA_MS);
    return () => {
      elemento.removeEventListener('transitionend', alTerminarLaTransicion);
      clearTimeout(respaldo);
    };
  }, [saliendo, alTerminar]);

  useEffect(() => {
    if (!mostrarPregunta) return;
    dialogo.current?.querySelector<HTMLButtonElement>('[data-seguir-editando]')?.focus();
  }, [mostrarPregunta]);

  function pedirCierre(): void {
    if (!conCambios) {
      alCerrar();
      return;
    }
    if (!mostrarPregunta) {
      const activo = document.activeElement;
      setFocoAntesDePreguntar(activo instanceof HTMLElement ? activo : null);
    }
    setPreguntando(true);
  }

  function seguirEditando(): void {
    setPreguntando(false);
    focoAntesDePreguntar?.focus();
  }

  function descartar(): void {
    setPreguntando(false);
    alCerrar();
  }

  return (
    <dialog
      ref={dialogo}
      role={rol === 'alertdialog' ? 'alertdialog' : undefined}
      aria-labelledby={idTitulo}
      onCancel={(evento) => {
        evento.preventDefault();
        if (mostrarPregunta) seguirEditando();
        else pedirCierre();
      }}
      onClose={() => {
        if (cerrandoDesdeAca.current) return;
        if (!conCambios) {
          alCerrar();
          return;
        }
        dialogo.current?.showModal();
        if (mostrarPregunta) seguirEditando();
        else pedirCierre();
      }}
      onPointerDown={(evento) => {
        tocoElFondo.current = evento.target === evento.currentTarget;
      }}
      onClick={(evento) => {
        const fueElFondo = tocoElFondo.current && evento.target === evento.currentTarget;
        tocoElFondo.current = false;
        if (fueElFondo && !mostrarPregunta) pedirCierre();
      }}
      style={
        enCelular && !desdeAbajo && altoVisible !== undefined
          ? { height: altoVisible - 40 }
          : undefined
      }
      className={`fixed m-0 max-w-none flex-col bg-paper p-0 text-ink shadow-float open:flex ${TRANSICION} ${
        abajo ? DESDE_ABAJO : `${CENTRADA} ${ANCHO[ancho]}`
      }`}
    >
      <header className="flex flex-none items-center justify-between gap-3 border-b border-hairline py-2.5 pr-2.5 pl-5 md:py-3.5 md:pr-3.5 md:pl-6">
        <h2 id={idTitulo} className="text-body-lg leading-snug font-semibold">
          {titulo}
        </h2>
        <button
          type="button"
          onClick={pedirCierre}
          aria-label="Cerrar"
          className="flex size-11 flex-none items-center justify-center rounded-field text-text-2 hover:bg-surface"
        >
          <Icono nombre="x" tamano={20} />
        </button>
      </header>
      {typeof children === 'function' ? children(pedirCierre) : children}
      {mostrarPregunta && (
        <div
          role="alertdialog"
          aria-labelledby={idPregunta}
          aria-describedby={`${idPregunta}-detalle`}
          className="absolute inset-x-0 bottom-0 z-10 flex flex-col gap-3 border-t border-hairline bg-paper px-5 pt-4 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-float md:px-6 md:pb-5"
        >
          <div>
            <p id={idPregunta} className="text-body-lg leading-snug font-semibold">
              ¿Cerrar sin guardar?
            </p>
            <p
              id={`${idPregunta}-detalle`}
              className="mt-0.5 text-label leading-relaxed text-text-2"
            >
              Lo que cargaste todavía no se guardó, y si cerrás se pierde.
            </p>
          </div>
          <FilaDeAcciones>
            <Button variant="secundario" data-seguir-editando onClick={seguirEditando}>
              Seguir editando
            </Button>
            <Button variant="peligro" onClick={descartar}>
              Descartar
            </Button>
          </FilaDeAcciones>
        </div>
      )}
    </dialog>
  );
}
