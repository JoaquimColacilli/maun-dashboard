import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';

import {
  buscarClientes,
  corteDeOrigenes,
  iniciales,
  ordenarClientes,
  ORDENES,
  resumenesDeClientes,
  rutaDelCliente,
  type Orden,
  type ResumenDeCliente,
} from '@/entities/cliente';
import { useReplicaDelTaller } from '@/entities/replica';
import { HojaDeCliente } from '@/features/editar-cliente';
import { formatearPesos, relativa } from '@/shared/lib';
import { Button, ConSalida, Icono, Pagina } from '@/shared/ui';

function detalleDe(resumen: ResumenDeCliente, hoy: string): string {
  const partes: string[] = [];
  if (resumen.cliente.zona !== '') partes.push(resumen.cliente.zona);
  if (resumen.ultimo && resumen.fechaDelUltimo !== undefined) {
    partes.push(`${resumen.ultimo.titulo}, ${relativa(resumen.fechaDelUltimo, hoy)}`);
  } else if (resumen.proyectos.length === 0) {
    partes.push('Sin trabajos todavía');
  }
  return partes.join(' · ');
}

function Fila({ resumen, hoy }: { resumen: ResumenDeCliente; hoy: string }) {
  const navegar = useNavigate();
  const { cliente } = resumen;

  return (
    <li className="border-b border-hairline">
      <button
        type="button"
        onClick={() => {
          void navegar(rutaDelCliente(cliente.id));
        }}
        className="grid min-h-[64px] w-full grid-cols-[40px_minmax(0,1fr)_auto] items-center gap-3 py-3 text-left hover:bg-surface lg:grid-cols-[40px_minmax(0,2fr)_minmax(0,1.4fr)_140px_120px]"
      >
        <span className="flex size-10 items-center justify-center rounded-pill bg-surface text-meta font-semibold">
          {iniciales(cliente.nombre)}
        </span>
        <span className="min-w-0">
          <span className="block truncate text-body-lg font-medium">{cliente.nombre}</span>
          <span className="block truncate text-meta text-text-2">{detalleDe(resumen, hoy)}</span>
        </span>
        <span className="hidden truncate text-meta text-text-2 lg:block">
          {resumen.fechaDelUltimo === undefined
            ? 'Sin trabajos'
            : relativa(resumen.fechaDelUltimo, hoy)}
        </span>
        <span className="hidden text-right text-body font-medium tabular-nums lg:block">
          {resumen.facturado > 0 ? formatearPesos(resumen.facturado) : '—'}
        </span>
        <span className="text-right whitespace-nowrap">
          {resumen.saldo > 0 ? (
            <span className="inline-block rounded-control bg-atencion-tint px-1.5 py-0.5 text-badge font-semibold text-atencion tabular-nums">
              debe {formatearPesos(resumen.saldo)}
            </span>
          ) : (
            <Icono nombre="chevron-right" tamano={18} className="inline text-text-3" />
          )}
        </span>
      </button>
    </li>
  );
}

