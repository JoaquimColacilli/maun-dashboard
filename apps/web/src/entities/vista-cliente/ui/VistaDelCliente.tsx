import {
  estaAprobada,
  notaDelRelevamiento,
  textoDeLaProyeccion,
  type ArchivoDelCliente,
  type ProyeccionDeLaEntrega,
  type SenaDeLaVista,
  type VistaAntesDelPresupuesto,
  type VistaAprobada,
  type VistaDelCliente as Vista,
  type VistaEsperandoLaSena,
} from '@maun/domain';
import { useState } from 'react';

import { urlDelArchivo } from '@/shared/api';
import { diaYMesCorto, fechaEnUnaFrase, fechaLarga, formatearPesos } from '@/shared/lib';
import {
  Icono,
  MontoQueEntra,
  Pagina,
  PrincipalYApoyo,
  TarjetaConLamina,
  TrabajoEnEtapa,
} from '@/shared/ui';

import { etapaDelDibujo } from '../model/etapa';
import type { CoordinacionConPedido, MandarLaEntrega } from '../model/mandar';
import {
  A_CONFIRMAR,
  A_CUENTA_DE_LA_SENA,
  bajadaDeLaEntrega,
  claveDeLaEntrega,
  lineaDeLaSena,
  pieDeLosPagos,
  QUEDA_A_CUENTA,
  saldoDeLaVista,
  sinPagosTodavia,
  textoDeLaSenaAcordada,
  textoDelTitular,
  textoDelTotalPagado,
  valorDeLaEntrega,
} from '../model/textos';
import { CaminoDeHitos } from './CaminoDeHitos';
import { ComoPagar } from './ComoPagar';
import { CoordinarLaEntrega } from './CoordinarLaEntrega';

export interface VistaDelClienteProps {
  vista: Vista;
  hoy: string;
  alMandar?: MandarLaEntrega;
}

const TIPO: Readonly<Record<string, string>> = {
  'image/webp': 'Imagen',
  'image/jpeg': 'Imagen',
  'application/pdf': 'PDF',
};

const TARJETA = 'rounded-panel border border-hairline bg-paper px-4 py-4 md:px-5';

function coordinacionConPedido(vista: Vista): CoordinacionConPedido | null {
  if (!estaAprobada(vista) || vista.coordinacion === null) return null;
  return vista.coordinacion.situacion === 'sin-pedido' ? null : vista.coordinacion;
}

function esImagen(archivo: ArchivoDelCliente): boolean {
  return archivo.tipo === 'image/webp' || archivo.tipo === 'image/jpeg';
}

function Cifra({
  clave,
  valor,
  grande = false,
  tono = '',
}: {
  clave: string;
  valor: string;
  grande?: boolean;
  tono?: string;
}) {
  return (
    <span className="flex flex-col gap-px">
      <span className="text-label text-text-2">{clave}</span>
      <span
        className={`font-semibold tabular-nums ${grande ? 'text-money-lg' : 'text-body-lg'} ${tono}`}
      >
        {valor}
      </span>
    </span>
  );
}

function Dato({
  clave,
  valor,
  fuerte = false,
}: {
  clave: string;
  valor: string;
  fuerte?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3.5 border-t border-hairline-soft py-2.5 first:border-t-0">
      <dt className="flex-none text-label text-text-2">{clave}</dt>
      <dd
        className={`text-right text-body leading-normal ${fuerte ? 'font-semibold' : 'font-medium'}`}
      >
        {valor}
      </dd>
    </div>
  );
}

function Titular({ texto, bajada }: { texto: string; bajada: string }) {
  return (
    <div className="mt-3 flex flex-col gap-1">
      <span className="text-money-xl leading-tight font-semibold text-pretty">{texto}</span>
      {bajada !== '' && <span className="text-body text-text-2">{bajada}</span>}
    </div>
  );
}

function CifrasDeLaSena({ sena }: { sena: SenaDeLaVista }) {
  switch (sena.situacion) {
    case 'sin-presupuesto':
      return null;
    case 'falta':
    case 'cubierta':
      return <Cifra clave="Seña para arrancar" valor={formatearPesos(sena.sena)} />;
  }
}

