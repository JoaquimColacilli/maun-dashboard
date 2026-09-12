import { useCallback, useState } from 'react';
import { Link, useNavigate } from 'react-router';

import { AccionesDeContacto } from '@/entities/cliente';
import {
  EstadoBadge,
  gastosDelProyecto,
  pagosDelProyecto,
  RUTA_DE_SEGUIMIENTO,
  rutaDeCierre,
  rutaDeEdicion,
  situacionDelContacto,
  ultimasActividades,
  type EtapaDeSeguimiento,
  type ResumenDeProyecto,
} from '@/entities/proyecto';
import { useReplicaDelTaller } from '@/entities/replica';
import { BorradoDelProyecto, NotasDelProyecto } from '@/features/editar-proyecto';
import { AvanceDelContacto, HojaDeContacto } from '@/features/seguir-contacto';
import { fechaLarga, formatearPesos, hoyLocal, relativa, useAvisosDelProyecto } from '@/shared/lib';
import { Button, Icono, PanelDeAvisos } from '@/shared/ui';

function Dato({ clave, valor, tono = '' }: { clave: string; valor: string; tono?: string }) {
  return (
    <div className="grid grid-cols-[120px_1fr] gap-3 border-t border-hairline py-2.5 text-body">
      <dt className="text-text-3">{clave}</dt>
      <dd className={`leading-snug font-medium tabular-nums ${tono}`}>{valor}</dd>
    </div>
  );
}

export interface FichaDeContactoProps {
  resumen: ResumenDeProyecto;
  etapa: EtapaDeSeguimiento;
}

