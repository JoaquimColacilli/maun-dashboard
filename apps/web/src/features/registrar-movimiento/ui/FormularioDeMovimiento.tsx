import { useMutation } from '@tanstack/react-query';
import { useState, type ReactNode, type SyntheticEvent } from 'react';

import {
  mensajeDeSincronizacion,
  TESOROS,
  TIPOS_DE_MOVIMIENTO,
  type Tesoro,
  type TipoMovimiento,
} from '@/shared/api';
import { hoyLocal, parsearPesos, useEstadoSync, uuidv7 } from '@/shared/lib';
import { Button, Campo } from '@/shared/ui';

import { MUTACION_DE_MOVIMIENTO } from '../api/mutacion';
import {
  faltaUnLado,
  LADOS_POR_TIPO,
  ladosDe,
  ladosPorDefecto,
  NOMBRE_DEL_TESORO,
  NOMBRE_DEL_TIPO,
} from '../model/lados';

function Selector({
  etiqueta,
  value,
  onChange,
  children,
}: {
  etiqueta: string;
  value: string;
  onChange: (valor: string) => void;
  children: ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-label text-text-2">{etiqueta}</span>
      <select
        value={value}
        onChange={(evento) => {
          onChange(evento.target.value);
        }}
        className="h-field rounded-field border border-border bg-paper px-3 text-body-lg text-ink"
      >
        {children}
      </select>
    </label>
  );
}

function OpcionesDeTesoro({ conVacio }: { conVacio: boolean }) {
  return (
    <>
      {conVacio && <option value="">(ninguno)</option>}
      {TESOROS.map((tesoro) => (
        <option key={tesoro} value={tesoro}>
          {NOMBRE_DEL_TESORO[tesoro]}
        </option>
      ))}
    </>
  );
}

export function FormularioDeMovimiento() {
  const [tipo, setTipo] = useState<TipoMovimiento>('gasto');
  const [lados, setLados] = useState(() => ladosPorDefecto('gasto'));
  const [fecha, setFecha] = useState(hoyLocal);
  const [monto, setMonto] = useState('');
  const [categoria, setCategoria] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [error, setError] = useState<{ campo?: 'monto'; mensaje: string } | undefined>(undefined);

  const mutacion = useMutation(MUTACION_DE_MOVIMIENTO);
  const estadoSync = useEstadoSync();
  const forma = LADOS_POR_TIPO[tipo];

  function cambiarTipo(valor: string) {
    const nuevo = valor as TipoMovimiento;
    setTipo(nuevo);
    setLados(ladosPorDefecto(nuevo));
    setError(undefined);
  }

  function enviar(evento: SyntheticEvent<HTMLFormElement>) {
    evento.preventDefault();
    const centavos = parsearPesos(monto);
    if (centavos === undefined) {
      setError({ campo: 'monto', mensaje: 'Escribí un importe mayor a cero, por ejemplo 12.500.' });
      return;
    }

    const elegidos = ladosDe(tipo, lados);
    if (faltaUnLado(tipo, elegidos)) {
      setError({
        mensaje:
          tipo === 'ajuste'
            ? 'Un ajuste mueve un solo lado: elegí de qué tesoro sale o a cuál entra, no los dos.'
            : 'Elegí de qué tesoro sale y a cuál entra: tienen que ser distintos.',
      });
      return;
    }

    setError(undefined);
    mutacion.mutate({
      id: uuidv7(),
      fecha,
      tipo,
      tesoro_origen: elegidos.origen,
      tesoro_destino: elegidos.destino,
      monto_centavos: centavos,
      categoria,
      descripcion,
    });
    setMonto('');
    setDescripcion('');
  }

  return (
    <form noValidate className="flex flex-col gap-3" onSubmit={enviar}>
      <Selector etiqueta="Tipo" value={tipo} onChange={cambiarTipo}>
        {TIPOS_DE_MOVIMIENTO.map((opcion) => (
          <option key={opcion} value={opcion}>
            {NOMBRE_DEL_TIPO[opcion]}
          </option>
        ))}
      </Selector>

      {(forma.origen === 'libre' || forma.origen === 'opcional') && (
        <Selector
          etiqueta="Sale de"
          value={lados.origen ?? ''}
          onChange={(valor) => {
            setLados((previos) => ({
              ...previos,
              origen: valor === '' ? null : (valor as Tesoro),
            }));
          }}
        >
          <OpcionesDeTesoro conVacio={forma.origen === 'opcional'} />
        </Selector>
      )}

      {(forma.destino === 'libre' || forma.destino === 'opcional') && (
        <Selector
          etiqueta="Entra a"
          value={lados.destino ?? ''}
          onChange={(valor) => {
            setLados((previos) => ({
              ...previos,
              destino: valor === '' ? null : (valor as Tesoro),
            }));
          }}
        >
          <OpcionesDeTesoro conVacio={forma.destino === 'opcional'} />
        </Selector>
      )}

      <Campo
        etiqueta="Fecha"
        type="date"
        value={fecha}
        onChange={(evento) => {
          setFecha(evento.target.value);
        }}
      />
      <Campo
        etiqueta="Importe"
        inputMode="decimal"
        placeholder="12.500"
        value={monto}
        error={error?.campo === 'monto' ? error.mensaje : undefined}
        onChange={(evento) => {
          setMonto(evento.target.value);
        }}
      />
      <Campo
        etiqueta="Categoría"
        value={categoria}
        maxLength={200}
        onChange={(evento) => {
          setCategoria(evento.target.value);
        }}
        placeholder="Supermercado"
      />
      <Campo
        etiqueta="Descripción"
        value={descripcion}
        maxLength={500}
        onChange={(evento) => {
          setDescripcion(evento.target.value);
        }}
      />

      {error !== undefined && error.campo === undefined && (
        <p role="alert" className="text-label font-medium text-alerta">
          {error.mensaje}
        </p>
      )}
      {mutacion.isError && (
        <p role="alert" className="text-label font-medium text-alerta">
          {mensajeDeSincronizacion(mutacion.error)}
        </p>
      )}
      {mutacion.isPending && estadoSync.tipo === 'sin-conexion' && (
        <p className="text-label text-atencion">
          Quedó en la cola: se sincroniza cuando vuelva la señal.
        </p>
      )}
      {mutacion.isSuccess && <p className="text-label text-hogar">Guardado.</p>}

      <Button type="submit" cargando={mutacion.isPending} className="mt-1">
        Cargar el movimiento
      </Button>
    </form>
  );
}
