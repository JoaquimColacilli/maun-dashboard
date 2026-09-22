import {
  asientosDelLibro,
  CERO,
  centavos,
  estadoDelDiezmo,
  proyeccionCocos,
  restar,
  sueldoDelMes,
  type Money,
} from '@maun/domain';
import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router';

import {
  faltaDelSueldo,
  fraseDelDiezmo,
  fraseDelSueldo,
  resumenMensual,
  type FraseDelDiezmo,
  type ResumenMensual,
} from '@/entities/movimiento';
import { novedadesDeOpiniones } from '@/entities/opinion';
import { useReplicaDelTaller } from '@/entities/replica';
import { LiquidacionesSinConfirmar } from '@/entities/proyecto';
import { useNombreDeLaPersona, useSesionActiva } from '@/entities/sesion';
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
  RUTA_DE_DIEZMO,
  rutaDeFinanzasDelTesoro,
  rutaDelProyecto,
  useAnchoDePantalla,
} from '@/shared/lib';
import {
  Avatar,
  Button,
  ConSalida,
  FilaDeAcciones,
  Icono,
  Pagina,
  type NombreDeIcono,
} from '@/shared/ui';

import { HojaDelPerfil } from './HojaDelPerfil';
import { HoyEnLaAgenda } from './HoyEnLaAgenda';
import { UltimaOpinion } from './UltimaOpinion';

const DIAS_DE_PROYECCION = 365;

function encabezado(frase: FraseDelDiezmo): string {
  return frase.despues === '' ? frase.antes : `${frase.antes} ${frase.despues}`;
}

function porcentaje(parte: Money, total: Money): number {
  return total <= 0 ? 0 : Math.round((parte / total) * 100);
}

function comparacion(valor: Money, previo: Money, mes: string): string {
  if (previo <= 0) return '';
  const variacion = Math.round(((valor - previo) / previo) * 100);
  const signo = variacion >= 0 ? '+' : '−';
  return `${signo}${String(Math.abs(variacion))}% vs. ${nombreDelMes(mesAnterior(mes)).toLowerCase()}`;
}

export interface MensajeDelMes {
  texto: string;
  alerta: boolean;
}

function mensajeDelMes(
  mes: string,
  saldoHogar: Money,
  del: ResumenMensual,
  faltaSueldo: Money,
): MensajeDelMes {
  const nombre = nombreDelMes(mes).toLowerCase();

  if (saldoHogar < 0) {
    return {
      texto: `El hogar está en negativo: ${formatearPesos(restar(CERO, saldoHogar))}. Los gastos pasaron a lo que entró.`,
      alerta: true,
    };
  }
  if (del.entroHogar === 0 && del.facturoTaller === 0) {
    return { texto: `${nombreDelMes(mes)} todavía no tiene movimiento.`, alerta: true };
  }
  if (faltaSueldo <= 0) {
    return { texto: `El sueldo de ${nombre} ya está cubierto.`, alerta: false };
  }
  if (del.entroHogar === 0) {
    return {
      texto: `El taller facturó ${formatearPesos(del.facturoTaller)} en ${nombre} y al hogar todavía no entró nada: el sueldo se transfiere cuando cobrás un trabajo.`,
      alerta: true,
    };
  }
  return {
    texto: `Faltan ${formatearPesos(faltaSueldo)} para cubrir el sueldo de ${nombre}.`,
    alerta: true,
  };
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
  frase,
  alElegir,
}: {
  tesoro: DatosDelTesoro;
  saldo: Money;
  meta: Money;
  frase?: FraseDelDiezmo;
  alElegir: () => void;
}) {
  const enNegativo = saldo < 0 && frase === undefined;

  let detalle = tesoro.descripcion;
  if (frase) detalle = frase.detalle;
  if (tesoro.id === 'cocos' && meta > 0) detalle = `${String(porcentaje(saldo, meta))}% de la meta`;
  if (enNegativo) detalle = 'gastó más de lo que entró';

  return (
    <button
      type="button"
      onClick={alElegir}
      className={`@container flex min-h-[118px] flex-col justify-between gap-3 rounded-panel p-3.5 text-left ${
        enNegativo
          ? 'border border-negativo-borde bg-negativo-bg text-negativo-texto'
          : tesoro.fondo
      }`}
    >
      <span className="flex w-full items-center justify-between gap-2">
        <span
          className={`flex items-center gap-2 text-label font-semibold ${enNegativo ? 'text-negativo-texto' : tesoro.texto}`}
        >
          <Icono nombre={enNegativo ? 'triangle-alert' : tesoro.icono} tamano={18} />
          {tesoro.nombre}
        </span>
        {enNegativo && (
          <span className="rounded-control border border-current px-1.5 text-badge font-semibold">
            en negativo
          </span>
        )}
      </span>
      <span className="flex flex-col gap-0.5">
        {frase === undefined ? (
          <span className="text-body-lg font-semibold whitespace-nowrap tabular-nums @min-[8.5rem]:text-money-lg @min-[13rem]:text-money-lg-desktop">
            {formatearPesos(saldo)}
          </span>
        ) : frase.importe === null ? (
          <span className="text-body-lg leading-tight font-semibold">{encabezado(frase)}</span>
        ) : (
          <>
            <span className="text-label leading-tight font-medium">{encabezado(frase)}</span>
            <span className="text-body-lg font-semibold whitespace-nowrap tabular-nums @min-[8.5rem]:text-money-lg @min-[13rem]:text-money-lg-desktop">
              {frase.importe}
            </span>
          </>
        )}
        <span className={`text-meta ${enNegativo ? 'text-negativo-texto/80' : 'text-text-2'}`}>
          {detalle}
        </span>
      </span>
    </button>
  );
}