function EntradaAntesDelPresupuesto({
  vista,
  titular,
  bajada,
}: {
  vista: VistaAntesDelPresupuesto;
  titular: string;
  bajada: string;
}) {
  return (
    <>
      <Titular texto={titular} bajada={bajada} />
      {vista.pagado > 0 && (
        <>
          <div className="mt-4 flex flex-wrap items-baseline gap-x-6 gap-y-2 self-stretch border-t border-hairline-soft pt-3.5">
            <Cifra clave="Pagaste" valor={formatearPesos(vista.pagado)} />
          </div>
          <p className="mt-2.5 text-body leading-relaxed text-text-2">{QUEDA_A_CUENTA}</p>
        </>
      )}
    </>
  );
}

function EntradaEsperandoLaSena({
  vista,
  titular,
  bajada,
}: {
  vista: VistaEsperandoLaSena;
  titular: string;
  bajada: string;
}) {
  const linea = lineaDeLaSena(vista.sena, vista.pagado);
  return (
    <>
      <Titular texto={titular} bajada={bajada} />
      <div className="mt-4 flex flex-wrap items-baseline gap-x-6 gap-y-2 self-stretch border-t border-hairline-soft pt-3.5">
        <Cifra
          clave="Presupuesto"
          valor={vista.presupuesto === null ? '—' : formatearPesos(vista.presupuesto)}
          grande
        />
        <CifrasDeLaSena sena={vista.sena} />
        <Cifra clave="Pagaste" valor={formatearPesos(vista.pagado)} />
      </div>
      {linea !== '' && <p className="mt-2.5 text-body leading-relaxed text-text-2">{linea}</p>}
    </>
  );
}

function EntradaAprobada({
  vista,
  titular,
  hoy,
}: {
  vista: VistaAprobada;
  titular: string;
  hoy: string;
}) {
  const saldo = saldoDeLaVista(vista);
  const bajada = bajadaDeLaEntrega(vista.datos.entrega, hoy);
  const precio = vista.precio === null ? '—' : formatearPesos(vista.precio);

  if (vista.foco === 'saldo') {
    return (
      <>
        <div className="mt-3 flex flex-col gap-0.5">
          <span className="text-body text-text-2">{saldo.etiqueta}</span>
          <MontoQueEntra tamano="destacado" className={`leading-tight font-semibold ${saldo.tono}`}>
            {saldo.texto}
          </MontoQueEntra>
        </div>
        <div className="mt-3 flex flex-wrap items-baseline gap-x-6 gap-y-1 text-body">
          <span className="flex items-baseline gap-2">
            <span className="text-text-2">Vale</span>
            <span className="font-semibold tabular-nums">{precio}</span>
          </span>
          <span className="flex items-baseline gap-2">
            <span className="text-text-2">Pagaste</span>
            <span className="font-semibold tabular-nums">{formatearPesos(vista.pagado)}</span>
          </span>
        </div>
        <div className="mt-3.5 flex flex-wrap items-baseline gap-x-2.5 gap-y-1 self-stretch border-t border-hairline-soft pt-3.5">
          <span className="text-body-lg font-semibold">{titular}</span>
          {bajada !== '' && <span className="text-body text-text-2">{bajada}</span>}
        </div>
      </>
    );
  }

  return (
    <>
      <Titular texto={titular} bajada={bajada} />
      <div className="mt-4 flex flex-wrap items-baseline gap-x-6 gap-y-2 self-stretch border-t border-hairline-soft pt-3.5">
        <Cifra clave={saldo.etiqueta} valor={saldo.texto} grande tono={saldo.tono} />
        <Cifra clave="Vale" valor={precio} />
        <Cifra clave="Pagaste" valor={formatearPesos(vista.pagado)} />
      </div>
    </>
  );
}

function EntradaDeLaVista({ vista, bajada, hoy }: { vista: Vista; bajada: string; hoy: string }) {
  const titular = textoDelTitular(vista.titular, hoy);
  switch (vista.etapa) {
    case 'antes-del-presupuesto':
      return <EntradaAntesDelPresupuesto vista={vista} titular={titular} bajada={bajada} />;
    case 'esperando-la-sena':
      return <EntradaEsperandoLaSena vista={vista} titular={titular} bajada={bajada} />;
    case 'aprobado':
    case 'fabricacion':
    case 'listo':
    case 'entregado':
    case 'pagado':
      return <EntradaAprobada vista={vista} titular={titular} hoy={hoy} />;
  }
}

