import { centavos, type SaldosPorTesoro } from '@maun/domain';
import { useMutation } from '@tanstack/react-query';
import { useEffect, useRef, useState, type SyntheticEvent } from 'react';

import {
  ayudaDelMovimiento,
  CLASE,
  claseDe,
  clasesDelGrupo,
  GRUPOS,
  MUTACION_DE_BAJA_DE_MOVIMIENTO,
  MUTACION_DE_EDICION_DE_MOVIMIENTO,
  MUTACION_DE_MOVIMIENTO,
  type ClaseDeMovimiento,
  type GrupoDeMovimiento,
} from '@/entities/movimiento';
import { mensajeDeSincronizacion, type CambiosDeMovimiento, type FilaDe } from '@/shared/api';
import {
  formatearPesos,
  hayCambios,
  hoyLocal,
  metaDeAvisos,
  TESORO,
  useEstadoSync,
  uuidv7,
} from '@/shared/lib';
import { Button, Campo, FilaDeAcciones, Hoja, Icono, MoneyInput } from '@/shared/ui';

const UN_DIA_MS = 86_400_000;

function ayerLocal(hoy: string): string {
  return hoyLocal(new Date(new Date(`${hoy}T12:00:00`).getTime() - UN_DIA_MS));
}

function claseDeLaFila(fila: FilaDe<'movimientos'>): ClaseDeMovimiento {
  return claseDe(fila.tipo, fila.tesoro_origen, fila.tesoro_destino)?.id ?? 'gasto_hogar';
}

function Segmentado({
  grupo,
  alElegir,
}: {
  grupo: GrupoDeMovimiento;
  alElegir: (nuevo: GrupoDeMovimiento) => void;
}) {
  return (
    <div
      role="radiogroup"
      aria-label="Tipo"
      className="grid grid-cols-4 gap-0.5 rounded-pill bg-ink/6 p-1"
    >
      {GRUPOS.map((opcion) => (
        <button
          key={opcion.id}
          type="button"
          role="radio"
          aria-checked={grupo === opcion.id}
          onClick={() => {
            alElegir(opcion.id);
          }}
          className={`min-h-tap rounded-pill text-label ${
            grupo === opcion.id
              ? 'bg-elevado font-semibold text-ink shadow-float'
              : 'font-medium text-text-2'
          }`}
        >
          {opcion.etiqueta}
        </button>
      ))}
    </div>
  );
}

export interface HojaDeMovimientoProps {
  movimiento?: FilaDe<'movimientos'>;
  claseInicial?: ClaseDeMovimiento;
  saldos: SaldosPorTesoro;
  metaCocos: number;
  alCerrar: () => void;
}

