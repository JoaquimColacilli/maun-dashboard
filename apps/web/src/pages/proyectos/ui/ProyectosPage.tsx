import { type EstadoProyecto, type Fase } from '@maun/domain';
import { useMemo, useState } from 'react';
import { Link, Outlet, useLocation, useNavigate, useSearchParams } from 'react-router';

import { EnlaceACliente } from '@/entities/cliente';
import {
  buscarProyectos,
  CRITERIOS,
  EntregaRelativa,
  ESTADO,
  EstadoBadge,
  MarcaDeLiquidacion,
  ETAPAS,
  FILTROS_POR_ETAPA,
  filtrarPorEstado,
  filtrarPorEtapa,
  metricasDeProyectos,
  ordenarProyectos,
  ORDEN_POR_DEFECTO,
  resumenesDeProyectos,
  RUTA_DE_CONTACTO_NUEVO,
  RUTA_DE_PROYECTO_NUEVO,
  rutaDelProyecto,
  type ResumenDeProyecto,
} from '@/entities/proyecto';
import { useReplicaDelTaller } from '@/entities/replica';
import { alternar, formatearPesos, hoyLocal, useAnchoDePantalla, type Sentido } from '@/shared/lib';
import { Button, Icono, Pagina } from '@/shared/ui';

import { ListaDeSeguimiento } from './ListaDeSeguimiento';

function etapaDeLaRuta(pathname: string, busqueda: URLSearchParams): Fase {
  if (pathname === '/seguimiento') return 'seguimiento';
  return busqueda.get('etapa') === 'historial' ? 'historial' : 'activos';
}

function Metricas({ resumenes }: { resumenes: readonly ResumenDeProyecto[] }) {
  const metricas = metricasDeProyectos(resumenes);
  const filas = [
    { valor: metricas.total, etiqueta: 'proyectos' },
    { valor: metricas.enCurso, etiqueta: 'en curso' },
    { valor: metricas.entregadosConSaldo, etiqueta: 'entregados con saldo' },
    { valor: metricas.cobrados, etiqueta: 'cobrados' },
  ];

  return (
    <dl className="grid grid-cols-4 border-t border-b border-hairline">
      {filas.map((fila) => (
        <div key={fila.etiqueta} className="min-w-0 py-3 pr-3">
          <dd className="text-money-lg leading-tight font-semibold tabular-nums">{fila.valor}</dd>
          <dt className="mt-0.5 text-meta leading-snug text-text-2">{fila.etiqueta}</dt>
        </div>
      ))}
    </dl>
  );
}

function Tarjeta({ resumen, hoy }: { resumen: ResumenDeProyecto; hoy: string }) {
  const { proyecto } = resumen;

  return (
    <article className="flex flex-col gap-2 border-t border-hairline py-3.5">
      <div className="flex items-center justify-between gap-2">
        {resumen.cliente === undefined ? (
          <span className="text-meta text-text-3">{resumen.nombreDelCliente}</span>
        ) : (
          <EnlaceACliente
            id={resumen.cliente.id}
            nombre={resumen.cliente.nombre}
            className="text-meta font-medium text-text-2"
          />
        )}
        <EstadoBadge estado={proyecto.estado} />
      </div>

      <MarcaDeLiquidacion proyectoId={proyecto.id} />

      <Link
        to={rutaDelProyecto(proyecto.id)}
        className="text-body-lg leading-snug font-medium text-pretty"
      >
        {proyecto.titulo}
      </Link>

      <dl className="grid grid-cols-3 gap-2 tabular-nums">
        <div>
          <dt className="text-meta text-text-3">Presupuesto</dt>
          <dd className="text-body font-medium">
            {proyecto.presupuesto_centavos === null ? '—' : formatearPesos(resumen.presupuesto)}
          </dd>
        </div>
        <div>
          <dt className="text-meta text-text-3">Cobrado</dt>
          <dd className="text-body font-medium">{formatearPesos(resumen.cobrado)}</dd>
        </div>
        <div>
          <dt className="text-meta text-text-3">Saldo</dt>
          <dd
            className={`text-body font-semibold ${resumen.saldo > 0 ? 'text-ink' : 'text-hogar'}`}
          >
            {resumen.saldo > 0 ? formatearPesos(resumen.saldo) : 'Sin saldo'}
          </dd>
        </div>
      </dl>

      <div className="text-label">
        <EntregaRelativa
          entregaEstimada={proyecto.entrega_estimada}
          urgencia={resumen.urgencia}
          hoy={hoy}
        />
      </div>
    </article>
  );
}