export function FichaDeContacto({ resumen, etapa }: FichaDeContactoProps) {
  const replica = useReplicaDelTaller();
  const navegar = useNavigate();
  const avisos = useAvisosDelProyecto(resumen.proyecto.id);
  const [editando, setEditando] = useState(false);
  const cerrarLaHoja = useCallback(() => {
    setEditando(false);
  }, []);

  const hoy = hoyLocal();
  const { proyecto, cliente } = resumen;
  const pagos = pagosDelProyecto(replica, proyecto.id);
  const gastos = gastosDelProyecto(replica, proyecto.id);
  const ultimaActividad = ultimasActividades(replica).get(proyecto.id) ?? proyecto.updated_at;
  const situacion = situacionDelContacto(proyecto, ultimaActividad, hoy);
  const nombre = cliente?.nombre ?? resumen.nombreDelCliente;

  return (
    <div className="mx-auto flex max-w-content flex-col px-(--page-pad-mobile) py-2 md:px-(--page-pad-tablet) md:py-5 lg:px-(--page-pad-desktop) lg:py-6">
      <div className="mb-2.5 flex items-center justify-between">
        <Link
          to={RUTA_DE_SEGUIMIENTO}
          className="flex min-h-tap items-center gap-1 rounded-field pr-2 text-body font-medium text-text-2 hover:bg-surface"
        >
          <Icono nombre="chevron-left" tamano={20} />
          Seguimiento
        </Link>
        <div className="flex gap-2">
          <BorradoDelProyecto
            proyecto={proyecto}
            sustantivo="contacto"
            alBorrar={() => {
              void navegar(RUTA_DE_SEGUIMIENTO);
            }}
          />
          <Button
            variant="secundario"
            size="chico"
            onClick={() => {
              setEditando(true);
            }}
          >
            <Icono nombre="pencil" tamano={16} />
            Editar
          </Button>
        </div>
      </div>

      <header className="flex flex-col gap-2">
        {cliente === undefined ? (
          <span className="text-label text-text-3">{resumen.nombreDelCliente}</span>
        ) : (
          <Link
            to={`/clientes/${cliente.id}`}
            className="inline-flex items-center gap-1.5 self-start text-label font-medium text-text-2"
          >
            {cliente.nombre}
            <Icono nombre="chevron-right" tamano={14} />
          </Link>
        )}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h1 className="max-w-[720px] font-display text-h1 leading-tight text-pretty lg:text-h1-lg">
            {proyecto.titulo}
          </h1>
          <EstadoBadge estado={proyecto.estado} />
        </div>
      </header>

      {avisos.length > 0 && (
        <div className="mt-4">
          <PanelDeAvisos avisos={avisos} />
        </div>
      )}

      <section aria-label={`Contactar a ${nombre}`} className="mt-4 max-w-[520px]">
        <AccionesDeContacto nombre={nombre} telefono={cliente?.telefono ?? ''} amplias />
      </section>

      <div className="mt-5 grid gap-5 lg:grid-cols-2 lg:gap-x-11">
        <div className="flex min-w-0 flex-col gap-5">
          <AvanceDelContacto
            proyecto={proyecto}
            etapa={etapa}
            situacion={situacion}
            alAgendar={() => {
              setEditando(true);
            }}
          />

          <section aria-label="Datos del contacto">
            <dl>
              <Dato
                clave="Visita"
                valor={
                  proyecto.fecha_visita === null
                    ? 'Sin fecha'
                    : `${fechaLarga(proyecto.fecha_visita, hoy)}, ${relativa(proyecto.fecha_visita, hoy)}`
                }
              />
              <Dato
                clave="Seña cobrada"
                valor={resumen.cobrado > 0 ? formatearPesos(resumen.cobrado) : 'Sin seña'}
                tono={resumen.cobrado > 0 ? 'text-hogar' : ''}
              />
              <Dato
                clave="Presupuesto"
                valor={
                  proyecto.presupuesto_centavos === null
                    ? 'Todavía sin presupuesto'
                    : formatearPesos(proyecto.presupuesto_centavos)
                }
              />
              <Dato
                clave="Teléfono"
                valor={
                  cliente === undefined || cliente.telefono.trim() === ''
                    ? 'Sin teléfono'
                    : cliente.telefono
                }
              />
              {gastos.length > 0 && (
                <Dato clave="Gastos cargados" valor={formatearPesos(resumen.gastos)} />
              )}
            </dl>
            {(pagos.length > 0 || gastos.length > 0) && (
              <p className="mt-1.5 text-meta leading-relaxed text-text-3">
                La seña ya entró a la caja del taller y los gastos ya salieron: se ven en Finanzas
                desde el día que los cargaste.
              </p>
            )}
            <Link
              to={rutaDeEdicion(proyecto.id)}
              className="mt-2 flex min-h-tap w-fit items-center gap-1.5 rounded-field text-label font-medium underline underline-offset-3"
            >
              Cargar otro pago o un gasto
            </Link>
          </section>
        </div>

        <div className="flex min-w-0 flex-col gap-5">
          <NotasDelProyecto
            proyecto={proyecto}
            titulo="Notas"
            placeholder="Lo que te dijo por teléfono, medidas, cómo llegar…"
          />

          <section aria-label="Si no sale" className="rounded-panel bg-surface-3 px-4 py-3.5">
            <h2 className="text-section font-semibold">Si no sale</h2>
            <p className="mt-1 text-label leading-relaxed text-text-2">
              {resumen.cobrado > 0
                ? `La seña de ${formatearPesos(resumen.cobrado)} se liquida como ingreso del taller, y el contacto pasa al historial. Se puede reactivar.`
                : 'Pasa al historial sin mover plata. Se puede reactivar.'}
            </p>
            <Button
              variant="secundario"
              className="mt-2.5"
              onClick={() => {
                void navegar(rutaDeCierre(proyecto.id));
              }}
            >
              <Icono nombre="x" tamano={16} />
              Darlo por perdido
            </Button>
          </section>
        </div>
      </div>

      {editando && <HojaDeContacto proyecto={proyecto} alCerrar={cerrarLaHoja} />}
    </div>
  );
}
