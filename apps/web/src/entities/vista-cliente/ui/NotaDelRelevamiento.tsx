import type { NotaDelRelevamiento } from '@maun/domain';
import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react';

import { useAlgoEnCurso, useAnchoDePantalla } from '@/shared/lib';
import { Button, Icono } from '@/shared/ui';

function Contenido({ nota, idTitulo }: { nota: NotaDelRelevamiento; idTitulo: string }) {
  const hecho = nota.estado === 'hecho';

  return (
    <>
      <div className="flex items-center gap-3">
        <span
          aria-hidden
          className={`flex size-[30px] flex-none items-center justify-center rounded-pill bg-surface ${
            hecho ? 'text-ok' : 'text-ink'
          }`}
        >
          <Icono nombre={hecho ? 'check' : 'ruler'} tamano={16} />
        </span>
        <p id={idTitulo} className="text-body leading-snug font-semibold">
          {nota.titulo}
        </p>
      </div>
      <div className="mt-3 flex flex-col gap-1.5">
        {nota.lineas.map((linea) => (
          <p key={linea} className="text-body-sm leading-relaxed text-text-2">
            {linea}
          </p>
        ))}
      </div>
    </>
  );
}

function HojaDeLaNota({
  nota,
  id,
  idTitulo,
  alCerrar,
}: {
  nota: NotaDelRelevamiento;
  id: string;
  idTitulo: string;
  alCerrar: () => void;
}) {
  const dialogo = useRef<HTMLDialogElement>(null);
  const tocoElFondo = useRef(false);
  useAlgoEnCurso(true);

  useLayoutEffect(() => {
    const elemento = dialogo.current;
    if (elemento && !elemento.open) elemento.showModal();
  }, []);

  return (
    <dialog
      ref={dialogo}
      id={id}
      aria-labelledby={idTitulo}
      onClose={alCerrar}
      onPointerDown={(evento) => {
        tocoElFondo.current = evento.target === evento.currentTarget;
      }}
      onClick={(evento) => {
        const fueElFondo = tocoElFondo.current && evento.target === evento.currentTarget;
        tocoElFondo.current = false;
        if (fueElFondo) dialogo.current?.close();
      }}
      className="fixed inset-x-0 top-auto bottom-0 m-0 max-h-[calc(100dvh-40px)] w-full max-w-none translate-y-0 overflow-y-auto rounded-t-sheet bg-paper p-0 text-ink transition-[translate] duration-(--dur-medium) ease-out backdrop:bg-[rgba(10,10,10,0.42)] starting:open:translate-y-full"
    >
      <div className="p-5 pb-[calc(20px+env(safe-area-inset-bottom))]">
        <span aria-hidden className="mx-auto -mt-2 mb-4 block h-1 w-9 rounded-pill bg-border" />
        <Contenido nota={nota} idTitulo={idTitulo} />
        <Button
          className="mt-5 w-full"
          onClick={() => {
            dialogo.current?.close();
          }}
        >
          Entendido
        </Button>
      </div>
    </dialog>
  );
}

function PasoConLaNota({
  nota,
  actual,
  className,
  children,
}: {
  nota: NotaDelRelevamiento;
  actual: boolean;
  className: string;
  children: (boton: ReactNode) => ReactNode;
}) {
  const enCelular = useAnchoDePantalla() === 'movil';
  const [abierta, setAbierta] = useState(false);
  const porEncima = useRef(false);
  const paso = useRef<HTMLLIElement>(null);
  const boton = useRef<HTMLButtonElement>(null);
  const id = useId();
  const idTitulo = `${id}-titulo`;
  const flotante = abierta && !enCelular;

  function cerrar(): void {
    porEncima.current = false;
    setAbierta(false);
  }

  useEffect(() => {
    if (!flotante) return;
    function alTeclear(evento: KeyboardEvent): void {
      if (evento.key !== 'Escape') return;
      const conElFoco = paso.current?.contains(document.activeElement) ?? false;
      porEncima.current = false;
      setAbierta(false);
      if (conElFoco) boton.current?.focus();
    }
    function alTocarAfuera(evento: PointerEvent): void {
      if (evento.target instanceof Node && paso.current?.contains(evento.target)) return;
      porEncima.current = false;
      setAbierta(false);
    }
    document.addEventListener('keydown', alTeclear);
    document.addEventListener('pointerdown', alTocarAfuera);
    return () => {
      document.removeEventListener('keydown', alTeclear);
      document.removeEventListener('pointerdown', alTocarAfuera);
    };
  }, [flotante]);

  const elBoton = (
    <button
      ref={boton}
      type="button"
      aria-label={nota.etiqueta}
      aria-expanded={abierta}
      aria-controls={abierta ? id : undefined}
      onMouseEnter={() => {
        if (enCelular || abierta) return;
        porEncima.current = true;
        setAbierta(true);
      }}
      onClick={() => {
        if (abierta && porEncima.current) {
          porEncima.current = false;
          return;
        }
        porEncima.current = false;
        setAbierta(!abierta);
      }}
      className="relative inline-flex size-[23px] flex-none items-center justify-center rounded-pill border-[1.5px] border-border bg-paper text-text-2 after:absolute after:-inset-2.5 after:rounded-pill hover:border-ink hover:text-ink aria-expanded:border-ink aria-expanded:bg-surface aria-expanded:text-ink"
    >
      <Icono nombre="info" tamano={14} />
    </button>
  );

  return (
    <li
      ref={paso}
      aria-current={actual ? 'step' : undefined}
      className={className}
      onMouseLeave={() => {
        if (!enCelular) cerrar();
      }}
    >
      {children(elBoton)}
      {flotante && (
        <div
          id={id}
          className="absolute top-full left-0 z-20 mt-2 w-[320px] max-w-[78vw] rounded-dialog border border-hairline bg-paper p-4 shadow-[0_14px_36px_rgba(0,0,0,0.18)] before:absolute before:inset-x-0 before:bottom-full before:h-2.5"
        >
          <Contenido nota={nota} idTitulo={idTitulo} />
        </div>
      )}
      {abierta && enCelular && (
        <HojaDeLaNota nota={nota} id={id} idTitulo={idTitulo} alCerrar={cerrar} />
      )}
    </li>
  );
}

export interface PasoDelCaminoProps {
  nota: NotaDelRelevamiento | null;
  actual: boolean;
  className: string;
  children: (boton: ReactNode) => ReactNode;
}

export function PasoDelCamino({ nota, actual, className, children }: PasoDelCaminoProps) {
  if (nota === null) {
    return (
      <li aria-current={actual ? 'step' : undefined} className={className}>
        {children(null)}
      </li>
    );
  }
  return (
    <PasoConLaNota nota={nota} actual={actual} className={className}>
      {children}
    </PasoConLaNota>
  );
}
