import { eventosDeLaAgenda } from '@maun/domain';
import { Link } from 'react-router';

import { MarcaConAnillo, nombreDelEvento } from '@/entities/agenda';
import { datosDeLaAgendaDeLaReplica, type Replica } from '@/shared/api';
import { RUTA_DE_AGENDA } from '@/shared/lib';
import { Icono } from '@/shared/ui';

const MAXIMO = 3;

export function HoyEnLaAgenda({ replica, hoy }: { replica: Replica; hoy: string }) {
  const pendientes = eventosDeLaAgenda(datosDeLaAgendaDeLaReplica(replica), {
    desde: hoy,
    hasta: hoy,
  }).filter((evento) => !(evento.clase === 'propia' && evento.hecha));

  return (
    <section
      aria-labelledby="titulo-hoy-en-la-agenda"
      className="rounded-panel border border-hairline px-4 pt-1.5 pb-3"
    >
      <div className="flex items-center justify-between gap-3">
        <h2 id="titulo-hoy-en-la-agenda" className="text-section font-semibold">
          Hoy en la agenda
        </h2>
        <Link
          to={RUTA_DE_AGENDA}
          className="-mr-1.5 flex min-h-tap items-center gap-1 rounded-field px-1.5 text-label font-medium text-text-2"
        >
          Ver la agenda
          <Icono nombre="chevron-right" tamano={16} />
        </Link>
      </div>
      {pendientes.length === 0 ? (
        <p className="text-label text-text-2">Nada agendado para hoy.</p>
      ) : (
        <ul className="flex flex-col">
          {pendientes.slice(0, MAXIMO).map((evento) => (
            <li key={evento.id} className="flex items-center gap-2.5 py-1">
              <MarcaConAnillo
                categoria={evento.categoria}
                importante={evento.clase === 'propia' && evento.importante}
              />
              <span className="min-w-0 flex-1 truncate text-body">{nombreDelEvento(evento)}</span>
            </li>
          ))}
        </ul>
      )}
      {pendientes.length > MAXIMO && (
        <p className="mt-1 text-meta text-text-3">y {pendientes.length - MAXIMO} más</p>
      )}
    </section>
  );
}
