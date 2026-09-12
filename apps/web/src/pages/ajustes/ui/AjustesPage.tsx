import { useMutationState } from '@tanstack/react-query';
import { Link } from 'react-router';

import { useReplicaDelTaller } from '@/entities/replica';
import { AjusteDeCocos } from '@/features/ajustar-cocos';
import { BotonSalir } from '@/features/cerrar-sesion';
import { FormularioDeConfiguracion } from '@/features/configurar-taller';
import { useSesionActiva } from '@/entities/sesion';
import {
  ajustesDe,
  cantidadDe,
  householdDe,
  mensajeDeSincronizacion,
  saldosDeLaReplica,
  TABLAS_REPLICADAS,
} from '@/shared/api';
import { describirEstadoSync, useAvisos, useEstadoSync } from '@/shared/lib';
import { Pagina, PanelDeAvisos } from '@/shared/ui';

const SECCION =
  'flex min-w-0 max-w-[560px] flex-col gap-3.5 border-t border-hairline pt-5 xl:max-w-none';

function Fecha({ valor }: { valor: string }) {
  const marca = Date.parse(valor);
  return <>{Number.isNaN(marca) ? '—' : new Date(marca).toLocaleString('es-AR')}</>;
}

function RechazosDeLaCola() {
  const rechazos = useMutationState({
    filters: { status: 'error' },
    select: (mutacion) => ({ id: mutacion.mutationId, error: mutacion.state.error }),
  });

  if (rechazos.length === 0) return null;

  return (
    <ul className="flex flex-col">
      {rechazos.map((rechazo) => (
        <li
          key={rechazo.id}
          className="border-t border-hairline-soft py-2.5 text-body leading-relaxed text-alerta"
        >
          {mensajeDeSincronizacion(rechazo.error)}
        </li>
      ))}
    </ul>
  );
}

function Avisos() {
  const avisos = useAvisos();
  const rechazos = useMutationState({ filters: { status: 'error' }, select: () => true });

  if (avisos.length === 0 && rechazos.length === 0) {
    return <p className="text-body text-text-2">No hay nada rechazado ni ajustado.</p>;
  }

  return (
    <>
      <PanelDeAvisos avisos={avisos}>
        {(aviso) =>
          aviso.ruta === null ? null : (
            <Link
              to={aviso.ruta}
              className="mt-1 inline-block text-label font-semibold underline underline-offset-3"
            >
              Ver «{aviso.sujeto}»
            </Link>
          )
        }
      </PanelDeAvisos>
      <RechazosDeLaCola />
    </>
  );
}

export function AjustesPage() {
  const replica = useReplicaDelTaller();
  const { email } = useSesionActiva();
  const estadoSync = useEstadoSync();
  const household = householdDe(replica);
  const ajustes = ajustesDe(replica);

  return (
    <Pagina className="gap-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="font-display text-h1 leading-tight lg:text-h1-lg">Ajustes</h1>
      </header>

      <div className="grid items-start gap-x-10 gap-y-8 xl:grid-cols-2">
        {household && ajustes && (
          <section aria-labelledby="titulo-reparto" className={SECCION}>
            <h2 id="titulo-reparto" className="text-section font-semibold">
              Reparto y metas
            </h2>
            <FormularioDeConfiguracion household={household} ajustes={ajustes} />
          </section>
        )}

        <div className="flex min-w-0 flex-col gap-8">
          <section aria-labelledby="titulo-cocos" className={SECCION}>
            <h2 id="titulo-cocos" className="text-section font-semibold">
              Corregir el saldo de Cocos
            </h2>
            <AjusteDeCocos saldo={saldosDeLaReplica(replica).cocos} />
          </section>

          <section aria-labelledby="titulo-rechazos" className={SECCION}>
            <h2 id="titulo-rechazos" className="text-section font-semibold">
              Lo que la base rechazó o ajustó
            </h2>
            <p className="text-label leading-relaxed text-text-2">
              Queda acá hasta que lo descartes, aunque cierres la app.
            </p>
            <Avisos />
          </section>
        </div>

        <section aria-labelledby="titulo-dispositivo" className={SECCION}>
          <h2 id="titulo-dispositivo" className="text-section font-semibold">
            Este dispositivo
          </h2>
          <p className="text-body text-text-2">{describirEstadoSync(estadoSync)}</p>
          <ul className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
            {TABLAS_REPLICADAS.map((tabla) => (
              <li key={tabla} className="flex flex-col gap-1 rounded-panel bg-surface p-3.5">
                <span className="text-meta text-text-2">{tabla}</span>
                <span className="text-money-lg font-semibold tabular-nums">
                  {cantidadDe(replica, tabla)}
                </span>
              </li>
            ))}
          </ul>
          <dl className="flex flex-col text-label">
            <div className="flex justify-between gap-4 border-t border-hairline-soft py-2">
              <dt className="text-text-2">Último delta</dt>
              <dd className="tabular-nums">
                <Fecha valor={replica.cursor} />
              </dd>
            </div>
            <div className="flex justify-between gap-4 border-t border-hairline-soft py-2">
              <dt className="text-text-2">Última copia completa</dt>
              <dd className="tabular-nums">
                <Fecha valor={replica.reconciliadoEn} />
              </dd>
            </div>
          </dl>
        </section>

        <section aria-labelledby="titulo-cuenta" className={`${SECCION} items-start`}>
          <h2 id="titulo-cuenta" className="text-section font-semibold">
            Cuenta
          </h2>
          <p className="text-body text-text-2">{email}</p>
          <BotonSalir />
        </section>
      </div>
    </Pagina>
  );
}
