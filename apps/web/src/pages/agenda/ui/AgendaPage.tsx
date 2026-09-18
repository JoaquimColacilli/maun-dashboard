import {
  CATEGORIAS_DE_AGENDA,
  eventosDeLaAgenda,
  type CategoriaDeAgenda,
  type EventoDeLaAgenda,
} from '@maun/domain';
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';

import {
  CATEGORIA,
  conLoHechoAlFinal,
  DetalleDelDia,
  DIAS_DE_LA_SEMANA,
  diaDeLaSemana,
  diaEnPalabras,
  diasConEventos,
  etiquetaDelDia,
  eventosDelDia,
  fechasDelMes,
  FilaDeEvento,
  GrillaDelMes,
  MarcaDeCategoria,
  mesEnPalabras,
  mesPrevio,
  mesSiguiente,
  numeroDelDia,
  rangoDeLaGrilla,
  resumenDelMes,
  semanasDelMes,
  TiraDelMes,
  useAccionesConFoco,
  type AccionesDeLaAgenda,
  type AvisoDelDia,
} from '@/entities/agenda';
import { useReplicaDelTaller } from '@/entities/replica';
import {
  HojaDeAnotacion,
  useAccionesDeLaAgenda,
  useMoverEnLaAgenda,
} from '@/features/llevar-la-agenda';
import { datosDeLaAgendaDeLaReplica } from '@/shared/api';
import { hoyLocal, useAnchoDePantalla, type NuevoAviso } from '@/shared/lib';
import { Button, ConSalida, Hoja, Icono, Pagina } from '@/shared/ui';

type Filtro = 'todo' | CategoriaDeAgenda | 'marcado';

const FILTROS: readonly { id: Filtro; etiqueta: string }[] = [
  { id: 'todo', etiqueta: 'Todo' },
  ...CATEGORIAS_DE_AGENDA.map((categoria) => ({
    id: categoria,
    etiqueta: CATEGORIA[categoria].etiqueta,
  })),
  { id: 'marcado', etiqueta: 'Marcado' },
];

const DURACION_DEL_AVISO_DEL_DIA_MS = 5000;

const MES_VACIO =
  'Las visitas y las entregas aparecen solas cuando cargás un contacto o un proyecto. Lo que comprás o hacés en el taller lo anotás vos.';

function pasaElFiltro(evento: EventoDeLaAgenda, filtro: Filtro): boolean {
  if (filtro === 'todo') return true;
  if (filtro === 'marcado') return evento.importante;
  return evento.categoria === filtro;
}

function BotonesDelMes({
  alAnterior,
  alSiguiente,
}: {
  alAnterior: () => void;
  alSiguiente: () => void;
}) {
  return (
    <>
      <button
        type="button"
        aria-label="Mes anterior"
        onClick={alAnterior}
        className="flex size-10 items-center justify-center rounded-field hover:bg-surface"
      >
        <Icono nombre="chevron-left" tamano={20} />
      </button>
      <button
        type="button"
        aria-label="Mes siguiente"
        onClick={alSiguiente}
        className="flex size-10 items-center justify-center rounded-field hover:bg-surface"
      >
        <Icono nombre="chevron-right" tamano={20} />
      </button>
    </>
  );
}

interface ListaDelMesProps {
  mes: string;
  hoy: string;
  dia: string;
  desdeElPrincipio: boolean;
  eventos: readonly EventoDeLaAgenda[];
  acciones: AccionesDeLaAgenda;
  alVerAnteriores: () => void;
  alAbrirElDia: (fecha: string) => void;
  alAnotar: (fecha: string) => void;
}

