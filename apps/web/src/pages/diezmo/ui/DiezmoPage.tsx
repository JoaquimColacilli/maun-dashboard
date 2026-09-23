import { asientosDelLibro, estadoDelDiezmo } from '@maun/domain';
import { useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';

import {
  agruparPorDia,
  FichaDelMovimiento,
  fraseDelDiezmo,
  lineasDelTaller,
  ListaDelLibro,
  useMovimientosEnVuelo,
  type LineaDelTaller,
} from '@/entities/movimiento';
import { useLiquidacionesEnVuelo } from '@/entities/proyecto';
import { useReplicaDelTaller } from '@/entities/replica';
import { datosDelLibro } from '@/shared/api';
import {
  conFondo,
  formatearPesos,
  hoyLocal,
  rutaDeMovimientoNuevo,
  rutaDelMovimiento,
} from '@/shared/lib';
import { ConSalida, Icono, MontoQueEntra, Pagina, PrincipalYApoyo } from '@/shared/ui';

const RUTA_DEL_PAGO = rutaDeMovimientoNuevo({ clase: 'pago_diezmo' });

export function DiezmoPage() {
  const replica = useReplicaDelTaller();
  const navegar = useNavigate();
  const location = useLocation();
  const hoy = hoyLocal();
  const [ficha, setFicha] = useState<LineaDelTaller | null>(null);

  const enVuelo = useMovimientosEnVuelo();
  const liquidaciones = useLiquidacionesEnVuelo();

  const asientos = useMemo(() => asientosDelLibro(datosDelLibro(replica)), [replica]);
  const estado = estadoDelDiezmo(asientos);
  const frase = fraseDelDiezmo(estado);

  const lineas = useMemo(
    () =>
      lineasDelTaller(replica).filter(
        (linea) => linea.desde === 'diezmo' || linea.hacia === 'diezmo',
      ),
    [replica],
  );
  const dias = agruparPorDia(lineas, 'diezmo');
  const pagadoPct =
    estado.generado <= 0 ? 100 : Math.min(100, Math.round((estado.pagado / estado.generado) * 100));

  return (
    <Pagina ancho="ficha" className="gap-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="font-display text-h1 leading-tight lg:text-h1-lg">Diezmo</h1>
        <Link
          to={RUTA_DEL_PAGO}
          state={conFondo(location)}
          className="flex h-button items-center gap-2 rounded-field bg-diezmo px-[18px] text-body font-medium text-paper"
        >
          <Icono nombre="hand-coins" tamano={18} />
          Registrar diezmo
        </Link>
      </header>

      <PrincipalYApoyo
        apoyoPrimero
        apoyo={
          <div className="flex min-w-0 flex-col gap-5">
            <section
              aria-label="Estado del diezmo"
              className="@container flex flex-col gap-1 rounded-panel bg-diezmo-tint px-5 py-5"
            >
              <span className="flex items-center gap-2 text-label font-semibold text-diezmo">
                <Icono nombre="church" tamano={16} />
                Diezmo
              </span>
              {frase.importe === null ? (
                <span className="text-h1 leading-tight font-semibold lg:text-h1-lg">
                  {frase.antes}
                </span>
              ) : (
                <span className="flex flex-wrap items-baseline gap-x-2">
                  <span className="text-body-lg font-semibold">{frase.antes}</span>
                  <MontoQueEntra tamano="destacado" className="leading-tight font-semibold">
                    {frase.importe}
                  </MontoQueEntra>
                  {frase.despues !== '' && (
                    <span className="text-body-lg font-semibold">{frase.despues}</span>
                  )}
                </span>
              )}
              <span className="mt-1 text-label leading-relaxed text-text-2">{frase.detalle}</span>
            </section>

            <section aria-label="Generado y pagado" className="@container flex flex-col gap-2.5">
              <div className="grid grid-cols-1 gap-3 tabular-nums @min-[22.5rem]:grid-cols-2">
                <div>
                  <span className="block text-meta text-text-2">Generado en total</span>
                  <span className="block text-money-lg font-semibold">
                    {formatearPesos(estado.generado)}
                  </span>
                </div>
                <div className="@min-[22.5rem]:text-right">
                  <span className="block text-meta text-text-2">Pagado en total</span>
                  <span className="block text-money-lg font-semibold text-diezmo">
                    {formatearPesos(estado.pagado)}
                  </span>
                </div>
              </div>
              <div
                role="progressbar"
                aria-label="Pagado sobre lo generado"
                aria-valuenow={pagadoPct}
                aria-valuemin={0}
                aria-valuemax={100}
                className="h-2 overflow-hidden rounded-control bg-surface-2"
              >
                <div
                  className="h-full rounded-control bg-diezmo"
                  style={{ width: `${String(pagadoPct)}%` }}
                />
              </div>
              <span className="text-meta text-text-2">
                {String(pagadoPct)}% de lo generado ya está pagado
              </span>
            </section>
          </div>
        }
      >
        <section aria-labelledby="titulo-historial" className="flex min-w-0 flex-col gap-1">
          <h2 id="titulo-historial" className="text-section font-semibold">
            Lo generado y lo pagado
          </h2>
          {dias.length === 0 ? (
            <p className="py-6 text-body leading-relaxed text-text-2">
              Todavía no se generó diezmo. El 10% de cada ganancia se anota acá solo, cuando cobrás
              un trabajo. Después lo vas cancelando con pagos.
            </p>
          ) : (
            <ListaDelLibro
              dias={dias}
              tesoro="diezmo"
              hoy={hoy}
              sinConfirmar={(linea) =>
                linea.origen === 'manual'
                  ? enVuelo.has(linea.asientoId)
                  : liquidaciones.some((liquidacion) => liquidacion.proyectoId === linea.proyectoId)
              }
              alAbrir={(linea) => {
                if (linea.bloqueo === null) {
                  void navegar(rutaDelMovimiento(linea.asientoId), {
                    state: conFondo(location),
                  });
                  return;
                }
                setFicha(linea);
              }}
            />
          )}
        </section>
      </PrincipalYApoyo>

      <ConSalida valor={ficha}>
        {(linea) => (
          <FichaDelMovimiento
            linea={linea}
            hoy={hoy}
            alCerrar={() => {
              setFicha(null);
            }}
          />
        )}
      </ConSalida>
    </Pagina>
  );
}
