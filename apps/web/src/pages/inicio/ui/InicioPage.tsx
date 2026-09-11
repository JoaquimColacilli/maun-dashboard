import { useReplica } from '@/entities/replica';
import { useSesionActiva } from '@/entities/sesion';
import { BotonSalir } from '@/features/cerrar-sesion';
import { FormularioDeMovimiento } from '@/features/registrar-movimiento';
import {
  ajustesDe,
  cantidadDe,
  filasDe,
  householdDe,
  TABLAS_REPLICADAS,
  type Replica,
} from '@/shared/api';
import { describirEstadoSync, formatearPesos, useEstadoSync } from '@/shared/lib';
import { Button } from '@/shared/ui';

const ULTIMOS = 5;

function Fecha({ valor }: { valor: string }) {
  const marca = Date.parse(valor);
  return <>{Number.isNaN(marca) ? '—' : new Date(marca).toLocaleString('es-AR')}</>;
}

function Replicado({ replica }: { replica: Replica }) {
  const ajustes = ajustesDe(replica);
  const movimientos = filasDe(replica, 'movimientos').slice(-ULTIMOS).reverse();

  return (
    <>
      <section aria-labelledby="titulo-datos" className="flex flex-col gap-3.5">
        <h2 id="titulo-datos" className="text-section font-semibold">
          Lo que hay en el dispositivo
        </h2>
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

      {ajustes && (
        <section aria-labelledby="titulo-ajustes" className="flex flex-col gap-3.5">
          <h2 id="titulo-ajustes" className="text-section font-semibold">
            Ajustes del taller
          </h2>
          <dl className="flex flex-col text-label">
            <div className="flex justify-between gap-4 border-t border-hairline-soft py-2">
              <dt className="text-text-2">Sueldo</dt>
              <dd className="tabular-nums">
                {formatearPesos(ajustes.sueldo_mensual_centavos)}
                {ajustes.sueldo_tope_mensual ? ' por mes' : ' por proyecto'}
              </dd>
            </div>
            <div className="flex justify-between gap-4 border-t border-hairline-soft py-2">
              <dt className="text-text-2">Costos fijos</dt>
              <dd className="tabular-nums">
                {formatearPesos(ajustes.costos_fijos_centavos)} por mes
              </dd>
            </div>
            <div className="flex justify-between gap-4 border-t border-hairline-soft py-2">
              <dt className="text-text-2">Meta de Cocos</dt>
              <dd className="tabular-nums">{formatearPesos(ajustes.meta_cocos_centavos)}</dd>
            </div>
          </dl>
        </section>
      )}

      <section aria-labelledby="titulo-movimiento" className="flex flex-col gap-3.5">
        <h2 id="titulo-movimiento" className="text-section font-semibold">
          Cargar un movimiento
        </h2>
        <FormularioDeMovimiento />
      </section>

      <section aria-labelledby="titulo-ultimos" className="flex flex-col gap-3.5">
        <h2 id="titulo-ultimos" className="text-section font-semibold">
          Últimos movimientos
        </h2>
        {movimientos.length === 0 ? (
          <p className="text-body text-text-2">Todavía no hay movimientos cargados.</p>
        ) : (
          <ul className="flex flex-col">
            {movimientos.map((movimiento) => (
              <li
                key={movimiento.id}
                className="flex items-baseline justify-between gap-4 border-t border-hairline-soft py-2.5"
              >
                <span className="flex flex-col">
                  <span className="text-body">{movimiento.tipo}</span>
                  <span className="text-meta text-text-2">
                    {movimiento.fecha} · {movimiento.tesoro_origen ?? 'afuera'} →{' '}
                    {movimiento.tesoro_destino ?? 'afuera'}
                  </span>
                </span>
                <span className="text-body font-semibold tabular-nums">
                  {formatearPesos(movimiento.monto_centavos)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

export function InicioPage() {
  const { email, usuarioId } = useSesionActiva();
  const replica = useReplica(usuarioId);
  const estadoSync = useEstadoSync();
  const household = replica.data ? householdDe(replica.data) : undefined;

  return (
    <main className="mx-auto flex max-w-content flex-col gap-10 px-(--page-pad-mobile) py-8 md:px-(--page-pad-tablet) lg:px-(--page-pad-desktop)">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <span className="text-meta text-text-2">{email}</span>
          <h1 className="font-display text-h1 leading-tight lg:text-h1-lg">
            {household?.nombre ?? 'Inicio'}
          </h1>
          <p className="text-meta text-text-2">{describirEstadoSync(estadoSync)}</p>
        </div>
        <div className="flex items-center gap-2.5">
          <Button
            variant="secundario"
            size="chico"
            cargando={replica.isFetching}
            onClick={() => {
              void replica.refetch();
            }}
          >
            Sincronizar
          </Button>
          <BotonSalir />
        </div>
      </header>

      <p className="rounded-panel bg-surface p-3.5 text-label leading-relaxed text-text-2">
        Pantalla técnica del tramo 2C: acá se ve lo que la app replicó del taller y se puede cargar
        un movimiento, con o sin señal. Las pantallas de negocio llegan en el tramo que sigue.
      </p>

      {replica.data && <Replicado replica={replica.data} />}
    </main>
  );
}