function DeDondeVienen({ resumenes }: { resumenes: readonly ResumenDeCliente[] }) {
  const cortes = corteDeOrigenes(resumenes);
  const sinOrigen = resumenes.length - cortes.reduce((suma, corte) => suma + corte.cantidad, 0);
  if (cortes.length === 0) return null;

  return (
    <section aria-label="De dónde vienen los trabajos" className="mt-4">
      <div className="mb-2 flex items-baseline justify-between">
        <span className="text-label font-semibold">De dónde vienen los trabajos</span>
        <span className="text-meta text-text-2 tabular-nums">
          {resumenes.length} {resumenes.length === 1 ? 'cliente' : 'clientes'}
        </span>
      </div>
      <div className="flex h-2.5 gap-0.5 overflow-hidden rounded-control">
        {cortes.map((corte) => (
          <div
            key={corte.id}
            style={{ flex: `${String(corte.cantidad)} 1 0` }}
            className={corte.color}
          />
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1.5 text-meta text-text-2">
        {cortes.map((corte) => (
          <span key={corte.id} className="flex items-center gap-1.5">
            <span aria-hidden className={`size-2 rounded-control ${corte.color}`} />
            {corte.etiqueta} <strong className="text-ink tabular-nums">{corte.cantidad}</strong>
          </span>
        ))}
        {sinOrigen > 0 && (
          <span className="text-text-3">
            {sinOrigen} sin anotar de dónde {sinOrigen === 1 ? 'vino' : 'vinieron'}
          </span>
        )}
      </div>
    </section>
  );
}

export function ClientesPage() {
  const replica = useReplicaDelTaller();
  const [consulta, setConsulta] = useState('');
  const [orden, setOrden] = useState<Orden>('nombre');
  const [abierta, setAbierta] = useState(false);

  const hoy = new Date().toISOString().slice(0, 10);
  const resumenes = useMemo(() => resumenesDeClientes(replica), [replica]);
  const filas = useMemo(
    () => ordenarClientes(buscarClientes(resumenes, consulta), orden),
    [resumenes, consulta, orden],
  );

  const buscando = consulta.trim() !== '';

  return (
    <Pagina>
      <header className="mb-3.5 flex items-end justify-between gap-3">
        <h1 className="font-display text-h1 leading-tight lg:text-h1-lg">Clientes</h1>
        <Button
          onClick={() => {
            setAbierta(true);
          }}
        >
          <Icono nombre="user-plus" tamano={18} />
          Nuevo cliente
        </Button>
      </header>

      {resumenes.length === 0 ? (
        <section className="flex max-w-[520px] flex-col items-start gap-3 py-8">
          <span className="flex size-12 items-center justify-center rounded-field bg-surface">
            <Icono nombre="users" tamano={24} />
          </span>
          <h2 className="mt-1 text-h1 leading-tight font-semibold">
            La agenda del taller, todavía vacía
          </h2>
          <p className="text-body leading-relaxed text-text-2">
            Cargá a cada cliente una sola vez: dirección, teléfono y cómo facturarle. La próxima vez
            que te llame, todo ya está.
          </p>
          <Button
            onClick={() => {
              setAbierta(true);
            }}
          >
            Cargá tu primer cliente
          </Button>
        </section>
      ) : (
        <>
          <label className="flex h-field max-w-full items-center gap-2 rounded-field border border-border px-3 md:max-w-[420px]">
            <Icono nombre="search" tamano={18} className="flex-none text-text-2" />
            <input
              type="search"
              value={consulta}
              onChange={(evento) => {
                setConsulta(evento.target.value);
              }}
              placeholder="Nombre, teléfono o dirección"
              aria-label="Buscar cliente"
              className="min-w-0 flex-1 bg-transparent text-body-lg outline-none"
            />
          </label>

          <DeDondeVienen resumenes={resumenes} />

          <div className="@container mt-5">
            <div className="flex flex-col items-stretch gap-1.5 border-b border-ink pb-2 @min-[21.5rem]:flex-row @min-[21.5rem]:items-center @min-[21.5rem]:justify-between @min-[21.5rem]:gap-3">
              <span className="text-meta text-text-2 tabular-nums">
                {buscando
                  ? `${String(filas.length)} de ${String(resumenes.length)}`
                  : `${String(resumenes.length)} ${resumenes.length === 1 ? 'cliente' : 'clientes'}`}
              </span>
              <div
                role="radiogroup"
                aria-label="Ordenar por"
                className="grid grid-cols-3 gap-0.5 @min-[21.5rem]:flex"
              >
                {ORDENES.map((opcion) => (
                  <button
                    key={opcion.id}
                    type="button"
                    role="radio"
                    aria-checked={orden === opcion.id}
                    onClick={() => {
                      setOrden(opcion.id);
                    }}
                    className={`min-h-tap rounded-field px-2.5 text-meta ${
                      orden === opcion.id
                        ? 'bg-surface font-semibold text-ink'
                        : 'font-medium text-text-2'
                    }`}
                  >
                    {opcion.etiqueta}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {filas.length === 0 ? (
            <div className="flex flex-col items-start gap-3 py-7">
              <span className="text-body-lg text-text-2">Nadie coincide con «{consulta}».</span>
              <Button
                onClick={() => {
                  setAbierta(true);
                }}
              >
                Crear «{consulta.trim()}» como cliente nuevo
              </Button>
            </div>
          ) : (
            <ul className="list-none">
              {filas.map((resumen) => (
                <Fila key={resumen.cliente.id} resumen={resumen} hoy={hoy} />
              ))}
            </ul>
          )}
        </>
      )}

      <ConSalida valor={abierta}>
        {() => (
          <HojaDeCliente
            nombreInicial={filas.length === 0 && buscando ? consulta.trim() : undefined}
            alCerrar={() => {
              setAbierta(false);
            }}
            alGuardar={() => {
              setConsulta('');
            }}
          />
        )}
      </ConSalida>
    </Pagina>
  );
}
