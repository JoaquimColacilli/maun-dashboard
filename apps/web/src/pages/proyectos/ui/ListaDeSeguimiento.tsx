import { useMemo, useState } from 'react';

import { AccionesDeContacto, EnlaceACliente } from '@/entities/cliente';
import {
  buscarProyectos,
  ESTADO,
  etapaAlVolver,
  seguimientosEnOrden,
  TarjetaDeProyecto,
  TarjetasDeProyectos,
  type EnSeguimiento,
  type ResumenDeProyecto,
} from '@/entities/proyecto';
import type { Replica } from '@/shared/api';
import { fechaLarga, formatearPesos, relativa } from '@/shared/lib';
import { Button, EstadoVacio, Icono } from '@/shared/ui';

function cuandoLeToca({ pendiente, atrasado, esHoy }: EnSeguimiento, hoy: string): string {
  if (pendiente === undefined) return 'Sin fecha para volver a escribirle';
  if (esHoy) return 'Le toca hoy';
  if (atrasado) {
    return `Atrasado: le tocaba el ${fechaLarga(pendiente.fecha, hoy)}, ${relativa(pendiente.fecha, hoy)}`;
  }
  return `El ${fechaLarga(pendiente.fecha, hoy)}, ${relativa(pendiente.fecha, hoy)}`;
}

function TarjetaDeSeguimiento({ fila, hoy }: { fila: EnSeguimiento; hoy: string }) {
  const { resumen, pendiente, atrasado, esHoy } = fila;
  const { proyecto, cliente } = resumen;
  const nota = pendiente?.nota.trim() ?? '';

  return (
    <TarjetaDeProyecto
      resumen={resumen}
      atencion={atrasado}
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
        <p className="text-label font-semibold">Volver a escribirle</p>
        <p
          className={`mt-0.5 flex items-center gap-1.5 text-meta ${
            atrasado || esHoy ? 'font-semibold text-atencion' : 'text-text-2'
          }`}
        >
          <Icono nombre="calendar" tamano={13} />
          {cuandoLeToca(fila, hoy)}
        </p>
      </div>

      {nota !== '' && <p className="line-clamp-2 text-meta leading-snug text-text-2">{nota}</p>}

      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-meta tabular-nums">
        <dt className="text-text-3">Estaba en</dt>
        <dd className="font-medium">{ESTADO[etapaAlVolver(pendiente)].etiqueta}</dd>
        {proyecto.presupuesto_centavos !== null && (
          <>
            <dt className="text-text-3">Presupuesto</dt>
            <dd className="font-medium">{formatearPesos(proyecto.presupuesto_centavos)}</dd>
          </>
        )}
        {resumen.cobrado > 0 && (
          <>
            <dt className="text-text-3">Seña cobrada</dt>
            <dd className="font-medium text-hogar">{formatearPesos(resumen.cobrado)}</dd>
          </>
        )}
      </dl>
    </TarjetaDeProyecto>
  );
}

export interface ListaDeSeguimientoProps {
  resumenes: readonly ResumenDeProyecto[];
  replica: Replica;
  hoy: string;
}

export function ListaDeSeguimiento({ resumenes, replica, hoy }: ListaDeSeguimientoProps) {
  const [consulta, setConsulta] = useState('');

  const enSeguimiento = useMemo(
    () => seguimientosEnOrden(resumenes, replica, hoy),
    [resumenes, replica, hoy],
  );

  const visibles = useMemo(() => {
    const coinciden = new Set(buscarProyectos(resumenes, consulta).map((r) => r.proyecto.id));
    return enSeguimiento.filter((fila) => coinciden.has(fila.resumen.proyecto.id));
  }, [enSeguimiento, resumenes, consulta]);

  if (enSeguimiento.length === 0) {
    return (
      <EstadoVacio
        ilustracion="sin-seguimiento"
        titulo="Nadie en seguimiento"
        detalle="Cuando una consulta te diga «por ahora no», pasala a seguimiento desde su ficha con el día en que le volvés a escribir. Acá quedan en orden, los atrasados primero, y la agenda te avisa cuándo toca."
      />
    );
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex h-9 w-full items-center gap-2 rounded-pill border border-hairline bg-paper px-3.5 md:w-auto md:max-w-[320px] md:min-w-[180px] md:flex-1">
          <Icono nombre="search" tamano={16} className="flex-none text-text-2" />
          <input
            type="search"
            value={consulta}
            onChange={(evento) => {
              setConsulta(evento.target.value);
            }}
            placeholder="Buscar por cliente o trabajo"
            aria-label="Buscar en seguimiento"
            className="min-w-0 flex-1 bg-transparent text-label outline-none"
          />
        </label>
      </div>

      {visibles.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-panel border border-dashed border-border px-5 py-6 text-center">
          <p className="text-body-lg text-text-2">
            Nadie en seguimiento coincide con «{consulta}».
          </p>
          <Button
            variant="secundario"
            onClick={() => {
              setConsulta('');
            }}
          >
            Limpiar la búsqueda
          </Button>
        </div>
      ) : (
        <>
          <p className="px-1 text-meta text-text-2">
            Por el día en que le volvés a escribir: los atrasados, primero.
          </p>
          <TarjetasDeProyectos etiqueta="En seguimiento">
            {visibles.map((fila) => (
              <TarjetaDeSeguimiento key={fila.resumen.proyecto.id} fila={fila} hoy={hoy} />
            ))}
          </TarjetasDeProyectos>
        </>
      )}
    </>
  );
}