function TarjetaDelTrabajo({ vista, hoy }: { vista: VistaAprobada; hoy: string }) {
  const { datos } = vista;
  const total = textoDelTotalPagado(vista);
  return (
    <section aria-label="Datos del trabajo">
      <dl className="rounded-panel border border-hairline bg-paper px-4 py-1">
        <Dato clave="Dirección" valor={datos.direccion ?? A_CONFIRMAR} />
        <Dato
          clave="Empezamos"
          valor={datos.inicio === null ? 'Todavía no' : fechaLarga(datos.inicio, hoy)}
        />
        <Dato
          clave={claveDeLaEntrega(datos.entrega)}
          valor={valorDeLaEntrega(datos.entrega, hoy)}
          fuerte
        />
        <Dato clave="Seña" valor={textoDeLaSenaAcordada(datos.sena)} />
        {total !== null && <Dato clave="Total" valor={total} />}
      </dl>
    </section>
  );
}

function ParaCuando({
  proyeccion,
  sena,
  hoy,
}: {
  proyeccion: ProyeccionDeLaEntrega;
  sena: SenaDeLaVista;
  hoy: string;
}) {
  const [principal, ...resto] = textoDeLaProyeccion(
    proyeccion,
    { enUnaFrase: (fecha) => fechaEnUnaFrase(fecha, hoy) },
    sena.situacion,
  );
  return (
    <section aria-label="Para cuándo">
      <div className={TARJETA}>
        <p className="text-body leading-relaxed font-medium text-pretty">{principal}</p>
        {resto.map((linea) => (
          <p key={linea} className="mt-1.5 text-label leading-relaxed text-text-2">
            {linea}
          </p>
        ))}
      </div>
    </section>
  );
}

function ApoyoDeLaVista({ vista, hoy }: { vista: Vista; hoy: string }) {
  switch (vista.etapa) {
    case 'antes-del-presupuesto':
      return <ComoPagar como={vista.comoPagar} />;
    case 'esperando-la-sena':
      return (
        <>
          <ParaCuando proyeccion={vista.proyeccion} sena={vista.sena} hoy={hoy} />
          <ComoPagar como={vista.comoPagar} />
        </>
      );
    case 'aprobado':
    case 'fabricacion':
    case 'listo':
    case 'entregado':
    case 'pagado':
      return (
        <>
          <TarjetaDelTrabajo vista={vista} hoy={hoy} />
          <ComoPagar como={vista.comoPagar} />
        </>
      );
  }
}

function CierreDeLosPagos({ vista }: { vista: Vista }) {
  switch (vista.etapa) {
    case 'antes-del-presupuesto':
    case 'esperando-la-sena':
      return vista.pagos.length === 0 ? null : (
        <div className="flex min-h-12 items-baseline justify-between border-t border-ink py-3 text-body font-semibold">
          <span>{A_CUENTA_DE_LA_SENA}</span>
          <span className="tabular-nums">{formatearPesos(vista.pagado)}</span>
        </div>
      );
    case 'aprobado':
    case 'fabricacion':
    case 'listo':
    case 'entregado':
    case 'pagado': {
      const saldo = saldoDeLaVista(vista);
      return (
        <div className="flex min-h-12 items-baseline justify-between border-t border-ink py-3 text-body font-semibold">
          <span>{saldo.etiqueta}</span>
          <span className={`tabular-nums ${saldo.tono}`}>{saldo.texto}</span>
        </div>
      );
    }
  }
}