function ListaDelMes({
  mes,
  hoy,
  dia,
  desdeElPrincipio,
  eventos,
  acciones,
  alVerAnteriores,
  alAbrirElDia,
  alAnotar,
}: ListaDelMesProps) {
  const primero = `${mes}-01`;
  const desde = desdeElPrincipio ? primero : dia;
  const dias = diasConEventos(
    eventos,
    fechasDelMes(mes).filter((fecha) => fecha >= desde),
    dia,
  );
  const { raiz, acciones: accionesConFoco } = useAccionesConFoco<HTMLDivElement>(acciones);

  if (eventos.length === 0) {
    return (
      <section aria-label="El mes está vacío" className="flex flex-col items-start gap-3 py-8">
        <span aria-hidden className="flex items-center gap-1">
          {CATEGORIAS_DE_AGENDA.slice(0, 4).map((categoria) => (
            <MarcaDeCategoria key={categoria} categoria={categoria} />
          ))}
        </span>
        <p className="mt-1 text-body-lg leading-snug font-semibold">
          Todavía no hay nada en el mes
        </p>
        <p className="text-body leading-relaxed text-text-2">{MES_VACIO}</p>
        <Button
          size="grande"
          onClick={() => {
            alAnotar(dia);
          }}
        >
          Anotar lo primero
        </Button>
      </section>
    );
  }

  return (
    <div ref={raiz} className="contents">
      {!desdeElPrincipio && desde > primero && (
        <button
          type="button"
          onClick={alVerAnteriores}
          className="mt-2 flex h-10 w-full items-center justify-center gap-1.5 border-b border-hairline-soft text-label font-medium text-text-2"
        >
          <Icono nombre="chevron-up" tamano={14} />
          Días anteriores
        </button>
      )}

      {dias.map(({ fecha, eventos: delDia }) => {
        const etiqueta = etiquetaDelDia(fecha, hoy);
        const pasado = fecha < hoy;
        return (
          <section key={fecha} aria-label={diaEnPalabras(fecha)} className="pt-4">
            <div
              className={`flex items-center gap-2 border-b pb-2 ${
                etiqueta === 'hoy' ? 'border-ink' : 'border-hairline'
              }`}
            >
              <span
                aria-hidden
                className={`font-display text-lema leading-none ${pasado ? 'text-text-3' : ''}`}
              >
                {numeroDelDia(fecha)}
              </span>
              <span
                aria-hidden
                className={`text-label font-semibold ${pasado ? 'text-text-3' : ''}`}
              >
                {DIAS_DE_LA_SEMANA[diaDeLaSemana(fecha)]}
              </span>
              {etiqueta !== null && (
                <span
                  className={`rounded-control px-1.5 py-0.5 text-badge font-semibold ${
                    etiqueta === 'hoy' ? 'bg-ink text-paper' : 'bg-surface text-text-2'
                  }`}
                >
                  {etiqueta}
                </span>
              )}
              <span className="flex-1" />
              {delDia.length > 0 && (
                <button
                  type="button"
                  aria-label={`Anotar algo para el ${diaEnPalabras(fecha)}`}
                  onClick={() => {
                    alAnotar(fecha);
                  }}
                  className="-my-1 flex h-9 items-center gap-1.5 rounded-field border border-dashed border-border px-3 text-label font-medium"
                >
                  <Icono nombre="plus" tamano={14} />
                  Anotar
                </button>
              )}
              <button
                type="button"
                aria-label={`Ver el ${diaEnPalabras(fecha)}`}
                onClick={() => {
                  alAbrirElDia(fecha);
                }}
                className="-my-1 -mr-1.5 flex size-9 items-center justify-center rounded-field text-text-3 hover:bg-surface hover:text-ink"
              >
                <Icono nombre="maximize-2" tamano={14} />
              </button>
            </div>
            {delDia.length === 0 ? (
              <div className="flex items-center justify-between gap-2.5 pt-3.5 pb-3">
                <span className="text-body text-text-3">Nada anotado para este día</span>
                <button
                  type="button"
                  aria-label={`Anotar algo para el ${diaEnPalabras(fecha)}`}
                  onClick={() => {
                    alAnotar(fecha);
                  }}
                  className="flex h-9 items-center gap-1.5 rounded-field border border-dashed border-border px-3 text-label font-medium"
                >
                  <Icono nombre="plus" tamano={14} />
                  Anotar
                </button>
              </div>
            ) : (
              <ul>
                {conLoHechoAlFinal(delDia).map((evento) => (
                  <FilaDeEvento
                    key={evento.id}
                    evento={evento}
                    hoy={hoy}
                    acciones={accionesConFoco}
                    alAbrirElDia={alAbrirElDia}
                  />
                ))}
              </ul>
            )}
          </section>
        );
      })}

      <p className="py-5.5 text-center text-label text-text-3">
        Hasta acá {mesEnPalabras(mes, hoy)}. Con las flechas de arriba pasás al mes que viene.
      </p>
    </div>
  );
}

