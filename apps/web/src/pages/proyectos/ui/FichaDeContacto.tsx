import { useCallback, useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router';

import { AccionesDeContacto, rutaDelCliente } from '@/entities/cliente';
import {
  BloqueDeLaSena,
  CostosDeCotizar,
  EstadoBadge,
  gastosDelProyecto,
  opcionesDelProyecto,
  pagosDelProyecto,
  RUTA_DE_SEGUIMIENTO,
  rutaDeCierre,
  rutaDeEdicion,
  senaDelProyecto,
  senaDelTrabajo,
  situacionDelContacto,
  ultimasActividades,
  yaSeRelevo,
  type EtapaDeSeguimiento,
  type ResumenDeProyecto,
} from '@/entities/proyecto';
import { useReplicaDelTaller } from '@/entities/replica';
import { AyudaDeLaVista } from '@/entities/vista-cliente';
import { ArchivosDelTrabajo } from '@/features/adjuntar-archivos';
import {
  BorradoDelProyecto,
  LoQueHaceFalta,
  NotasDelProyecto,
  OpcionesDelTrabajo,
} from '@/features/editar-proyecto';
import { AvanceDelContacto, HojaDeContacto } from '@/features/seguir-contacto';
import {
  fechaLarga,
  formatearPesos,
  hoyLocal,
  relativa,
  rutaDeCompartir,
  useAvisosDelProyecto,
} from '@/shared/lib';
import { Button, ConSalida, Icono, Pagina, PanelDeAvisos } from '@/shared/ui';

function Dato({
  clave,
  valor,
  tono = '',
  accion,
}: {
  clave: string;
  valor: string;
  tono?: string;
  accion?: ReactNode;
}) {
  return (
    <div className="grid grid-cols-[120px_1fr] items-center gap-3 border-t border-hairline py-2.5 text-body">
      <dt className="text-text-3">{clave}</dt>
      <dd className={`flex flex-wrap items-center justify-between gap-x-3 gap-y-1 ${tono}`}>
        <span className="leading-snug font-medium tabular-nums">{valor}</span>
        {accion}
      </dd>
    </div>
  );
}

type HojaAbierta = 'contacto' | 'visita' | null;

export interface FichaDeContactoProps {
  resumen: ResumenDeProyecto;
  etapa: EtapaDeSeguimiento;
}

export function FichaDeContacto({ resumen, etapa }: FichaDeContactoProps) {
  const replica = useReplicaDelTaller();
  const navegar = useNavigate();
  const avisos = useAvisosDelProyecto(resumen.proyecto.id);
  const [editando, setEditando] = useState<HojaAbierta>(null);
  const cerrarLaHoja = useCallback(() => {
    setEditando(null);
  }, []);

  const hoy = hoyLocal();
  const { proyecto, cliente } = resumen;
  const pagos = pagosDelProyecto(replica, proyecto.id);
  const gastos = gastosDelProyecto(replica, proyecto.id);
  const ultimaActividad = ultimasActividades(replica).get(proyecto.id) ?? proyecto.updated_at;
  const situacion = situacionDelContacto(proyecto, ultimaActividad, hoy, resumen.cobrado);
  const nombre = cliente?.nombre ?? resumen.nombreDelCliente;
  const relevado = yaSeRelevo(proyecto, hoy);
  const esperaAlCliente =
    proyecto.estado === 'presupuesto_enviado' || proyecto.estado === 'presupuesto_estimativo';

  return (
    <Pagina>
      <div className="mb-2.5 flex items-center justify-between">
        <Link
          to={RUTA_DE_SEGUIMIENTO}
          className="flex min-h-tap items-center gap-1 rounded-field pr-2 text-body font-medium text-text-2 hover:bg-surface"
        >
          <Icono nombre="chevron-left" tamano={20} />
          Seguimiento
        </Link>
        <div className="flex flex-none gap-2">
          <AyudaDeLaVista />
          <Button
            variant="secundario"
            size="chico"
            aria-label="Mostrarle al cliente"
            onClick={() => {
              void navegar(rutaDeCompartir(proyecto.id));
            }}
          >
            <Icono nombre="eye" tamano={16} />
            <span className="hidden sm:inline">Mostrarle al cliente</span>
          </Button>
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
            aria-label="Editar"
            onClick={() => {
              setEditando('contacto');
            }}
          >
            <Icono nombre="pencil" tamano={16} />
            <span className="hidden sm:inline">Editar</span>
          </Button>
        </div>
      </div>

      <header className="flex flex-col gap-2">
        {cliente === undefined ? (
          <span className="text-label text-text-3">{resumen.nombreDelCliente}</span>
        ) : (
          <Link
            to={rutaDelCliente(cliente.id)}
            className="inline-flex items-center gap-1.5 self-start text-label font-medium text-text-2"
          >
            {cliente.nombre}
            <Icono nombre="chevron-right" tamano={14} />
          </Link>
        )}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
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

      <div className="mt-4 grid items-start gap-5 lg:grid-cols-2 lg:gap-x-11">
        <div className="flex min-w-0 flex-col gap-5">
          <section aria-label={`Contactar a ${nombre}`}>
            <AccionesDeContacto nombre={nombre} telefono={cliente?.telefono ?? ''} amplias />
          </section>

          <AvanceDelContacto
            proyecto={proyecto}
            etapa={etapa}
            situacion={situacion}
            cobrado={resumen.cobrado}
            conOpciones={opcionesDelProyecto(replica, proyecto.id).length > 0}
            alAgendar={() => {
              setEditando('visita');
            }}
          />

          <OpcionesDelTrabajo proyecto={proyecto} ofreceCargarLaPrimera />

          <BloqueDeLaSena
            sena={senaDelTrabajo(replica, proyecto, resumen.cobrado)}
            propia={senaDelProyecto(proyecto) !== null}
          />

          {etapa !== 'a_presupuestar' && <CostosDeCotizar proyecto={proyecto} />}

          <section aria-label="Datos del contacto">
            <dl>
              <Dato
                clave={relevado ? 'Relevamiento' : 'Visita'}
                valor={
                  proyecto.fecha_visita === null
                    ? 'Sin fecha'
                    : `${fechaLarga(proyecto.fecha_visita, hoy)}, ${relativa(proyecto.fecha_visita, hoy)}`
                }
                accion={
                  <Button
                    variant="secundario"
                    size="chico"
                    aria-label={
                      relevado ? 'Cambiar el día del relevamiento' : 'Cambiar el día de la visita'
                    }
                    onClick={() => {
                      setEditando('visita');
                    }}
                  >
                    Cambiar
                  </Button>
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
              {!esperaAlCliente && (
                <Dato
                  clave="Presupuesto antes del"
                  valor={
                    proyecto.vencimiento_presupuesto === null
                      ? 'Sin fecha límite'
                      : `${fechaLarga(proyecto.vencimiento_presupuesto, hoy)}, ${relativa(proyecto.vencimiento_presupuesto, hoy)}`
                  }
                />
              )}
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
          <LoQueHaceFalta proyecto={proyecto} />

          <NotasDelProyecto
            proyecto={proyecto}
            titulo="Notas"
            placeholder="Lo que te dijo por teléfono, medidas, cómo llegar…"
          />

          <ArchivosDelTrabajo proyectoId={proyecto.id} />

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
              Dar por perdido
            </Button>
          </section>
        </div>
      </div>

      <ConSalida valor={editando}>
        {(abierta) => (
          <HojaDeContacto
            proyecto={proyecto}
            enfocarLaVisita={abierta === 'visita'}
            alCerrar={cerrarLaHoja}
          />
        )}
      </ConSalida>
    </Pagina>
  );
}
