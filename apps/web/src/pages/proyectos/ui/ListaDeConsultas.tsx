import { ESTADOS_DE_CONSULTA, type EstadoProyecto } from '@maun/domain';
import { useMemo, useState } from 'react';
import { useLocation } from 'react-router';

import { AccionesDeContacto, EnlaceACliente } from '@/entities/cliente';
import {
  buscarProyectos,
  contactosEnOrden,
  ESTADO,
  RUTA_DE_CONTACTO_NUEVO,
  TarjetaDeProyecto,
  TarjetasDeProyectos,
  type ContactoEnLista,
  type ResumenDeProyecto,
} from '@/entities/proyecto';
import type { Replica } from '@/shared/api';
import { conFondo, fechaLarga, formatearPesos, useIr } from '@/shared/lib';
import { Button, Icono } from '@/shared/ui';

function TarjetaDeContacto({ contacto, hoy }: { contacto: ContactoEnLista; hoy: string }) {
  const { resumen, situacion } = contacto;
  const { proyecto, cliente } = resumen;

  const datos: { clave: string; valor: string; tono: string }[] = [];
  if (proyecto.fecha_visita !== null) {
    datos.push({ clave: 'Visita', valor: fechaLarga(proyecto.fecha_visita, hoy), tono: '' });
  }
  if (resumen.cobrado > 0) {
    datos.push({
      clave: 'Seña cobrada',
      valor: formatearPesos(resumen.cobrado),
      tono: 'text-hogar',
    });
  }
  if (proyecto.presupuesto_centavos !== null) {
    datos.push({
      clave: 'Presupuesto',
      valor: formatearPesos(proyecto.presupuesto_centavos),
      tono: '',
    });
  }

  return (
    <TarjetaDeProyecto
      resumen={resumen}
      atencion={situacion.fria}
      cliente={
        cliente === undefined ? (
          <span className="text-meta text-text-3">{resumen.nombreDelCliente}</span>
        ) : (
          <EnlaceACliente
            id={cliente.id}
            nombre={cliente.nombre}
            className="-my-2 py-2 pr-3 text-meta font-medium text-text-2"
          />
        )
      }
      pie={
        <AccionesDeContacto
          nombre={cliente?.nombre ?? resumen.nombreDelCliente}
          telefono={cliente?.telefono ?? ''}
        />
      }
    >
      <div>
        <p className="text-label font-semibold">{situacion.proximoPaso}</p>
        <p
          className={`mt-0.5 flex items-center gap-1.5 text-meta ${
            situacion.fria ? 'font-semibold text-atencion' : 'text-text-2'
          }`}
        >
          <Icono nombre={situacion.agendada ? 'calendar' : 'clock'} tamano={13} />
          {situacion.espera}
        </p>
      </div>

      {datos.length > 0 && (
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-meta tabular-nums">
          {datos.map((dato) => (
            <div key={dato.clave} className="contents">
              <dt className="text-text-3">{dato.clave}</dt>
              <dd className={`font-medium ${dato.tono}`}>{dato.valor}</dd>
            </div>
          ))}
        </dl>
      )}

      {proyecto.notas !== '' && (
        <p className="line-clamp-2 text-meta leading-snug text-text-2">{proyecto.notas}</p>
      )}
    </TarjetaDeProyecto>
  );
}

export interface ListaDeConsultasProps {
  resumenes: readonly ResumenDeProyecto[];
  replica: Replica;
  hoy: string;
}

export function ListaDeConsultas({ resumenes, replica, hoy }: ListaDeConsultasProps) {
  const ir = useIr();
  const location = useLocation();
  const [consulta, setConsulta] = useState('');
  const [filtro, setFiltro] = useState<EstadoProyecto | 'todos'>('todos');

  const contactos = useMemo(
    () => contactosEnOrden(resumenes, replica, hoy),
    [resumenes, replica, hoy],
  );

  const visibles = useMemo(() => {
    const coinciden = new Set(buscarProyectos(resumenes, consulta).map((r) => r.proyecto.id));
    return contactos.filter(
      (contacto) =>
        coinciden.has(contacto.resumen.proyecto.id) &&
        (filtro === 'todos' || contacto.resumen.proyecto.estado === filtro),
    );
  }, [contactos, resumenes, consulta, filtro]);

  if (contactos.length === 0) {
    return (
      <section className="flex max-w-[520px] flex-col items-start gap-3 py-8">
        <span className="flex size-12 items-center justify-center rounded-field bg-surface">
          <Icono nombre="route" tamano={24} />
        </span>
        <h2 className="mt-1 text-h1 leading-tight font-semibold">No hay consultas por ahora</h2>
        <p className="text-body leading-relaxed text-text-2">
          Cuando te llame alguien, cargalo acá con lo que pide y la fecha de la visita. Si en la
          visita te dejó una seña, anotala: entra a la caja del taller desde ese día. Cuando lo
          apruebe, pasa a Activos.
        </p>
        <Button
          onClick={() => {
            ir(RUTA_DE_CONTACTO_NUEVO, { state: conFondo(location) });
          }}
        >
          <Icono nombre="user-plus" tamano={18} />
          Cargar el primer contacto
        </Button>
      </section>
    );
  }

  const buscando = consulta.trim() !== '';

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <label className="flex h-9 max-w-full min-w-[180px] flex-1 items-center gap-2 rounded-field border border-border px-3 md:max-w-[320px]">
          <Icono nombre="search" tamano={16} className="flex-none text-text-2" />
          <input
            type="search"
            value={consulta}
            onChange={(evento) => {
              setConsulta(evento.target.value);
            }}
            placeholder="Buscar por cliente o trabajo"
            aria-label="Buscar contacto"
            className="min-w-0 flex-1 bg-transparent text-label outline-none"
          />
        </label>

        {(['todos', ...ESTADOS_DE_CONSULTA] as const).map((estado) => {
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
      </div>

      {visibles.length === 0 ? (
        <div className="flex flex-col items-start gap-3 py-7">
          <p className="text-body-lg text-text-2">
            {buscando
              ? `Ningún contacto coincide con «${consulta}».`
              : 'Ningún contacto está en esa etapa.'}
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
      ) : (
        <>
          <p className="mb-2.5 text-meta text-text-2">
            Primero lo que hace más que espera; las visitas agendadas, al final.
          </p>
          <TarjetasDeProyectos etiqueta="Contactos">
            {visibles.map((contacto) => (
              <TarjetaDeContacto key={contacto.resumen.proyecto.id} contacto={contacto} hoy={hoy} />
            ))}
          </TarjetasDeProyectos>
        </>
      )}
    </>
  );
}