export function VistaDelCliente({ vista, hoy, alMandar }: VistaDelClienteProps) {
  const [anuncio, setAnuncio] = useState('');
  const coordinacion = coordinacionConPedido(vista);
  const nota = notaDelRelevamiento(vista, {
    larga: (fecha) => fechaLarga(fecha, hoy),
    corta: diaYMesCorto,
  });

  const visuales = vista.archivos.filter(esImagen);
  const documentos = vista.archivos.filter((archivo) => !esImagen(archivo));

  const como = vista.comoPagar;
  const hayComoPagar = como !== null && (como.transferencia || como.efectivo);
  const textoSinPagos = sinPagosTodavia(vista);
  const textoDelPie = pieDeLosPagos(vista, hayComoPagar);

  return (
    <Pagina quieta className="gap-3 md:gap-4">
      <header className="flex items-center justify-between gap-3 px-1">
        <span className="min-w-0 font-display text-lema leading-tight">{vista.taller}</span>
      </header>

      <PrincipalYApoyo
        amplio
        separacion="gap-y-3 @min-[40rem]/apoyo:gap-y-4"
        apoyo={
          <div className="@container flex flex-col gap-3 md:gap-4">
            <ApoyoDeLaVista vista={vista} hoy={hoy} />

            <p data-fin-de-la-vista className="px-1 text-label leading-relaxed text-text-3">
              Esta página la arma el taller para vos y se actualiza sola a medida que avanza el
              trabajo. Si algo no coincide, escribile al taller.
            </p>
          </div>
        }
      >
        <div className="flex flex-col gap-3 md:gap-4">
          <TarjetaConLamina
            como="section"
            aria-label="Tu mueble"
            dibujo={<TrabajoEnEtapa etapa={etapaDelDibujo(vista)} />}
            lamina="[&>svg]:w-56 @min-[40rem]/con-lamina:[&>svg]:w-72"
          >
            <span className="text-body text-text-2">{vista.cliente}</span>
            <h1 className="font-display text-h1 leading-tight text-pretty lg:text-h1-lg">
              {vista.titulo}
            </h1>

            <EntradaDeLaVista vista={vista} bajada={nota?.resumen ?? ''} hoy={hoy} />
          </TarjetaConLamina>

          <p
            role="status"
            className={
              anuncio === ''
                ? 'sr-only'
                : 'flex items-start gap-2.5 rounded-panel border border-hairline bg-paper px-4 py-3 text-body leading-relaxed font-medium'
            }
          >
            {anuncio !== '' && (
              <span aria-hidden className="mt-0.5 flex-none text-hogar">
                <Icono nombre="circle-check" tamano={18} />
              </span>
            )}
            {anuncio}
          </p>

          {coordinacion !== null && (
            <CoordinarLaEntrega
              key={coordinacion.propuesta.id}
              coordinacion={coordinacion}
              hoy={hoy}
              alMandar={alMandar}
              alAnunciar={setAnuncio}
            />
          )}

          <section aria-label="En qué anda" className={`@container ${TARJETA}`}>
            <h2 className="mb-3.5 text-section font-semibold">El camino de tu mueble</h2>
            <CaminoDeHitos hitos={vista.hitos} nota={nota} hoy={hoy} />
            {vista.sigue !== '' && (
              <p className="mt-3.5 text-body leading-relaxed text-text-2">{vista.sigue}</p>
            )}
          </section>

          {vista.eventos.length > 0 && (
            <section aria-label="Lo que fue pasando" className={TARJETA}>
              <h2 className="mb-1 text-section font-semibold">Lo que fue pasando</h2>
              <ol className="list-none">
                {vista.eventos.map((evento, indice) => (
                  <li
                    key={evento.id}
                    className="grid grid-cols-[18px_1fr_auto] items-start gap-x-3"
                  >
                    <span aria-hidden className="flex h-full flex-col items-center">
                      <span
                        className={`h-4 w-px flex-none ${indice === 0 ? 'bg-transparent' : 'bg-hairline'}`}
                      />
                      <span
                        className={`size-2 flex-none rounded-pill ${indice === 0 ? 'bg-ink' : 'bg-border'}`}
                      />
                      <span
                        className={`w-px flex-1 ${indice === vista.eventos.length - 1 ? 'bg-transparent' : 'bg-hairline'}`}
                      />
                    </span>
                    <span className="min-w-0 py-3">
                      <span className="block text-body leading-normal text-pretty">
                        {evento.texto}
                      </span>
                      <span className="mt-0.5 block text-label text-text-3 tabular-nums">
                        {fechaLarga(evento.fecha, hoy)}
                      </span>
                    </span>
                    <span className="py-3 text-body font-semibold whitespace-nowrap text-hogar tabular-nums">
                      {evento.monto === null ? '' : formatearPesos(evento.monto)}
                    </span>
                  </li>
                ))}
              </ol>
            </section>
          )}

          <section aria-label="Lo que pagaste" className={TARJETA}>
            <h2 className="mb-1.5 text-section font-semibold">Lo que pagaste</h2>
            {vista.pagos.length === 0 ? (
              textoSinPagos !== '' && (
                <p className="border-t border-hairline py-3.5 text-body leading-normal text-text-2">
                  {textoSinPagos}
                </p>
              )
            ) : (
              <ul className="list-none">
                {vista.pagos.map((pago) => (
                  <li
                    key={pago.id}
                    className="flex min-h-12 items-baseline gap-3 border-t border-hairline-soft py-2.5"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block text-body font-medium">
                        {pago.concepto.trim() === '' ? 'Pago' : pago.concepto}
                      </span>
                      <span className="block text-label text-text-3 tabular-nums">
                        {fechaLarga(pago.fecha, hoy)}
                      </span>
                    </span>
                    <span className="flex-none text-body font-semibold tabular-nums">
                      {formatearPesos(pago.monto)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <CierreDeLosPagos vista={vista} />
            <p className="mt-2.5 text-label leading-normal text-text-3">{textoDelPie}</p>
          </section>

          <section aria-label="Fotos y planos" className={TARJETA}>
            <div className="mb-3 flex items-baseline justify-between gap-2.5">
              <h2 className="text-section font-semibold">Fotos y planos</h2>
              {vista.archivos.length > 0 && (
                <span className="text-label text-text-3">
                  {vista.archivos.length === 1
                    ? '1 archivo'
                    : `${String(vista.archivos.length)} archivos`}
                </span>
              )}
            </div>

            {vista.archivos.length === 0 ? (
              <div className="flex flex-col gap-2 rounded-field border border-dashed border-border px-4 py-5">
                <span className="text-body font-medium">Todavía no hay fotos</span>
                <span className="text-body leading-normal text-text-2">
                  Acá van a aparecer los planos, los renders y las fotos que el taller comparta, del
                  diseño a la entrega.
                </span>
              </div>
            ) : (
              <>
                {visuales.length > 0 && (
                  <ul className="grid list-none grid-cols-2 gap-2.5">
                    {visuales.map((archivo) => (
                      <li key={archivo.id}>
                        <a
                          href={urlDelArchivo(archivo.ruta)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex flex-col overflow-hidden rounded-field border border-hairline hover:border-ink"
                        >
                          <img
                            src={urlDelArchivo(archivo.rutaMini)}
                            alt={archivo.nombre}
                            width={archivo.ancho ?? undefined}
                            height={archivo.alto ?? undefined}
                            loading="lazy"
                            className="aspect-4/3 w-full bg-surface object-cover"
                          />
                          <span className="flex items-center gap-2 border-t border-hairline-soft px-2.5 py-2">
                            <Icono nombre="image" tamano={15} />
                            <span className="min-w-0 flex-1 truncate text-label leading-normal">
                              {archivo.nombre}
                            </span>
                          </span>
                        </a>
                      </li>
                    ))}
                  </ul>
                )}

                {documentos.length > 0 && (
                  <ul className={`list-none ${visuales.length > 0 ? 'mt-3.5' : ''}`}>
                    {documentos.map((archivo) => (
                      <li key={archivo.id}>
                        <a
                          href={urlDelArchivo(archivo.ruta)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex min-h-14 items-center gap-3 border-t border-hairline-soft py-2.5 no-underline"
                        >
                          <span className="flex size-9.5 flex-none items-center justify-center rounded-field bg-surface">
                            <Icono nombre="file-text" tamano={18} />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-body font-medium">
                              {archivo.nombre}
                            </span>
                            <span className="block text-meta text-text-3">
                              {TIPO[archivo.tipo] ?? 'Archivo'}
                            </span>
                          </span>
                          <Icono nombre="arrow-up-right" tamano={16} />
                        </a>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </section>
        </div>
      </PrincipalYApoyo>
    </Pagina>
  );
}