export function AgendaPage() {
  const replica = useReplicaDelTaller();
  const ancho = useAnchoDePantalla();
  const acciones = useAccionesDeLaAgenda();
  const hoy = hoyLocal();
  const mesDeHoy = hoy.slice(0, 7);

  const [mes, setMes] = useState(mesDeHoy);
  const [elegido, setElegido] = useState<string | null>(hoy);
  const [desdeElPrincipio, setDesdeElPrincipio] = useState(false);
  const [filtro, setFiltro] = useState<Filtro>('todo');
  const [diaAbierto, setDiaAbierto] = useState<string | null>(null);
  const [anotando, setAnotando] = useState<string | null>(null);
  const [anotandoDesdeElDia, setAnotandoDesdeElDia] = useState(false);
  const [avisoDelDia, setAvisoDelDia] = useState<AvisoDelDia | null>(null);
  const areaDeLaGrilla = useRef<HTMLDivElement>(null);
  const capaDelDia = useRef<HTMLElement>(null);
  const idDeLaCapa = useId();

  const avisarEnElDia = useCallback((aviso: NuevoAviso) => {
    setAvisoDelDia({ texto: aviso.texto, accion: aviso.accion ?? null });
  }, []);
  const accionesDelDia = useAccionesDeLaAgenda(avisarEnElDia);

  useEffect(() => {
    if (avisoDelDia === null) return;
    const reloj = setTimeout(() => {
      setAvisoDelDia(null);
    }, DURACION_DEL_AVISO_DEL_DIA_MS);
    return () => {
      clearTimeout(reloj);
    };
  }, [avisoDelDia]);

  useEffect(() => {
    const capa = capaDelDia.current;
    if (diaAbierto === null || capa === null) return;
    if (!capa.matches(':popover-open')) capa.showPopover();
    capa.focus();

    const alTeclear = (evento: KeyboardEvent) => {
      if (evento.key !== 'Escape' || document.querySelector('dialog[open]') !== null) return;
      setDiaAbierto(null);
      setAvisoDelDia(null);
      areaDeLaGrilla.current
        ?.querySelector<HTMLButtonElement>(`[data-fecha="${diaAbierto}"] > button`)
        ?.focus();
    };
    const desplazable = capa.closest('main');
    const alAbrir = desplazable?.scrollTop ?? 0;
    const alDesplazar = () => {
      if (desplazable !== null && desplazable.scrollTop !== alAbrir) setDiaAbierto(null);
    };

    document.addEventListener('keydown', alTeclear, true);
    desplazable?.addEventListener('scroll', alDesplazar, { passive: true });
    return () => {
      document.removeEventListener('keydown', alTeclear, true);
      desplazable?.removeEventListener('scroll', alDesplazar);
    };
  }, [diaAbierto]);

  const datos = useMemo(() => datosDeLaAgendaDeLaReplica(replica), [replica]);
  const eventos = useMemo(() => eventosDeLaAgenda(datos, rangoDeLaGrilla(mes)), [datos, mes]);
  const fechasDeLaGrilla = useMemo(
    () =>
      semanasDelMes(mes)
        .flat()
        .map((celda) => celda.fecha),
    [mes],
  );
  const arrastre = useMoverEnLaAgenda(fechasDeLaGrilla);
  const delMes = eventos.filter((evento) => evento.fecha.startsWith(mes));
  const dia =
    elegido !== null && elegido.startsWith(mes) ? elegido : mes === mesDeHoy ? hoy : `${mes}-01`;

  function irAlMes(siguiente: string): void {
    setMes(siguiente);
    setElegido(null);
    setDesdeElPrincipio(true);
  }

  function irAHoy(): void {
    setMes(mesDeHoy);
    setElegido(hoy);
    setDiaAbierto(null);
    setDesdeElPrincipio(false);
  }

  function alAnotar(fecha: string): void {
    setMes(fecha.slice(0, 7));
    setElegido(fecha);
    setDesdeElPrincipio(false);
  }

  const hojaDeAnotar = (
    <ConSalida valor={anotando}>
      {(fecha) => (
        <HojaDeAnotacion
          fechaInicial={fecha}
          alCerrar={() => {
            setAnotando(null);
            setAnotandoDesdeElDia(false);
          }}
          alAnotar={alAnotar}
          avisar={anotandoDesdeElDia ? avisarEnElDia : undefined}
        />
      )}
    </ConSalida>
  );

  if (ancho === 'movil') {
    const fueraDeHoy = mes !== mesDeHoy || dia !== hoy;
    return (
      <Pagina className="pb-6">
        <header className="flex items-end justify-between gap-2.5">
          <div className="min-w-0">
            <p className="text-label text-text-2">hoy es {diaEnPalabras(hoy)}</p>
            <h1 className="font-display text-h1 leading-tight">Agenda</h1>
          </div>
          <div className="flex items-center gap-0.5">
            {fueraDeHoy && (
              <button
                type="button"
                onClick={irAHoy}
                className="mr-1 h-9 rounded-pill border border-ink px-3 text-label font-semibold"
              >
                Hoy
              </button>
            )}
            <BotonesDelMes
              alAnterior={() => {
                irAlMes(mesPrevio(mes));
              }}
              alSiguiente={() => {
                irAlMes(mesSiguiente(mes));
              }}
            />
          </div>
        </header>

        <div className="mt-2.5 flex items-baseline justify-between gap-2">
          <h2 aria-live="polite" className="text-section font-semibold first-letter:uppercase">
            {mesEnPalabras(mes, hoy)}
          </h2>
          <span className="text-meta text-text-3">{resumenDelMes(delMes)}</span>
        </div>

        <div className="sticky top-0 z-10 -mx-(--page-pad-mobile) bg-paper">
          <TiraDelMes
            mes={mes}
            hoy={hoy}
            elegido={dia}
            eventos={delMes}
            alElegir={(fecha) => {
              setElegido(fecha);
              setDesdeElPrincipio(false);
            }}
          />
        </div>

        <ListaDelMes
          mes={mes}
          hoy={hoy}
          dia={dia}
          desdeElPrincipio={desdeElPrincipio}
          eventos={delMes}
          acciones={acciones}
          alVerAnteriores={() => {
            setDesdeElPrincipio(true);
          }}
          alAbrirElDia={setDiaAbierto}
          alAnotar={setAnotando}
        />

        <ConSalida valor={diaAbierto}>
          {(fecha) => (
            <Hoja
              titulo={diaEnPalabras(fecha)}
              alCerrar={() => {
                setDiaAbierto(null);
                setAvisoDelDia(null);
              }}
              desdeAbajo
            >
              <DetalleDelDia
                fecha={fecha}
                hoy={hoy}
                eventos={eventosDelDia(eventos, fecha)}
                acciones={accionesDelDia}
                ahora={new Date()}
                conEncabezado={false}
                aviso={avisoDelDia}
                alDescartarElAviso={() => {
                  setAvisoDelDia(null);
                }}
                alAnotar={() => {
                  setAnotandoDesdeElDia(true);
                  setAnotando(fecha);
                }}
                alIrAUnTrabajo={() => {
                  setDiaAbierto(null);
                  setAvisoDelDia(null);
                }}
              />
            </Hoja>
          )}
        </ConSalida>
        {hojaDeAnotar}
      </Pagina>
    );
  }

  const visibles = eventos.filter((evento) => pasaElFiltro(evento, filtro));

  function elegirDia(fecha: string): void {
    setDiaAbierto((actual) => (actual === fecha ? null : fecha));
  }

  function devolverElFocoAlDia(fecha: string): void {
    areaDeLaGrilla.current
      ?.querySelector<HTMLButtonElement>(`[data-fecha="${fecha}"] > button`)
      ?.focus();
  }

  function cerrarElDia(): void {
    if (diaAbierto === null) return;
    setDiaAbierto(null);
    setAvisoDelDia(null);
    devolverElFocoAlDia(diaAbierto);
  }

  function anotarCerrandoElDia(fecha: string): void {
    setAnotando(fecha);
    setDiaAbierto(null);
    setAvisoDelDia(null);
  }

  return (
    <Pagina>
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="text-label text-text-2">hoy es {diaEnPalabras(hoy)}</p>
          <div className="flex flex-wrap items-baseline gap-x-3">
            <h1 className="font-display text-h1-lg leading-tight">Agenda</h1>
            <h2
              aria-live="polite"
              className="font-display text-h1 leading-tight text-text-2 first-letter:uppercase"
            >
              {mesEnPalabras(mes, hoy)}
            </h2>
            <span className="text-label text-text-3">{resumenDelMes(delMes)}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center">
            <button
              type="button"
              aria-label="Mes anterior"
              onClick={() => {
                setDiaAbierto(null);
                irAlMes(mesPrevio(mes));
              }}
              className="flex size-10 items-center justify-center rounded-l-field border border-r-0 border-border bg-paper hover:bg-surface"
            >
              <Icono nombre="chevron-left" tamano={18} />
            </button>
            <button
              type="button"
              onClick={irAHoy}
              className={`h-10 border border-border bg-paper px-3.5 text-body hover:bg-surface ${
                mes === mesDeHoy ? 'font-semibold' : 'font-medium'
              }`}
            >
              Hoy
            </button>
            <button
              type="button"
              aria-label="Mes siguiente"
              onClick={() => {
                setDiaAbierto(null);
                irAlMes(mesSiguiente(mes));
              }}
              className="flex size-10 items-center justify-center rounded-r-field border border-l-0 border-border bg-paper hover:bg-surface"
            >
              <Icono nombre="chevron-right" tamano={18} />
            </button>
          </div>
          <Button
            onClick={() => {
              anotarCerrandoElDia(diaAbierto ?? dia);
            }}
          >
            <Icono nombre="plus" tamano={18} grosor={2} />
            Anotar algo
          </Button>
        </div>
      </header>

      <div
        role="group"
        aria-label="Qué mostrar"
        className="flex flex-wrap items-center gap-2 pt-4 pb-3"
      >
        {FILTROS.map(({ id, etiqueta }) => {
          const activo = filtro === id;
          return (
            <button
              key={id}
              type="button"
              aria-pressed={activo}
              onClick={() => {
                setFiltro(id);
              }}
              className={`flex h-[34px] items-center gap-1.5 rounded-control border px-2.5 text-label font-medium ${
                activo ? 'border-ink bg-ink text-paper' : 'border-border bg-paper text-ink'
              }`}
            >
              {id === 'marcado' && (
                <span aria-hidden className="size-2.5 rounded-pill ring-[1.5px] ring-ag-marca" />
              )}
              {id !== 'todo' && id !== 'marcado' && (
                <MarcaDeCategoria
                  categoria={id}
                  className={activo ? 'brightness-[3] grayscale' : ''}
                />
              )}
              {etiqueta}
            </button>
          );
        })}
        <span className="flex-1" />
        <span className="flex items-center gap-1.5 text-meta text-text-3">
          <span aria-hidden className="size-3 rounded-pill ring-[1.5px] ring-ag-marca" />
          marcado a mano
        </span>
      </div>

      {delMes.length === 0 && (
        <p className="mb-3 max-w-[640px] text-label leading-relaxed text-text-2">{MES_VACIO}</p>
      )}

      <p role="status" aria-live="assertive" className="sr-only">
        {arrastre.anuncio}
      </p>

      <div ref={areaDeLaGrilla}>
        <GrillaDelMes
          mes={mes}
          hoy={hoy}
          elegido={diaAbierto}
          eventos={visibles}
          maximo={ancho === 'escritorio' ? 3 : 2}
          idDeLaCapa={idDeLaCapa}
          arrastre={arrastre}
          alElegirDia={elegirDia}
          alVerElDia={setDiaAbierto}
          alAbrirEvento={(evento) => {
            if (evento.clase === 'derivada') acciones.alAbrirTrabajo(evento);
            else setDiaAbierto(evento.fecha);
          }}
        />

        {diaAbierto !== null && (
          <aside
            ref={capaDelDia}
            id={idDeLaCapa}
            popover="auto"
            tabIndex={-1}
            aria-label={`El ${diaEnPalabras(diaAbierto)}`}
            onToggle={(evento) => {
              if (evento.newState !== 'closed') return;
              setDiaAbierto(null);
              setAvisoDelDia(null);
            }}
            className="capa-del-dia flex-col overflow-visible rounded-panel border border-hairline bg-paper p-0 text-ink shadow-float outline-none open:flex"
          >
            <span aria-hidden data-punta="hacia-la-izquierda" className="punta-del-dia" />
            <span aria-hidden data-punta="hacia-la-derecha" className="punta-del-dia" />
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-panel">
              <DetalleDelDia
                fecha={diaAbierto}
                hoy={hoy}
                eventos={eventosDelDia(visibles, diaAbierto)}
                acciones={accionesDelDia}
                ahora={new Date()}
                aviso={avisoDelDia}
                alDescartarElAviso={() => {
                  setAvisoDelDia(null);
                }}
                alAnotar={() => {
                  anotarCerrandoElDia(diaAbierto);
                }}
                alIrAUnTrabajo={() => {
                  setDiaAbierto(null);
                  setAvisoDelDia(null);
                }}
                alCerrar={cerrarElDia}
              />
            </div>
          </aside>
        )}
      </div>
      {hojaDeAnotar}
    </Pagina>
  );
}
