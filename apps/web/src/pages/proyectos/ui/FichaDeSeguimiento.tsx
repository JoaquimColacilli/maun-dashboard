import { useCallback, useState, type ReactNode } from 'react';

import { AccionesDeContacto, rutaDelCliente } from '@/entities/cliente';
import {
  ESTADO,
  EstadoBadge,
  etapaAlVolver,
  historiaDelSeguimiento,
  pendienteDelSeguimiento,
  RUTA_DE_SEGUIMIENTO,
  rutaDeCierre,
  textoDelResultado,
  type ResumenDeProyecto,
} from '@/entities/proyecto';
import { useReplicaDelTaller } from '@/entities/replica';
import { ArchivosDelTrabajo } from '@/features/adjuntar-archivos';
import { HojaDeContacto } from '@/features/avanzar-la-consulta';
import { BorradoDelProyecto, NotasDelProyecto } from '@/features/editar-proyecto';
import { HojaDeRegistrarElContacto } from '@/features/hacer-el-seguimiento';
import {
  fechaLarga,
  formatearPesos,
  hoyEnElTaller,
  relativa,
  useAvisosDelProyecto,
  Ir,
  useIr,
  useVolver,
} from '@/shared/lib';
import {
  Button,
  ConSalida,
  FilaDeAcciones,
  Icono,
  Pagina,
  PanelDeAvisos,
  PanelDePaso,
  PrincipalYApoyo,
} from '@/shared/ui';

function Dato({
  clave,
  children,
  tono = '',
}: {
  clave: string;
  children: ReactNode;
  tono?: string;
}) {
  return (
    <div className="grid grid-cols-[120px_1fr] items-center gap-3 border-t border-hairline py-2.5 text-body">
      <dt className="text-text-3">{clave}</dt>
      <dd className={`leading-snug font-medium tabular-nums ${tono}`}>{children}</dd>
    </div>
  );
}

type HojaAbierta = 'registrar' | 'editar' | null;

export interface FichaDeSeguimientoProps {
  resumen: ResumenDeProyecto;
}