function Barra({
  etiqueta,
  texto,
  detalle,
  pct,
  color,
}: {
  etiqueta: string;
  texto: string;
  detalle?: string;
  pct: number;
  color: string;
}) {
  const lleno = Math.min(100, Math.max(0, pct));
  return (
    <div>
      <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-x-3 text-label">
        <span className="font-medium">{etiqueta}</span>
        <span className="text-text-2 tabular-nums">{texto}</span>
      </div>
      <div
        role="progressbar"
        aria-label={etiqueta}
        aria-valuenow={lleno}
        aria-valuetext={detalle === undefined ? texto : `${texto}. ${detalle}`}
        aria-valuemin={0}
        aria-valuemax={100}
        className="h-1.5 overflow-hidden rounded-control bg-surface-2"
      >
        <div className={`h-full rounded-control ${color}`} style={{ width: `${String(lleno)}%` }} />
      </div>
      {detalle !== undefined && <p className="mt-1 text-meta text-text-3">{detalle}</p>}
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

function BotonDeLaCuenta({
  abierta,
  sinLeer,
  alAbrir,
}: {
  abierta: boolean;
  sinLeer: number;
  alAbrir: () => void;
}) {
  const { email, foto } = useSesionActiva();
  const nombre = useNombreDeLaPersona();
  const nuevas = sinLeer === 1 ? '1 opinión nueva' : `${String(sinLeer)} opiniones nuevas`;

  return (
    <button
      type="button"
      aria-label={sinLeer > 0 ? `Tu cuenta. ${nuevas}` : 'Tu cuenta'}
      aria-haspopup="dialog"
      aria-expanded={abierta}
      onClick={alAbrir}
      className="relative -mr-1 flex size-tap flex-none items-center justify-center rounded-pill"
    >
      <Avatar
        nombre={nombre.trim() === '' ? email : nombre}
        foto={foto}
        className={abierta ? 'ring-2 ring-ink' : ''}
      />
      {sinLeer > 0 && (
        <span
          aria-hidden
          className="absolute top-1 right-1 size-2.5 rounded-pill border-2 border-paper bg-op-mal"
        />
      )}
    </button>
  );
}

function AccesoALaAgenda() {
  return (
    <Link
      to="/agenda"
      aria-label="Agenda"
      className="flex size-tap flex-none items-center justify-center rounded-pill text-ink hover:bg-surface"
    >
      <Icono nombre="calendar-days" tamano={22} />
    </Link>
  );
}

export function InicioPage() {
  const replica = useReplicaDelTaller();
  const navegar = useNavigate();
  const ancho = useAnchoDePantalla();
  const sesion = useSesionActiva();
  const nombreDeLaPersona = useNombreDeLaPersona();
  const [perfil, setPerfil] = useState(false);

  const hoy = hoyLocal();
  const novedades = useMemo(() => novedadesDeOpiniones(replica, hoy), [replica, hoy]);
  const mes = mesDeLaFecha(hoy);
  const ajustes = ajustesDe(replica);
  const saldos = saldosDeLaReplica(replica);

  const asientos = asientosDelLibro(datosDelLibro(replica));
  const del = resumenMensual(asientos, mes);
  const delPrevio = resumenMensual(asientos, mesAnterior(mes));
  const diezmo = estadoDelDiezmo(asientos);
  const frase = fraseDelDiezmo(diezmo);

  const liquidaciones = liquidacionesDeLaReplica(replica);
  const objetivos = objetivosDeLaReplica(replica);
  const sueldo = sueldoDelMes(liquidaciones, mes, objetivos, mes);
  const fraseSueldo = fraseDelSueldo(sueldo);
  const metaCocos = centavos(ajustes?.meta_cocos_centavos ?? 0);
  const mensaje = mensajeDelMes(mes, saldos.hogar, del, faltaDelSueldo(sueldo));

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
    { etiqueta: 'Entró al hogar', valor: del.entroHogar, previo: delPrevio.entroHogar },
    { etiqueta: 'Gastó el hogar', valor: del.gastoHogar, previo: delPrevio.gastoHogar },
    { etiqueta: 'Facturó el taller', valor: del.facturoTaller, previo: delPrevio.facturoTaller },
  ];

  return (
    <Pagina className="gap-4">
      <header className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="text-label text-text-2">{fechaLarga(hoy, hoy)}</span>
          <h1 className="font-display text-h1 leading-tight lg:text-h1-lg">Inicio</h1>
        </div>
        {ancho === 'movil' && (
          <div className="flex flex-none items-center gap-1">
            <AccesoALaAgenda />
            <BotonDeLaCuenta
              abierta={perfil}
              sinLeer={novedades.sinLeer}
              alAbrir={() => {
                setPerfil(true);
              }}
            />
          </div>
        )}
      </header>

      <section aria-label="Tesoros" className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        {TESOROS_EN_ORDEN.map((id) => (
          <Tarjeta
            key={id}
            tesoro={TESORO[id]}
            saldo={saldos[id]}
            meta={metaCocos}
            frase={id === 'diezmo' ? frase : undefined}
            alElegir={irA(id === 'diezmo' ? RUTA_DE_DIEZMO : rutaDeFinanzasDelTesoro(id))}
          />
        ))}
      </section>

      {novedades.ultima !== null && <UltimaOpinion ultima={novedades.ultima} />}

      {ancho === 'movil' && <HoyEnLaAgenda replica={replica} hoy={hoy} />}

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
          <FilaDeAcciones className="mt-1.5">
            <Button onClick={irA('/ajustes')}>Configurar sueldo y metas</Button>
            <Button variant="secundario" onClick={irA('/proyectos')}>
              Cargar el primer proyecto
            </Button>
          </FilaDeAcciones>
        </section>
      ) : (
        <div className="grid gap-0 xl:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] xl:gap-x-10">
          <div className="min-w-0">
            <p className="my-4 flex items-start gap-2.5 border-y border-hairline py-3.5 text-body-lg leading-normal">
              <span
                aria-hidden
                className={`mt-2 size-2 flex-none rounded-pill ${
                  mensaje.alerta ? 'bg-atencion' : 'bg-hogar'
                }`}
              />
              <span>{mensaje.texto}</span>
            </p>

            <section
              aria-label={nombreDelMes(mes)}
              className="@container rounded-panel bg-surface px-4 py-3.5"
            >
              <div className="mb-2.5 flex items-baseline justify-between">
                <span className="text-label font-semibold">{nombreDelMes(mes)}</span>
                <span className="text-meta text-text-2">
                  día {diaDelMes(hoy)} de {diasDelMes(mes)}
                </span>
              </div>
              <dl className="grid grid-cols-1 gap-2 @min-[19rem]:grid-cols-3 @min-[19rem]:gap-3">
                {estadisticas.map((estadistica) => {
                  const vs = comparacion(estadistica.valor, estadistica.previo, mes);
                  return (
                    <div
                      key={estadistica.etiqueta}
                      className="flex min-w-0 items-baseline justify-between gap-3 @min-[19rem]:block"
                    >
                      <dt className="text-meta leading-tight text-text-2">
                        {estadistica.etiqueta}
                      </dt>
                      <dd className="text-right @min-[19rem]:mt-0.5 @min-[19rem]:text-left">
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
                texto={fraseSueldo.texto}
                detalle={fraseSueldo.detalle}
                pct={porcentaje(sueldo.pagado, sueldo.esperado)}
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
                texto={`${formatearPesos(diezmo.pagado)} de ${formatearPesos(diezmo.generado)}`}
                pct={porcentaje(diezmo.pagado, diezmo.generado)}
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
                alElegir={irA(
                  proximaEntrega === undefined ? '/proyectos' : rutaDelProyecto(proximaEntrega.id),
                )}
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
                titulo={encabezado(frase)}
                valor={frase.importe ?? ''}
                tono="text-diezmo"
                fondo="bg-diezmo-tint"
                alElegir={irA(RUTA_DE_DIEZMO)}
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

      <ConSalida valor={perfil}>
        {() => (
          <HojaDelPerfil
            replica={replica}
            hoy={hoy}
            nombre={nombreDeLaPersona.trim()}
            email={sesion.email}
            foto={sesion.foto}
            novedades={novedades}
            alCerrar={() => {
              setPerfil(false);
            }}
          />
        )}
      </ConSalida>
    </Pagina>
  );
}
