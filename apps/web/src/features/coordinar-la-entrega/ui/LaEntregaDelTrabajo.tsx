import type { FranjaDeEntrega } from '@maun/domain';
import { useMutation } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';

import {
  coordinacionEnLaFicha,
  MUTACION_DE_PROPUESTA_DE_ENTREGA,
  type CoordinacionEnLaFicha,
} from '@/entities/entrega';
import {
  cambiosDeLaComprometida,
  entregaGuardada,
  fechaConSuFranja,
  guardadoDeUnPaso,
  MUTACION_DE_LA_ENTREGA,
  MUTACION_DE_PROYECTO,
  type Proyecto,
} from '@/entities/proyecto';
import { useReplicaDelTaller } from '@/entities/replica';
import {
  fechaLarga,
  metaDeAvisos,
  rutaDeCompartir,
  useEstadoSync,
  useIr,
  uuidv7,
} from '@/shared/lib';
import { Button, ConSalida, Icono } from '@/shared/ui';

import {
  fechasQuePasaron,
  momentoDeLaEntrega,
  opcionesParaConfirmar,
  type FechaQueSeElige,
} from '../model/entrega';
import { HojaDeLaFecha } from './HojaDeLaFecha';

export interface LaEntregaDelTrabajoProps {
  proyecto: Proyecto;
  cliente: string;
  hoy: string;
}

const TARJETA = 'rounded-panel border border-hairline bg-paper px-4 py-4 md:px-5';

const YA_PASO: Readonly<Record<'estimada' | 'comprometida', string>> = {
  estimada: 'La entrega estimada ya pasó: tu cliente no la ve. Movela a un día que venga.',
  comprometida:
    'La entrega comprometida ya pasó: tu cliente no la ve. Cambiala, o marcá en «Qué falta» que ya lo entregaste.',
};

function Renglon({
  clave,
  valor,
  extra,
  children,
}: {
  clave: string;
  valor: string;
  extra?: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-hairline-soft py-3 first:border-t-0">
      <div className="min-w-0 flex-1 basis-44">
        <dt className="text-meta text-text-2">{clave}</dt>
        <dd className="mt-0.5 text-body-lg leading-snug font-medium">{valor}</dd>
        {extra !== undefined && (
          <dd className="mt-0.5 text-meta font-medium text-hogar">{extra}</dd>
        )}
      </div>
      {children !== undefined && <div className="flex flex-none flex-wrap gap-2">{children}</div>}
    </div>
  );
}

function Aviso({ texto }: { texto: string }) {
  return (
    <p className="mt-2 flex items-start gap-2 rounded-field bg-alerta-tint px-3.5 py-2.5 text-label leading-relaxed font-medium text-alerta">
      <Icono nombre="triangle-alert" tamano={16} className="mt-0.5 flex-none" />
      {texto}
    </p>
  );
}

