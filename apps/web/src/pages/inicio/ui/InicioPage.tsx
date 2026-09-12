import {
  asientosDelLibro,
  asientosDelMes,
  centavos,
  entradasYSalidas,
  proyeccionCocos,
  resumenDelMes,
  sumarTodos,
  type Asiento,
  type Money,
} from '@maun/domain';
import { useNavigate } from 'react-router';

import { useReplicaDelTaller } from '@/entities/replica';
import { LiquidacionesSinConfirmar } from '@/entities/proyecto';
import { TESORO, TESOROS_EN_ORDEN, type DatosDelTesoro } from '@/entities/tesoro';
import {
  ajustesDe,
  datosDelLibro,
  faltaConfigurar,
  filasDe,
  liquidacionesDeLaReplica,
  objetivosDeLaReplica,
  saldosDeLaReplica,
  type FilaDe,
  type Replica,
} from '@/shared/api';
import {
  diaDelMes,
  diasDelMes,
  fechaLarga,
  formatearPesos,
  hoyLocal,
  mesAnterior,
  mesDeLaFecha,
  nombreDelMes,
  relativa,
} from '@/shared/lib';
import { Button, Icono, type NombreDeIcono } from '@/shared/ui';

const DIAS_DE_PROYECCION = 365;

function porcentaje(parte: Money, total: Money): number {
  return total <= 0 ? 0 : Math.round((parte / total) * 100);
}

// Sin mes previo contra el cual comparar no hay comparación: un "+100%" contra cero no dice nada.
function comparacion(valor: Money, previo: Money, mes: string): string {
  if (previo <= 0) return '';
  const variacion = Math.round(((valor - previo) / previo) * 100);
  const signo = variacion >= 0 ? '+' : '−';
  return `${signo}${String(Math.abs(variacion))}% vs. ${nombreDelMes(mesAnterior(mes)).toLowerCase()}`;
}

function facturado(asientos: readonly Asiento[]): Money {
  return sumarTodos(
    asientos.filter((asiento) => asiento.origen === 'pago').map((asiento) => asiento.monto),
  );
}

function saldoPendiente(replica: Replica, pendientes: readonly FilaDe<'proyectos'>[]): Money {
  const pagos = filasDe(replica, 'pagos');
  let total = 0;
  for (const proyecto of pendientes) {
    const cobrado = pagos
      .filter((pago) => pago.proyecto_id === proyecto.id)
      .reduce((suma, pago) => suma + pago.monto_centavos, 0);
    const falta = (proyecto.presupuesto_centavos ?? 0) - cobrado;
    if (falta > 0) total += falta;
  }
  return centavos(total);
}

function Tarjeta({
  tesoro,
  saldo,
  meta,
  alElegir,
}: {
  tesoro: DatosDelTesoro;
  saldo: Money;
  meta: Money;
  alElegir: () => void;
}) {
  const enNegativo = tesoro.id !== 'diezmo' && saldo < 0;
  const importe = tesoro.id === 'diezmo' ? Math.abs(saldo) : saldo;

  let detalle = tesoro.descripcion;
  if (tesoro.id === 'diezmo') detalle = saldo < 0 ? 'en deuda' : 'a favor';
  if (tesoro.id === 'cocos' && meta > 0) detalle = `${String(porcentaje(saldo, meta))}% de la meta`;
  if (enNegativo) detalle = 'gastó más de lo que entró';

  return (
    <button
      type="button"
      onClick={alElegir}
      className={`flex min-h-[118px] flex-col justify-between gap-3 rounded-panel p-3.5 text-left ${
        enNegativo ? 'bg-ink text-paper' : tesoro.fondo
      }`}
    >
      <span className="flex w-full items-center justify-between gap-2">
        <span
          className={`flex items-center gap-2 text-label font-semibold ${enNegativo ? 'text-paper' : tesoro.texto}`}
        >
          <Icono nombre={tesoro.icono} tamano={18} />
          {tesoro.nombre}
        </span>
        {enNegativo && (
          <span className="rounded-control border border-paper px-1.5 text-badge font-semibold">
            en negativo
          </span>
        )}
      </span>
      <span className="flex flex-col gap-0.5">
        <span className="text-money-lg font-semibold whitespace-nowrap tabular-nums lg:text-money-lg-desktop">
          {formatearPesos(importe)}
        </span>
        <span className={`text-meta ${enNegativo ? 'text-paper/70' : 'text-text-2'}`}>
          {detalle}
        </span>
      </span>
    </button>
  );
}

function Barra({
  etiqueta,
  texto,
  pct,
  color,
}: {
  etiqueta: string;
  texto: string;
  pct: number;
  color: string;
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between text-label">
        <span className="font-medium">{etiqueta}</span>
        <span className="text-text-2 tabular-nums">{texto}</span>
      </div>
      <div
        role="progressbar"
        aria-label={etiqueta}
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        className="h-1.5 overflow-hidden rounded-control bg-surface-2"
      >
        <div
          className={`h-full rounded-control ${color}`}
          style={{ width: `${String(Math.min(100, pct))}%` }}
        />
      </div>
    </div>
  );
}