function Tabla({
  filas,
  hoy,
  orden,
  sentido,
  alOrdenar,
}: {
  filas: readonly ResumenDeProyecto[];
  hoy: string;
  orden: string;
  sentido: Sentido;
  alOrdenar: (id: string) => void;
}) {
  return (
    <table className="w-full border-collapse text-body">
      <thead>
        <tr>
          {CRITERIOS.map((criterio) => {
            const activo = criterio.id === orden;
            const aLaDerecha = criterio.tipo === 'numero';
            return (
              <th
                key={criterio.id}
                scope="col"
                aria-sort={activo ? (sentido === 'asc' ? 'ascending' : 'descending') : 'none'}
                className="border-b border-ink p-0"
              >
                <button
                  type="button"
                  onClick={() => {
                    alOrdenar(criterio.id);
                  }}
                  className={`flex h-10 w-full items-center gap-1.5 px-2.5 text-meta hover:bg-surface ${
                    aLaDerecha ? 'justify-end' : 'justify-start'
                  } ${activo ? 'bg-surface font-semibold text-ink' : 'font-medium text-text-3'}`}
                >
                  {criterio.etiqueta}
                  <Icono
                    nombre={
                      activo ? (sentido === 'asc' ? 'arrow-up' : 'arrow-down') : 'arrow-up-down'
                    }
                    tamano={14}
                    grosor={activo ? 2.25 : 1.5}
                  />
                </button>
              </th>
            );
          })}
        </tr>
      </thead>
      <tbody>
        {filas.map((resumen) => (
          <tr
            key={resumen.proyecto.id}
            className="h-13 border-b border-hairline hover:bg-surface-3"
          >
            <td className="px-2.5 whitespace-nowrap">
              {resumen.cliente === undefined ? (
                <span className="text-text-3">{resumen.nombreDelCliente}</span>
              ) : (
                <EnlaceACliente id={resumen.cliente.id} nombre={resumen.cliente.nombre} />
              )}
            </td>
            <td className="max-w-[340px] px-2.5">
              <Link
                to={rutaDelProyecto(resumen.proyecto.id)}
                className="block truncate font-medium"
                title={resumen.proyecto.titulo}
              >
                {resumen.proyecto.titulo}
              </Link>
            </td>
            <td className="px-2.5 text-right tabular-nums whitespace-nowrap">
              {resumen.proyecto.presupuesto_centavos === null
                ? '—'
                : formatearPesos(resumen.presupuesto)}
            </td>
            <td className="px-2.5 text-right tabular-nums whitespace-nowrap">
              {formatearPesos(resumen.cobrado)}
            </td>
            <td
              className={`px-2.5 text-right font-semibold tabular-nums whitespace-nowrap ${
                resumen.saldo > 0 ? 'text-ink' : 'text-hogar'
              }`}
            >
              {resumen.saldo > 0 ? formatearPesos(resumen.saldo) : 'Sin saldo'}
            </td>
            <td className="px-2.5 whitespace-nowrap">
              <EntregaRelativa
                entregaEstimada={resumen.proyecto.entrega_estimada}
                urgencia={resumen.urgencia}
                hoy={hoy}
                conFecha
              />
            </td>
            <td className="px-2.5 whitespace-nowrap">
              <span className="flex flex-col items-start gap-1">
                <EstadoBadge estado={resumen.proyecto.estado} />
                <MarcaDeLiquidacion proyectoId={resumen.proyecto.id} />
              </span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function HojaDeOrden({
  orden,
  alElegir,
  alCerrar,
}: {
  orden: string;
  alElegir: (id: string) => void;
  alCerrar: () => void;
}) {
  return (
    <div className="fixed inset-0 z-40">
      <button
        type="button"
        aria-hidden
        tabIndex={-1}
        onClick={alCerrar}
        className="absolute inset-0 cursor-default bg-velo"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Ordenar por"
        className="absolute inset-x-0 bottom-0 rounded-t-sheet bg-paper px-4 pt-2 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-sheet"
      >
        <span aria-hidden className="mx-auto mt-1 mb-3.5 block h-1 w-9 rounded-control bg-border" />
        <h2 className="mb-1.5 text-body-lg font-semibold">Ordenar por</h2>
        {CRITERIOS.map((criterio) => (
          <button
            key={criterio.id}
            type="button"
            onClick={() => {
              alElegir(criterio.id);
            }}
            className={`flex min-h-[48px] w-full items-center justify-between border-b border-hairline-soft text-left text-body-lg ${
              criterio.id === orden ? 'font-semibold' : ''
            }`}
          >
            {criterio.etiqueta}
            {criterio.id === orden && <Icono nombre="check" tamano={18} />}
          </button>
        ))}
      </div>
    </div>
  );
}

function Vacio({ etapa }: { etapa: Exclude<Fase, 'seguimiento'> }) {
  const navegar = useNavigate();
  const textos: Record<Exclude<Fase, 'seguimiento'>, { titulo: string; detalle: string }> = {
    activos: {
      titulo: 'Todavía no hay proyectos activos',
      detalle:
        'Acá están los trabajos que te aprobaron. Los contactos y los presupuestos que esperan respuesta viven en Seguimiento, y pasan solos a esta pestaña cuando los aprobás.',
    },
    historial: {
      titulo: 'Todavía no cerraste ningún proyecto',
      detalle:
        'Cuando cobres el primero, acá va a quedar el historial con lo que ganaste en cada uno.',
    },
  };

  const texto = textos[etapa];

  return (
    <section className="flex max-w-[520px] flex-col items-start gap-3 py-8">
      <span className="flex size-12 items-center justify-center rounded-field bg-surface">
        <Icono nombre="folder-kanban" tamano={24} />
      </span>
      <h2 className="mt-1 text-h1 leading-tight font-semibold">{texto.titulo}</h2>
      <p className="text-body leading-relaxed text-text-2">{texto.detalle}</p>
      <Button
        onClick={() => {
          void navegar(RUTA_DE_PROYECTO_NUEVO);
        }}
      >
        Cargar un proyecto
      </Button>
    </section>
  );
}

export function ProyectosPage() {
  const replica = useReplicaDelTaller();
  const navegar = useNavigate();
  const { pathname } = useLocation();
  const [busqueda] = useSearchParams();
  const ancho = useAnchoDePantalla();

  const [consulta, setConsulta] = useState('');
  const [filtro, setFiltro] = useState<EstadoProyecto | 'todos'>('todos');
  const [orden, setOrden] = useState(ORDEN_POR_DEFECTO);
  const [sentido, setSentido] = useState<Sentido>('asc');
  const [hojaAbierta, setHojaAbierta] = useState(false);

  const hoy = hoyLocal();
  const etapa = etapaDeLaRuta(pathname, busqueda);
  const resumenes = useMemo(() => resumenesDeProyectos(replica, hoy), [replica, hoy]);
  const deLaEtapa = useMemo(() => filtrarPorEtapa(resumenes, etapa), [resumenes, etapa]);

  const filas = useMemo(
    () =>
      ordenarProyectos(
        buscarProyectos(filtrarPorEstado(deLaEtapa, filtro), consulta),
        orden,
        sentido,
      ),
    [deLaEtapa, filtro, consulta, orden, sentido],
  );

  const buscando = consulta.trim() !== '';
  const enEscritorio = ancho === 'escritorio';

  function ordenarPor(id: string): void {
    if (id === orden) {
      setSentido(alternar(sentido));
      return;
    }
    const criterio = CRITERIOS.find((uno) => uno.id === id);
    setOrden(id);
    setSentido(criterio?.inicial ?? 'asc');
  }

  return (
    <Pagina>
      <header className="mb-3.5 flex items-end justify-between gap-3">
        <h1 className="font-display text-h1 leading-tight lg:text-h1-lg">Proyectos</h1>
        {etapa === 'seguimiento' ? (
          <Button
            onClick={() => {
              void navegar(RUTA_DE_CONTACTO_NUEVO);
            }}
          >
            <Icono nombre="user-plus" tamano={18} />
            Cargar contacto
          </Button>
        ) : (
          <Button
            onClick={() => {
              void navegar(RUTA_DE_PROYECTO_NUEVO);
            }}
          >
            <Icono nombre="plus" tamano={18} />
            Nuevo proyecto
          </Button>
        )}
      </header>

      <div
        role="tablist"
        aria-label="Etapa"
        className="mb-4 flex max-w-[520px] gap-0.5 rounded-panel bg-surface-2 p-1"
      >
        {ETAPAS.map((opcion) => {
          const activa = opcion.id === etapa;
          const cuantos = resumenes.filter((resumen) => resumen.fase === opcion.id).length;
          return (
            <button
              key={opcion.id}
              type="button"
              role="tab"
              aria-selected={activa}
              onClick={() => {
                void navegar(opcion.ruta);
              }}
              className={`flex h-9.5 flex-1 items-center justify-center gap-1.5 rounded-field text-label ${
                activa
                  ? 'bg-elevado font-semibold text-ink shadow-float'
                  : 'font-medium text-text-2'
              }`}
            >
              {opcion.etiqueta}
              <span className="text-meta text-text-3 tabular-nums">{cuantos}</span>
            </button>
          );
        })}
      </div>

      {etapa === 'seguimiento' ? (
        <ListaDeSeguimiento resumenes={deLaEtapa} replica={replica} hoy={hoy} />
      ) : deLaEtapa.length === 0 ? (
        <Vacio etapa={etapa} />
      ) : (
        <>
          <Metricas resumenes={resumenes} />

          <div className="mt-3.5 mb-3 flex flex-wrap items-center gap-2">
            <label className="flex h-9 max-w-full min-w-[180px] flex-1 items-center gap-2 rounded-field border border-border px-3 md:max-w-[320px]">
              <Icono nombre="search" tamano={16} className="flex-none text-text-2" />
              <input
                type="search"
                value={consulta}
                onChange={(evento) => {
                  setConsulta(evento.target.value);
                }}
                placeholder="Buscar por cliente"
                aria-label="Buscar por cliente"
                className="min-w-0 flex-1 bg-transparent text-label outline-none"
              />
            </label>

            {(['todos', ...FILTROS_POR_ETAPA[etapa]] as const).map((estado) => {
              const activo = filtro === estado;
              return (
                <button
                  key={estado}
                  type="button"
                  aria-pressed={activo}
                  onClick={() => {
                    setFiltro(estado);
                  }}
                  className={`h-9 rounded-control border px-3 text-label font-medium ${
                    activo ? 'border-ink bg-ink text-paper' : 'border-border text-ink'
                  }`}
                >
                  {estado === 'todos' ? 'Todos' : ESTADO[estado].etiqueta}
                </button>
              );
            })}

            {!enEscritorio && (
              <button
                type="button"
                onClick={() => {
                  setHojaAbierta(true);
                }}
                className="ml-auto flex h-9 items-center gap-1.5 rounded-control border border-border px-3 text-label font-medium"
              >
                <Icono nombre="arrow-up-down" tamano={14} />
                {CRITERIOS.find((criterio) => criterio.id === orden)?.etiqueta ?? 'Ordenar'}
              </button>
            )}
          </div>

          {filas.length === 0 ? (
            <div className="flex flex-col items-start gap-3 py-7">
              <p className="text-body-lg text-text-2">
                {buscando
                  ? `Ningún proyecto coincide con «${consulta}».`
                  : 'Ningún proyecto está en ese estado.'}
              </p>
              <Button
                variant="secundario"
                onClick={() => {
                  setConsulta('');
                  setFiltro('todos');
                }}
              >
                Limpiar la búsqueda
              </Button>
            </div>
          ) : enEscritorio ? (
            <Tabla filas={filas} hoy={hoy} orden={orden} sentido={sentido} alOrdenar={ordenarPor} />
          ) : (
            <div className="grid grid-cols-1 gap-x-8 md:grid-cols-2">
              {filas.map((resumen) => (
                <Tarjeta key={resumen.proyecto.id} resumen={resumen} hoy={hoy} />
              ))}
            </div>
          )}
        </>
      )}

      {hojaAbierta && (
        <HojaDeOrden
          orden={orden}
          alElegir={(id) => {
            ordenarPor(id);
            setHojaAbierta(false);
          }}
          alCerrar={() => {
            setHojaAbierta(false);
          }}
        />
      )}

      <Outlet />
    </Pagina>
  );
}