export function FichaDeSeguimiento({ resumen }: FichaDeSeguimientoProps) {
  const replica = useReplicaDelTaller();
  const ir = useIr();
  const vuelta = useVolver(RUTA_DE_SEGUIMIENTO, 'Seguimiento');
  const { proyecto, cliente } = resumen;
  const avisos = useAvisosDelProyecto(proyecto.id);
  const [hoja, setHoja] = useState<HojaAbierta>(null);
  const cerrarLaHoja = useCallback(() => {
    setHoja(null);
  }, []);

  const hoy = hoyEnElTaller();
  const nombre = cliente?.nombre ?? resumen.nombreDelCliente;
  const telefono = cliente?.telefono ?? '';
  const pendiente = pendienteDelSeguimiento(replica, proyecto.id);
  const historia = historiaDelSeguimiento(replica, proyecto.id);
  const atrasado = pendiente !== undefined && pendiente.fecha < hoy;

  const paso =
    pendiente === undefined
      ? 'Sin día para volver a escribirle'
      : pendiente.fecha === hoy
        ? 'Hoy le volvés a escribir'
        : atrasado
          ? `Le tocaba el ${fechaLarga(pendiente.fecha, hoy)}`
          : `Le volvés a escribir el ${fechaLarga(pendiente.fecha, hoy)}`;
  const detalle =
    pendiente === undefined
      ? ''
      : [relativa(pendiente.fecha, hoy), pendiente.nota.trim()]
          .filter((parte) => parte !== '')
          .join(' · ');

  return (
    <Pagina>
      <div className="mb-2.5 flex items-center justify-between">
        <Ir
          a={RUTA_DE_SEGUIMIENTO}
          alTocar={vuelta.volver}
          className="flex min-h-tap items-center gap-1 rounded-field pr-2 text-body font-medium text-text-2 hover:bg-surface"
        >
          <Icono nombre="chevron-left" tamano={20} />
          {vuelta.etiqueta}
        </Ir>
        <div className="flex flex-none gap-2">
          <BorradoDelProyecto
            proyecto={proyecto}
            sustantivo="contacto"
            alBorrar={() => {
              ir(RUTA_DE_SEGUIMIENTO, { como: 'terminar' });
            }}
          />
          <Button
            variant="secundario"
            size="chico"
            aria-label="Editar"
            onClick={() => {
              setHoja('editar');
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
          <Ir
            a={rutaDelCliente(cliente.id)}
            className="inline-flex items-center gap-1.5 self-start text-label font-medium text-text-2"
          >
            {cliente.nombre}
            <Icono nombre="chevron-right" tamano={14} />
          </Ir>
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

      <PrincipalYApoyo
        apoyoPrimero
        className="mt-4"
        apoyo={
          <div className="flex flex-col gap-5">
            <section aria-label={`Contactar a ${nombre}`}>
              <AccionesDeContacto nombre={nombre} telefono={telefono} amplias />
            </section>

            <PanelDePaso
              titulo="Próximo contacto"
              paso={paso}
              detalle={detalle}
              icono="calendar"
              tono={atrasado ? 'atencion' : 'normal'}
            >
              {pendiente !== undefined && (
                <FilaDeAcciones className="mt-3">
                  <Button
                    onClick={() => {
                      setHoja('registrar');
                    }}
                  >
                    <Icono nombre="message-circle" tamano={18} />
                    Registrar el contacto
                  </Button>
                </FilaDeAcciones>
              )}
              <p className="mt-3 text-meta leading-relaxed text-text-3">
                Cuando le escribas, registralo: ahí elegís si vuelve a las consultas, si sigue en
                seguimiento con otra fecha o si no va.
              </p>
            </PanelDePaso>
          </div>
        }
      >
        <div className="flex flex-col gap-5">
          <section aria-label="Datos del trabajo">
            <dl>
              <Dato clave="Estaba en">{ESTADO[etapaAlVolver(pendiente)].etiqueta}</Dato>
              <Dato clave="Presupuesto">
                {proyecto.presupuesto_centavos === null
                  ? 'Todavía sin presupuesto'
                  : formatearPesos(proyecto.presupuesto_centavos)}
              </Dato>
              <Dato clave="Seña cobrada" tono={resumen.cobrado > 0 ? 'text-hogar' : ''}>
                {resumen.cobrado > 0 ? formatearPesos(resumen.cobrado) : 'Sin seña'}
              </Dato>
              <Dato clave="Teléfono">{telefono.trim() === '' ? 'Sin teléfono' : telefono}</Dato>
            </dl>
          </section>

          <section aria-labelledby="historia-del-seguimiento">
            <h2 id="historia-del-seguimiento" className="text-section font-semibold">
              Historia del seguimiento
            </h2>
            {historia.length === 0 ? (
              <p className="mt-1.5 text-label text-text-2">
                Todavía no le volviste a escribir desde que pasó a seguimiento.
              </p>
            ) : (
              <ol className="mt-1.5 flex list-none flex-col">
                {historia.map((contacto) => (
                  <li key={contacto.id} className="border-t border-hairline py-2.5">
                    <p className="text-body">
                      <span className="font-semibold">
                        {fechaLarga(contacto.hecho_el ?? contacto.fecha, hoy)}
                      </span>
                      {textoDelResultado(contacto.resultado) !== '' && (
                        <span className="text-text-2">
                          {' · '}
                          {textoDelResultado(contacto.resultado)}
                        </span>
                      )}
                    </p>
                    {contacto.respuesta.trim() !== '' && (
                      <p className="mt-0.5 text-label leading-snug text-text-2">
                        {contacto.respuesta}
                      </p>
                    )}
                  </li>
                ))}
              </ol>
            )}
          </section>

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
                ? `La seña de ${formatearPesos(resumen.cobrado)} se liquida como ingreso del taller, y el trabajo pasa al historial. Se puede reactivar.`
                : 'Pasa al historial sin mover plata. Se puede reactivar.'}
            </p>
            <Button
              variant="secundario"
              className="mt-2.5"
              onClick={() => {
                ir(rutaDeCierre(proyecto.id));
              }}
            >
              <Icono nombre="x" tamano={16} />
              Dar por perdido
            </Button>
          </section>
        </div>
      </PrincipalYApoyo>

      <ConSalida valor={hoja}>
        {(abierta) =>
          abierta === 'registrar' && pendiente !== undefined ? (
            <HojaDeRegistrarElContacto
              proyecto={proyecto}
              pendiente={pendiente}
              nombre={nombre}
              telefono={telefono}
              alCerrar={cerrarLaHoja}
            />
          ) : (
            <HojaDeContacto proyecto={proyecto} alCerrar={cerrarLaHoja} />
          )
        }
      </ConSalida>
    </Pagina>
  );
}