function Acceso({
  icono,
  etiqueta,
  titulo,
  valor,
  tono,
  fondo,
  alElegir,
}: {
  icono: NombreDeIcono;
  etiqueta: string;
  titulo: string;
  valor: string;
  tono?: string;
  fondo?: string;
  alElegir: () => void;
}) {
  return (
    <button
      type="button"
      onClick={alElegir}
      className="flex w-full items-center gap-3 border-b border-hairline py-3.5 text-left"
    >
      <span
        className={`flex size-9 flex-none items-center justify-center rounded-field ${fondo ?? 'bg-surface'} ${tono ?? ''}`}
      >
        <Icono nombre={icono} tamano={18} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-meta text-text-2">{etiqueta}</span>
        <span className="block truncate text-body font-medium">{titulo}</span>
      </span>
      <span className={`flex-none text-body font-semibold tabular-nums ${tono ?? ''}`}>
        {valor}
      </span>
    </button>
  );
}

export function InicioPage() {
  const replica = useReplicaDelTaller();
  const navegar = useNavigate();

  const hoy = hoyLocal();
  const mes = mesDeLaFecha(hoy);
  const ajustes = ajustesDe(replica);
  const saldos = saldosDeLaReplica(replica);

  const asientos = asientosDelLibro(datosDelLibro(replica));
  const delMes = asientosDelMes(asientos, mes);
  const delMesPrevio = asientosDelMes(asientos, mesAnterior(mes));
  const hogar = entradasYSalidas(delMes, 'hogar');
  const hogarPrevio = entradasYSalidas(delMesPrevio, 'hogar');
  const diezmo = entradasYSalidas(asientos, 'diezmo');

  const resumen = resumenDelMes(
    liquidacionesDeLaReplica(replica),
    mes,
    objetivosDeLaReplica(replica),
    mes,
  );
  const metaCocos = centavos(ajustes?.meta_cocos_centavos ?? 0);

  const proyectos = filasDe(replica, 'proyectos');
  const pendientes = proyectos.filter(
    (proyecto) => proyecto.estado === 'en_curso' || proyecto.estado === 'entregado',
  );
  const proximaEntrega = proyectos
    .filter((proyecto) => proyecto.estado === 'en_curso' && proyecto.entrega_estimada !== null)
    .sort((a, b) => (a.entrega_estimada ?? '').localeCompare(b.entrega_estimada ?? ''))[0];

  const irA = (ruta: string) => () => {
    void navegar(ruta);
  };

  const estadisticas = [
    { etiqueta: 'Entró al hogar', valor: hogar.entro, previo: hogarPrevio.entro },
    { etiqueta: 'Gastó el hogar', valor: hogar.salio, previo: hogarPrevio.salio },
    { etiqueta: 'Facturó el taller', valor: facturado(delMes), previo: facturado(delMesPrevio) },
  ];

  return (
    <div className="mx-auto flex max-w-content flex-col gap-4 px-(--page-pad-mobile) py-3 md:px-(--page-pad-tablet) md:py-6 lg:px-(--page-pad-desktop) lg:py-7">
      <header className="flex flex-col gap-0.5">
        <span className="text-label text-text-2">{fechaLarga(hoy, hoy)}</span>
        <h1 className="font-display text-h1 leading-tight lg:text-h1-lg">Inicio</h1>
      </header>

      <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        {TESOROS_EN_ORDEN.map((id) => (
          <Tarjeta
            key={id}
            tesoro={TESORO[id]}
            saldo={saldos[id]}
            meta={metaCocos}
            alElegir={irA(id === 'diezmo' ? '/diezmo' : '/finanzas')}
          />
        ))}
      </div>

      <LiquidacionesSinConfirmar replica={replica} />

      {faltaConfigurar(ajustes) ? (
        <section
          aria-labelledby="titulo-arranque"
          className="flex max-w-[520px] flex-col gap-3 pt-4"
        >
          <h2 id="titulo-arranque" className="text-h1 leading-tight font-semibold">
            El taller arranca acá
          </h2>
          <p className="text-body leading-relaxed text-text-2">
            Cargá el sueldo que te asignás y tus costos fijos para que Inicio te cuente cuánto te
            falta cada mes. Después, el primer proyecto.
          </p>
          <div className="mt-1.5 flex flex-wrap gap-2.5">
            <Button onClick={irA('/ajustes')}>Configurar sueldo y metas</Button>
            <Button variant="secundario" onClick={irA('/proyectos')}>
              Cargar el primer proyecto
            </Button>
          </div>
        </section>
      ) : (
        <div className="grid gap-0 xl:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] xl:gap-x-10">
          <div className="min-w-0">
            <p className="my-4 flex items-start gap-2.5 border-y border-hairline py-3.5 text-body-lg leading-normal">
              <span
                aria-hidden
                className={`mt-2 size-2 flex-none rounded-pill ${
                  resumen.sueldo.falta > 0 ? 'bg-atencion' : 'bg-hogar'
                }`}
              />
              <span>
                {resumen.sueldo.falta > 0
                  ? `Faltan ${formatearPesos(resumen.sueldo.falta)} para cubrir el sueldo de ${nombreDelMes(mes).toLowerCase()}.`
                  : `El sueldo de ${nombreDelMes(mes).toLowerCase()} ya está cubierto.`}
              </span>
            </p>

            <section
              aria-label={nombreDelMes(mes)}
              className="rounded-panel bg-surface px-4 py-3.5"
            >
              <div className="mb-2.5 flex items-baseline justify-between">
                <span className="text-label font-semibold">{nombreDelMes(mes)}</span>
                <span className="text-meta text-text-2">
                  día {diaDelMes(hoy)} de {diasDelMes(mes)}
                </span>
              </div>
              <dl className="grid grid-cols-3 gap-3">
                {estadisticas.map((estadistica) => {
                  const vs = comparacion(estadistica.valor, estadistica.previo, mes);
                  return (
                    <div key={estadistica.etiqueta} className="min-w-0">
                      <dt className="text-meta leading-tight text-text-2">
                        {estadistica.etiqueta}
                      </dt>
                      <dd className="mt-0.5">
                        <span className="block text-body-lg font-semibold whitespace-nowrap tabular-nums lg:text-money-lg">
                          {formatearPesos(estadistica.valor)}
                        </span>
                        {vs !== '' && (
                          <span className="mt-0.5 block text-badge text-text-3">{vs}</span>
                        )}
                      </dd>
                    </div>
                  );
                })}
              </dl>
            </section>

            <section aria-label="Progreso" className="mt-5 flex flex-col gap-4">
              <Barra
                etiqueta="Sueldo del mes"
                texto={`${formatearPesos(resumen.sueldo.liquidado)} de ${formatearPesos(resumen.sueldo.objetivo)}`}
                pct={porcentaje(resumen.sueldo.liquidado, resumen.sueldo.objetivo)}
                color={TESORO.hogar.barra}
              />
              <Barra
                etiqueta="Meta de Cocos"
                texto={`${formatearPesos(saldos.cocos)} de ${formatearPesos(metaCocos)}`}
                pct={porcentaje(saldos.cocos, metaCocos)}
                color={TESORO.cocos.barra}
              />
              <Barra
                etiqueta="Diezmo pagado"
                texto={`${formatearPesos(diezmo.salio)} de ${formatearPesos(diezmo.entro)}`}
                pct={porcentaje(diezmo.salio, diezmo.entro)}
                color={TESORO.diezmo.barra}
              />
            </section>
          </div>

          <div className="min-w-0">
            <section aria-label="Accesos" className="mt-5 border-t border-hairline">
              <Acceso
                icono="truck"
                etiqueta="Entrega más próxima"
                titulo={proximaEntrega?.titulo ?? 'Sin entregas programadas'}
                valor={
                  proximaEntrega?.entrega_estimada
                    ? relativa(proximaEntrega.entrega_estimada, hoy)
                    : ''
                }
                alElegir={irA('/proyectos')}
              />
              <Acceso
                icono="hand-coins"
                etiqueta="Pendiente de cobro"
                titulo={`${String(pendientes.length)} proyectos en curso`}
                valor={formatearPesos(saldoPendiente(replica, pendientes))}
                alElegir={irA('/proyectos')}
              />
              <Acceso
                icono="church"
                etiqueta="Diezmo"
                titulo={saldos.diezmo < 0 ? 'en deuda' : 'a favor'}
                valor={formatearPesos(Math.abs(saldos.diezmo))}
                tono="text-diezmo"
                fondo="bg-diezmo-tint"
                alElegir={irA('/diezmo')}
              />
            </section>

            <section
              aria-label="Proyección de Cocos"
              className="mt-4.5 flex items-center gap-3.5 rounded-panel border border-hairline px-4 py-3.5"
            >
              <div className="min-w-0 flex-1">
                <div className="text-label text-text-2">Cocos en un año</div>
                <div className="mt-0.5 text-money-lg font-semibold text-cocos tabular-nums">
                  {formatearPesos(
                    proyeccionCocos(
                      saldos.cocos,
                      ajustes?.tasa_cocos_anual_bp ?? 0,
                      DIAS_DE_PROYECCION,
                    ),
                  )}
                </div>
                <div className="mt-0.5 text-meta text-text-3">
                  con la tasa que cargaste, sin aportes nuevos
                </div>
              </div>
              <div className="flex-none text-right">
                <div className="text-meta text-text-2">falta para la meta</div>
                <div className="text-body font-semibold tabular-nums">
                  {formatearPesos(Math.max(0, metaCocos - saldos.cocos))}
                </div>
              </div>
            </section>
          </div>
        </div>
      )}
    </div>
  );
}