export function HojaDeMovimiento({
  movimiento,
  claseInicial,
  saldos,
  metaCocos,
  alCerrar,
}: HojaDeMovimientoProps) {
  const hoy = hoyLocal();
  const ayer = ayerLocal(hoy);

  const [iniciales] = useState(() => {
    const clase = movimiento ? claseDeLaFila(movimiento) : (claseInicial ?? 'gasto_hogar');
    return {
      clase,
      categoria: movimiento?.categoria ?? CLASE[clase].categorias[0] ?? '',
      descripcion: movimiento?.descripcion ?? '',
      monto: movimiento?.monto_centavos ?? null,
      fecha: movimiento?.fecha ?? hoy,
    };
  });
  const [clase, setClase] = useState<ClaseDeMovimiento>(iniciales.clase);
  const [categoria, setCategoria] = useState(iniciales.categoria);
  const [descripcion, setDescripcion] = useState(iniciales.descripcion);
  const [monto, setMonto] = useState<number | null>(iniciales.monto);
  const [fecha, setFecha] = useState(iniciales.fecha);
  const [error, setError] = useState<string | undefined>(undefined);
  const [confirmandoBaja, setConfirmandoBaja] = useState(false);

  const campoDeMonto = useRef<HTMLInputElement>(null);
  useEffect(() => {
    campoDeMonto.current?.focus();
  }, []);

  const crear = useMutation({ ...MUTACION_DE_MOVIMIENTO, meta: metaDeAvisos('movimientoNuevo') });
  const editar = useMutation({
    ...MUTACION_DE_EDICION_DE_MOVIMIENTO,
    meta: metaDeAvisos('movimientoEditado'),
  });
  const borrar = useMutation({
    ...MUTACION_DE_BAJA_DE_MOVIMIENTO,
    meta: metaDeAvisos('movimientoBorrado'),
  });
  const estadoSync = useEstadoSync();
  const enVuelo = crear.isPending || editar.isPending || borrar.isPending;
  const fallo: unknown = crear.error ?? editar.error ?? borrar.error;

  const datos = CLASE[clase];
  const tinte = TESORO[datos.tesoro];
  const escritos = monto ?? 0;
  const ayuda = ayudaDelMovimiento(clase, {
    saldos,
    metaCocos: centavos(metaCocos),
    monto: centavos(escritos),
  });

  function elegirClase(nueva: ClaseDeMovimiento) {
    setClase(nueva);
    setCategoria(CLASE[nueva].categorias[0] ?? '');
    setError(undefined);
  }

  function elegirGrupo(grupo: GrupoDeMovimiento) {
    const primera = clasesDelGrupo(grupo)[0];
    if (primera) elegirClase(primera.id);
  }

  function enviar(evento: SyntheticEvent<HTMLFormElement>) {
    evento.preventDefault();
    const importe = monto;
    if (importe === null || importe === 0) {
      setError('Escribí cuánta plata es, por ejemplo 12.500.');
      return;
    }
    setError(undefined);

    const campos = {
      fecha,
      tipo: datos.tipo,
      tesoro_origen: datos.desde,
      tesoro_destino: datos.hacia,
      monto_centavos: importe,
      categoria,
      descripcion,
    } satisfies CambiosDeMovimiento;

    if (movimiento) {
      editar.mutate({
        id: movimiento.id,
        cambios: campos,
        previos: {
          fecha: movimiento.fecha,
          tipo: movimiento.tipo,
          tesoro_origen: movimiento.tesoro_origen,
          tesoro_destino: movimiento.tesoro_destino,
          monto_centavos: movimiento.monto_centavos,
          categoria: movimiento.categoria,
          descripcion: movimiento.descripcion,
        },
      });
    } else {
      crear.mutate({ id: uuidv7(), ...campos });
    }
    alCerrar();
  }

  function confirmarBaja() {
    if (!movimiento) return;
    borrar.mutate({
      id: movimiento.id,
      borradoEn: new Date().toISOString(),
      previo: movimiento,
    });
    alCerrar();
  }

  return (
    <Hoja
      titulo={movimiento ? 'Editar el movimiento' : 'Cargar un movimiento'}
      alCerrar={alCerrar}
      conCambios={hayCambios(
        { ...iniciales, descripcion: iniciales.descripcion.trim() },
        { clase, categoria, descripcion: descripcion.trim(), monto, fecha },
      )}
    >
      <form noValidate onSubmit={enviar} className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-5 py-4 md:px-6 md:py-5">
          <Segmentado grupo={datos.grupo} alElegir={elegirGrupo} />

          {clasesDelGrupo(datos.grupo).length > 1 && (
            <div role="group" aria-label="Detalle del tipo" className="flex flex-wrap gap-2">
              {clasesDelGrupo(datos.grupo).map((opcion) => (
                <button
                  key={opcion.id}
                  type="button"
                  aria-pressed={clase === opcion.id}
                  onClick={() => {
                    elegirClase(opcion.id);
                  }}
                  className={`flex min-h-tap items-center gap-2 rounded-pill border px-3 text-label font-medium ${
                    clase === opcion.id
                      ? 'border-ink bg-ink text-paper'
                      : 'border-border bg-paper text-ink'
                  }`}
                >
                  <span
                    aria-hidden
                    className={`size-2 rounded-pill ${
                      clase === opcion.id ? 'bg-paper' : TESORO[opcion.tesoro].barra
                    }`}
                  />
                  {opcion.corta}
                </button>
              ))}
            </div>
          )}

          <label className="flex flex-col gap-1.5">
            <span className="text-label text-text-2">Cuánta plata</span>
            <span
              className={`flex h-[76px] items-center gap-2 rounded-field border px-4 ${
                error === undefined ? 'border-ink' : 'border-alerta'
              }`}
            >
              <span aria-hidden className="text-h1 text-text-3">
                $
              </span>
              <MoneyInput
                ref={campoDeMonto}
                value={monto}
                placeholder="0"
                aria-label="Cuánta plata"
                aria-invalid={error === undefined ? undefined : true}
                onChange={(centavos) => {
                  setMonto(centavos);
                  setError(undefined);
                }}
                className="min-w-0 flex-1 border-0 bg-transparent text-money-xl font-semibold text-ink outline-none"
              />
            </span>
            {error !== undefined && (
              <span role="alert" className="text-label font-medium text-alerta">
                {error}
              </span>
            )}
          </label>

          <Campo
            etiqueta="Qué fue"
            value={descripcion}
            maxLength={500}
            placeholder={datos.ejemplo}
            onChange={(evento) => {
              setDescripcion(evento.target.value);
            }}
          />

          {datos.categorias.length > 0 && (
            <label className="flex flex-col gap-1.5">
              <span className="text-label text-text-2">Categoría</span>
              <select
                value={categoria}
                onChange={(evento) => {
                  setCategoria(evento.target.value);
                }}
                className="h-field rounded-field border border-border bg-paper px-3 text-body-lg text-ink"
              >
                {datos.categorias.map((opcion) => (
                  <option key={opcion} value={opcion}>
                    {opcion}
                  </option>
                ))}
                {!datos.categorias.includes(categoria) && categoria !== '' && (
                  <option value={categoria}>{categoria}</option>
                )}
              </select>
            </label>
          )}

          <div className="@container flex flex-col gap-1.5">
            <span className="text-label text-text-2">Cuándo</span>
            <div className="flex flex-wrap gap-2">
              {[
                { id: hoy, etiqueta: 'Hoy' },
                { id: ayer, etiqueta: 'Ayer' },
              ].map((atajo) => (
                <button
                  key={atajo.id}
                  type="button"
                  aria-pressed={fecha === atajo.id}
                  onClick={() => {
                    setFecha(atajo.id);
                  }}
                  className={`h-field rounded-pill border px-4 text-body font-medium ${
                    fecha === atajo.id
                      ? 'border-ink bg-ink text-paper'
                      : 'border-border bg-paper text-ink'
                  }`}
                >
                  {atajo.etiqueta}
                </button>
              ))}
              <input
                type="date"
                value={fecha}
                aria-label="Otra fecha"
                onChange={(evento) => {
                  setFecha(evento.target.value);
                }}
                className="h-field min-w-0 basis-full rounded-field border border-border bg-paper px-3 text-body text-ink @xs:basis-0 @xs:flex-1"
              />
            </div>
          </div>

          <p
            className={`flex items-start gap-2.5 rounded-field px-3.5 py-3 text-label leading-relaxed ${tinte.fondo}`}
          >
            <span aria-hidden className={`mt-0.5 flex-none ${tinte.texto}`}>
              <Icono nombre={tinte.icono} tamano={18} />
            </span>
            <span>{ayuda}</span>
          </p>

          {confirmandoBaja && movimiento && (
            <div className="flex flex-col gap-2.5 rounded-field border border-alerta px-3.5 py-3">
              <p className="text-label leading-relaxed">
                Se va a borrar este movimiento de {formatearPesos(movimiento.monto_centavos)} y los
                saldos se recalculan sin él.
              </p>
              <FilaDeAcciones>
                <Button variant="peligro" size="chico" onClick={confirmarBaja}>
                  Borrarlo
                </Button>
                <Button
                  variant="secundario"
                  size="chico"
                  onClick={() => {
                    setConfirmandoBaja(false);
                  }}
                >
                  Dejarlo
                </Button>
              </FilaDeAcciones>
            </div>
          )}

          {fallo !== null && fallo !== undefined && (
            <p role="alert" className="text-label font-medium text-alerta">
              {mensajeDeSincronizacion(fallo)}
            </p>
          )}
          {enVuelo && estadoSync.tipo === 'sin-conexion' && (
            <p className="text-label text-atencion">
              Queda en la cola: se sincroniza cuando vuelva la señal.
            </p>
          )}
        </div>

        <footer className="flex-none border-t border-hairline bg-paper px-5 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] md:px-6 md:pb-3">
          <FilaDeAcciones>
            {movimiento && !confirmandoBaja && (
              <Button
                type="button"
                variant="secundario"
                onClick={() => {
                  setConfirmandoBaja(true);
                }}
              >
                <Icono nombre="trash-2" tamano={16} />
                Borrar
              </Button>
            )}
            <Button type="submit" cargando={enVuelo}>
              {movimiento ? 'Guardar los cambios' : 'Cargar el movimiento'}
            </Button>
          </FilaDeAcciones>
        </footer>
      </form>
    </Hoja>
  );
}
