import { useMutation } from '@tanstack/react-query';
import { useState, type SyntheticEvent } from 'react';

import {
  COLUMNAS_DE_AJUSTES,
  mensajeDeSincronizacion,
  type CambiosDeAjustes,
  type FilaDe,
} from '@/shared/api';
import {
  formatearPorcentaje,
  parsearPesosDesdeCero,
  parsearPorcentaje,
  pesosEditables,
  useEstadoSync,
} from '@/shared/lib';
import { Button, Campo } from '@/shared/ui';

import { MUTACION_DE_AJUSTES, MUTACION_DEL_NOMBRE } from '../api/mutacion';

const LARGO_DEL_NOMBRE = 120;

type CampoDelFormulario = 'nombre' | 'sueldo' | 'fijos' | 'meta' | 'tasa';

interface ErrorDelFormulario {
  campo: CampoDelFormulario;
  mensaje: string;
}

function diferencias(
  ajustes: FilaDe<'ajustes'>,
  nuevos: Required<CambiosDeAjustes>,
): { cambios: CambiosDeAjustes; previos: CambiosDeAjustes } {
  const cambios: CambiosDeAjustes = {};
  const previos: CambiosDeAjustes = {};
  for (const columna of COLUMNAS_DE_AJUSTES) {
    if (nuevos[columna] !== ajustes[columna]) {
      cambios[columna] = nuevos[columna];
      previos[columna] = ajustes[columna];
    }
  }
  return { cambios, previos };
}

export function FormularioDeConfiguracion({
  household,
  ajustes,
}: {
  household: FilaDe<'households'>;
  ajustes: FilaDe<'ajustes'>;
}) {
  const [nombre, setNombre] = useState(household.nombre);
  const [sueldo, setSueldo] = useState(() => pesosEditables(ajustes.sueldo_mensual_centavos));
  const [fijos, setFijos] = useState(() => pesosEditables(ajustes.costos_fijos_centavos));
  const [meta, setMeta] = useState(() => pesosEditables(ajustes.meta_cocos_centavos));
  const [tasa, setTasa] = useState(() => formatearPorcentaje(ajustes.tasa_cocos_anual_bp));
  const [error, setError] = useState<ErrorDelFormulario | undefined>(undefined);

  const mutacionDeAjustes = useMutation(MUTACION_DE_AJUSTES);
  const mutacionDelNombre = useMutation(MUTACION_DEL_NOMBRE);
  const estadoSync = useEstadoSync();

  const guardando = mutacionDeAjustes.isPending || mutacionDelNombre.isPending;
  const hayFallo = mutacionDeAjustes.isError || mutacionDelNombre.isError;
  const fallo = mutacionDeAjustes.isError ? mutacionDeAjustes.error : mutacionDelNombre.error;
  const guardado =
    !guardando &&
    !hayFallo &&
    (mutacionDeAjustes.isSuccess || mutacionDelNombre.isSuccess) &&
    estadoSync.tipo === 'sincronizado';

  function enviar(evento: SyntheticEvent<HTMLFormElement>) {
    evento.preventDefault();

    const nombreLimpio = nombre.trim();
    if (nombreLimpio === '' || nombreLimpio.length > LARGO_DEL_NOMBRE) {
      setError({
        campo: 'nombre',
        mensaje: `Poné un nombre para el taller, de hasta ${String(LARGO_DEL_NOMBRE)} caracteres.`,
      });
      return;
    }

    const valores = {
      sueldo_mensual_centavos: parsearPesosDesdeCero(sueldo),
      costos_fijos_centavos: parsearPesosDesdeCero(fijos),
      meta_cocos_centavos: parsearPesosDesdeCero(meta),
      tasa_cocos_anual_bp: parsearPorcentaje(tasa),
    };

    const faltante: [CampoDelFormulario, number | undefined][] = [
      ['sueldo', valores.sueldo_mensual_centavos],
      ['fijos', valores.costos_fijos_centavos],
      ['meta', valores.meta_cocos_centavos],
      ['tasa', valores.tasa_cocos_anual_bp],
    ];
    const invalido = faltante.find(([, valor]) => valor === undefined);
    if (invalido) {
      setError({
        campo: invalido[0],
        mensaje:
          invalido[0] === 'tasa'
            ? 'Escribí la tasa como un porcentaje, por ejemplo 40. Podés dejarla en 0.'
            : 'Escribí un importe, por ejemplo 1.800.000. Podés dejarlo en 0.',
      });
      return;
    }

    setError(undefined);
    const { cambios, previos } = diferencias(ajustes, valores as Required<CambiosDeAjustes>);

    if (Object.keys(cambios).length > 0) {
      mutacionDeAjustes.mutate({ id: ajustes.id, cambios, previos });
    }
    if (nombreLimpio !== household.nombre) {
      mutacionDelNombre.mutate({
        id: household.id,
        nombre: nombreLimpio,
        previo: household.nombre,
      });
    }
  }

  return (
    <form noValidate className="flex flex-col gap-3" onSubmit={enviar}>
      <Campo
        etiqueta="Nombre del taller"
        value={nombre}
        maxLength={LARGO_DEL_NOMBRE}
        error={error?.campo === 'nombre' ? error.mensaje : undefined}
        onChange={(evento) => {
          setNombre(evento.target.value);
        }}
      />
      <Campo
        etiqueta="Sueldo que te asignás"
        inputMode="decimal"
        ayuda="Lo que cada trabajo cobrado transfiere al hogar."
        value={sueldo}
        error={error?.campo === 'sueldo' ? error.mensaje : undefined}
        onChange={(evento) => {
          setSueldo(evento.target.value);
        }}
      />
      <Campo
        etiqueta="Costos fijos por mes"
        inputMode="decimal"
        ayuda="Alquiler, servicios y todo lo que se paga aunque no entre trabajo."
        value={fijos}
        error={error?.campo === 'fijos' ? error.mensaje : undefined}
        onChange={(evento) => {
          setFijos(evento.target.value);
        }}
      />
      <Campo
        etiqueta="Meta de Cocos"
        inputMode="decimal"
        ayuda="A cuánto querés llegar en el ahorro invertido."
        value={meta}
        error={error?.campo === 'meta' ? error.mensaje : undefined}
        onChange={(evento) => {
          setMeta(evento.target.value);
        }}
      />
      <Campo
        etiqueta="Tasa anual de Cocos (%)"
        inputMode="decimal"
        ayuda="Solo sirve para proyectar. Si no la sabés, dejala en 0."
        value={tasa}
        error={error?.campo === 'tasa' ? error.mensaje : undefined}
        onChange={(evento) => {
          setTasa(evento.target.value);
        }}
      />

      {hayFallo && (
        <p role="alert" className="text-label font-medium text-alerta">
          {mensajeDeSincronizacion(fallo)}
        </p>
      )}
      {guardando && estadoSync.tipo === 'sin-conexion' && (
        <p className="text-label text-atencion">
          Quedó en la cola: se guarda cuando vuelva la señal.
        </p>
      )}
      {guardado && <p className="text-label text-hogar">Guardado.</p>}

      <Button type="submit" cargando={guardando} className="mt-1 self-start">
        Guardar la configuración
      </Button>
    </form>
  );
}
