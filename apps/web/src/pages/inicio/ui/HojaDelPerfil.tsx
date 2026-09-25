import {
  asientosDelLibro,
  estadoDelDiezmo,
  eventosDeLaAgenda,
  nombresQueOpinaron,
} from '@maun/domain';
import type { ReactNode } from 'react';

import { diaEnPalabras, etiquetaDelDia, nombreDelEvento } from '@/entities/agenda';
import { fraseDelDiezmo } from '@/entities/movimiento';
import type { NovedadesDeOpiniones } from '@/entities/opinion';
import { FilaParaSalir } from '@/features/cerrar-sesion';
import { VersionDeLaApp } from '@/features/ver-novedades';
import { datosDeLaAgendaDeLaReplica, datosDelLibro, type Replica } from '@/shared/api';
import {
  describirEstadoSync,
  RUTA_DE_AGENDA,
  RUTA_DE_AJUSTES,
  RUTA_DE_DIEZMO,
  RUTA_DE_OPINIONES,
  useEstadoSync,
  type EstadoSync,
  Ir,
} from '@/shared/lib';
import { Avatar, Hoja, Icono, type NombreDeIcono } from '@/shared/ui';

const DIAS_QUE_MIRA_LA_AGENDA = 30;

const FILA =
  'flex min-h-14 w-full items-center gap-3.25 border-b border-hairline-soft px-1 py-2.5 text-left text-ink no-underline hover:bg-surface';

const PUNTO_DEL_ESTADO: Readonly<Record<EstadoSync['tipo'], string>> = {
  sincronizado: 'bg-ok',
  pendiente: 'bg-atencion',
  rechazado: 'bg-alerta',
  'sin-conexion': 'bg-text-3',
};

function masDias(fecha: string, dias: number): string {
  const dia = new Date(`${fecha}T12:00:00Z`);
  dia.setUTCDate(dia.getUTCDate() + dias);
  return dia.toISOString().slice(0, 10);
}

function proximoEnLaAgenda(replica: Replica, hoy: string): string {
  const [proximo] = eventosDeLaAgenda(datosDeLaAgendaDeLaReplica(replica), {
    desde: hoy,
    hasta: masDias(hoy, DIAS_QUE_MIRA_LA_AGENDA),
  }).filter((evento) => !evento.hecha);
  if (proximo === undefined) return 'Nada agendado por ahora';
  const etiqueta = etiquetaDelDia(proximo.fecha, hoy);
  const cuando =
    etiqueta === null ? diaEnPalabras(proximo.fecha) : etiqueta === 'hoy' ? 'Hoy' : 'Mañana';
  return `${cuando.charAt(0).toUpperCase()}${cuando.slice(1)}: ${nombreDelEvento(proximo)}`;
}

function Fila({
  ruta,
  icono,
  fondo = 'bg-surface text-ink',
  etiqueta,
  bajada,
  insignia,
}: {
  ruta: string;
  icono: NombreDeIcono;
  fondo?: string;
  etiqueta: string;
  bajada: string;
  insignia?: ReactNode;
}) {
  return (
    <Ir a={ruta} className={FILA}>
      <span className={`flex size-9 flex-none items-center justify-center rounded-field ${fondo}`}>
        <Icono nombre={icono} tamano={18} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-body-lg leading-snug font-medium">{etiqueta}</span>
        {bajada !== '' && (
          <span className="mt-px block text-label leading-snug text-text-2">{bajada}</span>
        )}
      </span>
      {insignia}
      <span aria-hidden className="flex flex-none text-text-3">
        <Icono nombre="chevron-right" tamano={18} />
      </span>
    </Ir>
  );
}

export interface HojaDelPerfilProps {
  replica: Replica;
  hoy: string;
  nombre: string;
  email: string;
  foto: string;
  novedades: NovedadesDeOpiniones;
  alCerrar: () => void;
}

export function HojaDelPerfil({
  replica,
  hoy,
  nombre,
  email,
  foto,
  novedades,
  alCerrar,
}: HojaDelPerfilProps) {
  const estado = useEstadoSync();
  const diezmo = fraseDelDiezmo(estadoDelDiezmo(asientosDelLibro(datosDelLibro(replica))));
  const quienes = nombresQueOpinaron(novedades.nombres);

  return (
    <Hoja
      titulo={nombre === '' ? email : nombre}
      bajada={nombre === '' ? undefined : email}
      antes={<Avatar nombre={nombre === '' ? email : nombre} foto={foto} />}
      desdeAbajo
      alCerrar={alCerrar}
    >
      <div className="min-h-0 flex-1 overflow-auto px-5 pt-1 pb-2">
        <nav aria-label="Lo que no entra en la barra">
          <Fila
            ruta={RUTA_DE_OPINIONES}
            icono="message-square-quote"
            etiqueta="Opiniones"
            bajada={
              novedades.sinLeer > 0 && quienes !== '' ? quienes : 'Lo que contestaron tus clientes'
            }
            insignia={
              novedades.sinLeer > 0 && (
                <span className="flex-none rounded-pill bg-op-mal px-2.25 py-0.75 text-meta font-semibold text-paper-fijo">
                  {novedades.sinLeer === 1 ? '1 nueva' : `${String(novedades.sinLeer)} nuevas`}
                </span>
              )
            }
          />
          <Fila
            ruta={RUTA_DE_DIEZMO}
            icono="church"
            fondo="bg-diezmo-tint text-diezmo"
            etiqueta="Diezmo"
            bajada={diezmo.frase}
          />
          <Fila
            ruta={RUTA_DE_AGENDA}
            icono="calendar-days"
            etiqueta="Agenda"
            bajada={proximoEnLaAgenda(replica, hoy)}
          />
        </nav>
        <div role="group" aria-labelledby="la-app" className="pt-4.5">
          <div id="la-app" className="px-1 pb-1.5 text-meta text-text-3">
            La app
          </div>
          <Fila
            ruta={RUTA_DE_AJUSTES}
            icono="settings"
            etiqueta="Ajustes"
            bajada="Sueldo, costos fijos, metas"
          />
          <FilaParaSalir className={FILA} />
        </div>
      </div>
      <div className="flex flex-none flex-wrap items-center gap-x-2.25 gap-y-1 border-t border-hairline px-5 pt-2.75 pb-[calc(0.6875rem+env(safe-area-inset-bottom))] text-meta text-text-3">
        <span
          aria-hidden
          className={`size-1.5 flex-none rounded-pill ${PUNTO_DEL_ESTADO[estado.tipo]}`}
        />
        <span className="min-w-0 flex-1">{describirEstadoSync(estado)}</span>
        <VersionDeLaApp className="text-left underline-offset-3 hover:text-ink hover:underline" />
      </div>
    </Hoja>
  );
}
