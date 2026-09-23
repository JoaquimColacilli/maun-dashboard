import { asientosDelLibro, type Tesoro } from '@maun/domain';
import { useMemo, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router';

import {
  agruparPorDia,
  FichaDelMovimiento,
  filtrarLineas,
  filtroInicial,
  hayFiltroPuesto,
  lineasDelTaller,
  ListaDelLibro,
  mesesConMovimiento,
  resumenMensual,
  TODOS_LOS_MESES,
  useMovimientosEnVuelo,
  type FiltroDelLibro,
  type LineaDelTaller,
  type SentidoDeLinea,
} from '@/entities/movimiento';
import { useLiquidacionesEnVuelo } from '@/entities/proyecto';
import { useReplicaDelTaller } from '@/entities/replica';
import { datosDelLibro } from '@/shared/api';
import {
  conFondo,
  hoyLocal,
  mesAnterior,
  mesDeLaFecha,
  nombreDelMes,
  PARAMETRO_DE_TESORO,
  rutaDelMovimiento,
  RUTA_DE_MOVIMIENTO_NUEVO,
  TESORO,
  tesoroDelParametro,
  TESOROS_EN_ORDEN,
} from '@/shared/lib';
import { Button, ComparacionMensual, ConSalida, Icono, Pagina, PrincipalYApoyo } from '@/shared/ui';

const SENTIDOS: readonly { id: SentidoDeLinea | 'todos'; etiqueta: string }[] = [
  { id: 'todos', etiqueta: 'Todo' },
  { id: 'entra', etiqueta: 'Entradas' },
  { id: 'sale', etiqueta: 'Salidas' },
  { id: 'mueve', etiqueta: 'Entre tesoros' },
];

function Chip({
  activo,
  etiqueta,
  punto,
  alElegir,
}: {
  activo: boolean;
  etiqueta: string;
  punto?: string;
  alElegir: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={activo}
      onClick={alElegir}
      className={`flex min-h-tap items-center gap-2 rounded-control border px-3 text-label font-medium ${
        activo ? 'border-ink bg-ink text-paper' : 'border-border bg-paper text-ink'
      }`}
    >
      {punto !== undefined && (
        <span aria-hidden className={`size-2 rounded-pill ${activo ? 'bg-paper' : punto}`} />
      )}
      {etiqueta}
    </button>
  );
}

export function FinanzasPage() {
  const replica = useReplicaDelTaller();
  const navegar = useNavigate();
  const location = useLocation();
  const hoy = hoyLocal();
  const mes = mesDeLaFecha(hoy);

  function abrirHoja(ruta: string) {
    void navegar(ruta, { state: conFondo(location) });
  }

  const [parametros, setParametros] = useSearchParams();
  const [resto, setResto] = useState<Omit<FiltroDelLibro, 'tesoro'>>(() => {
    const { sentido, mes: mesInicial, texto } = filtroInicial(mes);
    return { sentido, mes: mesInicial, texto };
  });
  const filtro: FiltroDelLibro = {
    ...resto,
    tesoro: tesoroDelParametro(parametros.get(PARAMETRO_DE_TESORO)),
  };
  const [ficha, setFicha] = useState<LineaDelTaller | null>(null);

  const enVuelo = useMovimientosEnVuelo();
  const liquidaciones = useLiquidacionesEnVuelo();

  const lineas = useMemo(() => lineasDelTaller(replica), [replica]);
  const visibles = filtrarLineas(lineas, filtro);
  const dias = agruparPorDia(visibles, filtro.tesoro);
  const meses = mesesConMovimiento(lineas, mes);

  const asientos = useMemo(() => asientosDelLibro(datosDelLibro(replica)), [replica]);
  const actual = resumenMensual(asientos, mes);
  const previo = resumenMensual(asientos, mesAnterior(mes));

  const conFiltro = hayFiltroPuesto(filtro, mes);
  const cambiar = ({ tesoro, ...otros }: Partial<FiltroDelLibro>) => {
    if (Object.keys(otros).length > 0) setResto((previo) => ({ ...previo, ...otros }));
    if (tesoro === undefined) return;
    setParametros(
      (previos) => {
        const siguientes = new URLSearchParams(previos);
        if (tesoro === 'todos') siguientes.delete(PARAMETRO_DE_TESORO);
        else siguientes.set(PARAMETRO_DE_TESORO, tesoro);
        return siguientes;
      },
      { replace: true },
    );
  };

  function abrir(linea: LineaDelTaller) {
    if (linea.bloqueo === null) {
      abrirHoja(rutaDelMovimiento(linea.asientoId));
      return;
    }
    setFicha(linea);
  }

  function sinConfirmar(linea: LineaDelTaller): boolean {
    if (linea.origen === 'manual') return enVuelo.has(linea.asientoId);
    if (linea.origen !== 'distribucion') return false;
    return liquidaciones.some((liquidacion) => liquidacion.proyectoId === linea.proyectoId);
  }

  return (
    <Pagina className="gap-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="font-display text-h1 leading-tight lg:text-h1-lg">Finanzas</h1>
        <Button
          onClick={() => {
            abrirHoja(RUTA_DE_MOVIMIENTO_NUEVO);
          }}
        >
          <Icono nombre="plus" tamano={18} />
          Cargar movimiento
        </Button>
      </header>

      <PrincipalYApoyo
        apoyoPrimero
        amplio
        separacion="gap-y-4"
        apoyo={
          <ComparacionMensual
            titulo={`${nombreDelMes(mes)} contra ${nombreDelMes(mesAnterior(mes)).toLowerCase()}`}
            etiquetaPrevia={nombreDelMes(mesAnterior(mes)).toLowerCase()}
            etiquetaActual={nombreDelMes(mes).toLowerCase()}
            barras={[
              {
                id: 'entro-hogar',
                etiqueta: 'Entró al hogar',
                previo: previo.entroHogar,
                actual: actual.entroHogar,
                tono: 'text-hogar',
              },
              {
                id: 'gasto-hogar',
                etiqueta: 'Gastó el hogar',
                previo: previo.gastoHogar,
                actual: actual.gastoHogar,
                tono: 'text-ink',
                mejorSiBaja: true,
              },
              {
                id: 'facturo-taller',
                etiqueta: 'Facturó el taller',
                previo: previo.facturoTaller,
                actual: actual.facturoTaller,
                tono: 'text-maun',
              },
            ]}
          />
        }
      >
        <div className="flex flex-wrap items-center gap-2">
          <div className="contents @min-[52rem]/apoyo:flex @min-[52rem]/apoyo:flex-wrap @min-[52rem]/apoyo:items-center @min-[52rem]/apoyo:gap-2">
            <Chip
              activo={filtro.tesoro === 'todos'}
              etiqueta="Todos"
              alElegir={() => {
                cambiar({ tesoro: 'todos' });
              }}
            />
            {TESOROS_EN_ORDEN.map((id: Tesoro) => (
              <Chip
                key={id}
                activo={filtro.tesoro === id}
                etiqueta={TESORO[id].nombre}
                punto={TESORO[id].barra}
                alElegir={() => {
                  cambiar({ tesoro: id });
                }}
              />
            ))}
          </div>
          <span aria-hidden className="mx-0.5 h-6 w-px bg-hairline @min-[52rem]/apoyo:hidden" />
          <div className="contents @min-[52rem]/apoyo:flex @min-[52rem]/apoyo:flex-wrap @min-[52rem]/apoyo:items-center @min-[52rem]/apoyo:gap-2">
            {SENTIDOS.map((sentido) => (
              <Chip
                key={sentido.id}
                activo={filtro.sentido === sentido.id}
                etiqueta={sentido.etiqueta}
                alElegir={() => {
                  cambiar({ sentido: sentido.id });
                }}
              />
            ))}
          </div>
        </div>

        <div className="mt-2.5 flex gap-2">
          <label className="flex h-field min-w-0 flex-1 items-center gap-2 rounded-field border border-border px-3">
            <span aria-hidden className="flex-none text-text-2">
              <Icono nombre="search" tamano={16} />
            </span>
            <input
              value={filtro.texto}
              aria-label="Buscar en el libro"
              placeholder="Buscar por lo que anotaste"
              onChange={(evento) => {
                cambiar({ texto: evento.target.value });
              }}
              className="min-w-0 flex-1 border-0 bg-transparent text-body text-ink outline-none"
            />
          </label>
          <select
            value={filtro.mes}
            aria-label="Mes"
            onChange={(evento) => {
              cambiar({ mes: evento.target.value });
            }}
            className="h-field rounded-field border border-border bg-paper px-3 text-body text-ink"
          >
            {meses.map((opcion) => (
              <option key={opcion} value={opcion}>
                {nombreDelMes(opcion)} {opcion.slice(0, 4)}
              </option>
            ))}
            <option value={TODOS_LOS_MESES}>Todos los meses</option>
          </select>
        </div>

        {visibles.length === 0 ? (
          <div className="flex max-w-[520px] flex-col items-start gap-3 py-8">
            <span
              aria-hidden
              className="flex size-12 items-center justify-center rounded-panel bg-surface text-text-2"
            >
              <Icono nombre="wallet" tamano={24} />
            </span>
            <h2 className="text-section font-semibold">
              {conFiltro ? 'Nada con esos filtros' : 'Todavía no hay movimientos'}
            </h2>
            <p className="text-body leading-relaxed text-text-2">
              {conFiltro
                ? 'Probá con otro mes o sacá los filtros.'
                : 'Cargá el primer gasto o ingreso. Los cobros y las compras de cada trabajo se anotan solos desde el trabajo.'}
            </p>
            {conFiltro ? (
              <Button
                variant="secundario"
                onClick={() => {
                  cambiar(filtroInicial(mes));
                }}
              >
                Limpiar los filtros
              </Button>
            ) : (
              <Button
                onClick={() => {
                  abrirHoja(RUTA_DE_MOVIMIENTO_NUEVO);
                }}
              >
                Cargar el primero
              </Button>
            )}
          </div>
        ) : (
          <ListaDelLibro
            dias={dias}
            tesoro={filtro.tesoro}
            hoy={hoy}
            sinConfirmar={sinConfirmar}
            alAbrir={abrir}
          />
        )}
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