function LoQueContesto({
  coordinacion,
  cliente,
  hoy,
  alConfirmar,
}: {
  coordinacion: CoordinacionEnLaFicha;
  cliente: string;
  hoy: string;
  alConfirmar: (fecha: string, franja: FranjaDeEntrega) => void;
}) {
  const { respuesta } = coordinacion;
  if (respuesta === null) return null;
  const quien = cliente === '' ? 'Tu cliente' : cliente;
  return (
    <div className="mt-3 flex flex-col gap-2">
      <p className="text-body font-semibold">
        {respuesta.dias.length === 0
          ? `${quien} te dejó una nota`
          : `${quien} te pasó sus días. Confirmá uno:`}
      </p>
      {respuesta.dias.length > 0 && (
        <ul className="list-none">
          {respuesta.dias.map((dia) => {
            const opciones = opcionesParaConfirmar(dia, hoy);
            return (
              <li
                key={dia.fecha}
                className="flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-hairline-soft py-2.5"
              >
                <span
                  className={`min-w-0 flex-1 basis-32 text-body font-medium tabular-nums ${
                    opciones.length === 0 ? 'text-text-3 line-through' : ''
                  }`}
                >
                  {fechaLarga(dia.fecha, hoy)}
                </span>
                {opciones.length === 0 ? (
                  <span className="text-meta text-text-3">ya pasó</span>
                ) : (
                  <span className="flex flex-wrap gap-2">
                    {opciones.map((opcion) => (
                      <Button
                        key={opcion.franja}
                        size="chico"
                        variant="secundario"
                        aria-label={`Confirmar el ${fechaConSuFranja(opcion.fecha, opcion.franja, hoy)}`}
                        onClick={() => {
                          alConfirmar(opcion.fecha, opcion.franja);
                        }}
                      >
                        {opcion.etiqueta}
                      </Button>
                    ))}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {respuesta.nota.trim() !== '' && (
        <p className="rounded-field bg-surface-3 px-3.5 py-2.5 text-body leading-relaxed whitespace-pre-line">
          {respuesta.nota}
        </p>
      )}
    </div>
  );
}

interface HojaAbierta {
  que: FechaQueSeElige;
}

export function LaEntregaDelTrabajo({ proyecto, cliente, hoy }: LaEntregaDelTrabajoProps) {
  const replica = useReplicaDelTaller();
  const ir = useIr();
  const sync = useEstadoSync();
  const sinSenal = sync.tipo === 'sin-conexion';
  const [hoja, setHoja] = useState<HojaAbierta | null>(null);

  const estimada = useMutation({
    ...MUTACION_DE_PROYECTO,
    meta: metaDeAvisos('entregaEstimada', { errorEnPantalla: true, sujeto: proyecto.titulo }),
  });
  const comprometida = useMutation({
    ...MUTACION_DE_LA_ENTREGA,
    meta: metaDeAvisos('entregaComprometida', { errorEnPantalla: true, sujeto: proyecto.titulo }),
  });
  const sacar = useMutation({
    ...MUTACION_DE_LA_ENTREGA,
    meta: metaDeAvisos('sinEntregaComprometida', {
      errorEnPantalla: true,
      sujeto: proyecto.titulo,
    }),
  });
  const pedir = useMutation({
    ...MUTACION_DE_PROPUESTA_DE_ENTREGA,
    meta: metaDeAvisos('pedidoDeEntrega', { errorEnPantalla: true, sujeto: proyecto.titulo }),
  });

  if (proyecto.estado !== 'en_curso') return null;

  const coordinacion = coordinacionEnLaFicha(replica, proyecto.id);
  const guardada = entregaGuardada(proyecto);
  const momento = momentoDeLaEntrega(proyecto);
  const pasadas = fechasQuePasaron(proyecto, hoy);
  const quien = cliente === '' ? 'Tu cliente' : cliente;
  const { propuesta } = coordinacion;

  function comprometer(fecha: string | null, franja: FranjaDeEntrega | null): void {
    const cambios = cambiosDeLaComprometida(fecha, franja);
    const previos = {
      entrega_comprometida: guardada.entrega_comprometida,
      entrega_comprometida_franja: guardada.entrega_comprometida_franja,
    };
    const mutacion = fecha === null ? sacar : comprometida;
    mutacion.mutate({ id: proyecto.id, cambios, previos, version: proyecto.version });
  }

  function pedirSusDias(): void {
    pedir.reset();
    pedir.mutate({
      proyectoId: proyecto.id,
      nueva: { id: uuidv7(), forma: 'sus_dias', fecha: null, franja: null },
      abierta: propuesta,
      momento: new Date().toISOString(),
    });
  }

  function cerrar(): void {
    setHoja(null);
  }

  return (
    <section aria-labelledby={`entrega-${proyecto.id}`} className={TARJETA}>
      <h2 id={`entrega-${proyecto.id}`} className="mb-1.5 text-section font-semibold">
        La entrega
      </h2>

      <dl>
        <Renglon
          clave="Estimada"
          valor={
            proyecto.entrega_estimada === null
              ? 'Sin fecha'
              : fechaLarga(proyecto.entrega_estimada, hoy)
          }
        >
          <Button
            size="chico"
            variant="secundario"
            onClick={() => {
              setHoja({ que: 'estimada' });
            }}
          >
            {proyecto.entrega_estimada === null ? 'Ponerle fecha' : 'Cambiar'}
          </Button>
        </Renglon>
        <Renglon
          clave="Comprometida con el cliente"
          valor={
            guardada.entrega_comprometida === null
              ? 'Todavía no'
              : fechaConSuFranja(
                  guardada.entrega_comprometida,
                  guardada.entrega_comprometida_franja,
                  hoy,
                )
          }
          extra={coordinacion.laAceptoElCliente ? `La aceptó ${quien}` : undefined}
        >
          <Button
            size="chico"
            variant="secundario"
            onClick={() => {
              setHoja({ que: 'comprometida' });
            }}
          >
            {guardada.entrega_comprometida === null ? 'Comprometer un día' : 'Cambiar'}
          </Button>
          {guardada.entrega_comprometida !== null && (
            <Button
              size="chico"
              variant="terciario"
              onClick={() => {
                comprometer(null, null);
              }}
            >
              Sacar
            </Button>
          )}
        </Renglon>
      </dl>

      {pasadas.map((pasada) => (
        <Aviso key={pasada.cual} texto={YA_PASO[pasada.cual]} />
      ))}

      {momento === 'fabricando' && (
        <p className="mt-2 text-label leading-relaxed text-text-2">
          Tu cliente ve la estimada como «Fecha estimada de entrega». Cuando esté terminado, tocá
          «Ya está listo» y coordinás el día con él.
        </p>
      )}

      {momento === 'listo' && (
        <div className="mt-2 border-t border-hairline-soft pt-3">
          {propuesta === null ? (
            <p className="text-body leading-relaxed text-text-2">
              Proponele un día, o pedile que marque los días y horarios que le quedan bien.
            </p>
          ) : coordinacion.respuesta === null ? (
            <p className="text-body leading-relaxed text-text-2">
              {propuesta.forma === 'un_dia' && propuesta.fecha !== null
                ? `Le propusiste el ${fechaConSuFranja(propuesta.fecha, propuesta.franja, hoy)}. Todavía no contestó.`
                : 'Le pediste sus días. Todavía no contestó.'}
            </p>
          ) : null}

          <LoQueContesto
            coordinacion={coordinacion}
            cliente={cliente}
            hoy={hoy}
            alConfirmar={(fecha, franja) => {
              comprometer(fecha, franja);
            }}
          />

          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              size="chico"
              disabled={sinSenal}
              onClick={() => {
                pedir.reset();
                setHoja({ que: 'propuesta' });
              }}
            >
              {propuesta?.forma === 'un_dia' ? 'Proponerle otro día' : 'Proponerle un día'}
            </Button>
            <Button
              size="chico"
              variant="secundario"
              disabled={sinSenal}
              cargando={pedir.isPending && hoja === null}
              onClick={pedirSusDias}
            >
              {propuesta?.forma === 'sus_dias' ? 'Pedirle otros días' : 'Pedirle sus días'}
            </Button>
          </div>
          {sinSenal && (
            <p className="mt-2 flex items-center gap-2 text-label font-medium text-text-2">
              <Icono nombre="cloud-off" tamano={16} />
              Para pedirle el día necesitás señal: tu cliente lo ve recién cuando llega.
            </p>
          )}
        </div>
      )}

      <div className="mt-3">
        <Button
          size="chico"
          variant="terciario"
          className="-ml-3"
          onClick={() => {
            ir(rutaDeCompartir(proyecto.id));
          }}
        >
          Ver cómo lo ve {cliente === '' ? 'tu cliente' : cliente}
        </Button>
      </div>

      <ConSalida valor={hoja}>
        {(abierta) =>
          abierta.que === 'estimada' ? (
            <HojaDeLaFecha
              que="estimada"
              titulo="La entrega estimada"
              bajada={proyecto.titulo}
              ayuda="Tu cliente la ve como «Fecha estimada de entrega» mientras lo fabricás."
              boton="Guardar"
              hoy={hoy}
              fecha={proyecto.entrega_estimada ?? ''}
              franja={null}
              conFranja={false}
              sujeto={proyecto.titulo}
              alGuardar={(fecha) => {
                estimada.mutate(guardadoDeUnPaso(proyecto, { entrega_estimada: fecha }, hoy));
                cerrar();
              }}
              alCerrar={cerrar}
            />
          ) : abierta.que === 'comprometida' ? (
            <HojaDeLaFecha
              que="comprometida"
              titulo="La entrega comprometida"
              bajada={proyecto.titulo}
              ayuda="Es el día que acordaste con tu cliente. Lo ve como una buena noticia en su enlace."
              boton="Comprometer"
              hoy={hoy}
              fecha={guardada.entrega_comprometida ?? ''}
              franja={guardada.entrega_comprometida_franja}
              conFranja
              sujeto={proyecto.titulo}
              alGuardar={(fecha, franja) => {
                comprometer(fecha, franja);
                cerrar();
              }}
              alCerrar={cerrar}
            />
          ) : (
            <HojaDeLaFecha
              que="propuesta"
              titulo="Proponerle un día"
              bajada={`${quien} · ${proyecto.titulo}`}
              ayuda="Lo ve en su enlace con «Me queda bien». Si lo acepta, la entrega queda comprometida sola."
              boton="Proponérselo"
              hoy={hoy}
              fecha={propuesta?.fecha ?? ''}
              franja={propuesta?.franja ?? null}
              conFranja
              cargando={pedir.isPending}
              rechazo={pedir.error}
              sujeto={proyecto.titulo}
              alGuardar={(fecha, franja) => {
                pedir.mutate(
                  {
                    proyectoId: proyecto.id,
                    nueva: { id: uuidv7(), forma: 'un_dia', fecha, franja },
                    abierta: propuesta,
                    momento: new Date().toISOString(),
                  },
                  { onSuccess: cerrar },
                );
              }}
              alCerrar={cerrar}
            />
          )
        }
      </ConSalida>
    </section>
  );
}
