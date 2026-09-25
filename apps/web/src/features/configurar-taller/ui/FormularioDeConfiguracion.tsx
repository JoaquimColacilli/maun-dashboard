import { useMutation } from '@tanstack/react-query';
import { useState, type SyntheticEvent } from 'react';

import { diasQueValeElPresupuesto } from '@/entities/proyecto';
import { mensajeDeSincronizacion, type CambiosDeAjustes, type FilaDe } from '@/shared/api';
import {
  formatearPorcentaje,
  parsearPorcentaje,
  SENA_MAXIMA_BP,
  useEstadoSync,
} from '@/shared/lib';
import { Button, Campo, CamposJuntos, MoneyInput } from '@/shared/ui';

import { MUTACION_DE_AJUSTES, MUTACION_DEL_NOMBRE } from '../api/mutacion';
import { diferencias } from '../model/cambios';
import { DIAS_MAXIMOS_DE_UN_PRESUPUESTO, parsearDias } from '../model/vigencia';

const LARGO_DEL_NOMBRE = 120;

type CampoDelFormulario = 'nombre' | 'sueldo' | 'fijos' | 'meta' | 'tasa' | 'sena' | 'vigencia';

const MENSAJE: Readonly<Partial<Record<CampoDelFormulario, string>>> = {
  tasa: 'Escribí la tasa como un porcentaje, por ejemplo 40. Podés dejarla en 0.',
  sena: 'Escribí la seña como un porcentaje entre 0 y 100, por ejemplo 50.',
  vigencia: `Escribí cuántos días vale un presupuesto, entre 1 y ${String(DIAS_MAXIMOS_DE_UN_PRESUPUESTO)}. Lo normal son 15.`,
};

interface ErrorDelFormulario {
  campo: CampoDelFormulario;
  mensaje: string;
}

export function FormularioDeConfiguracion({
  household,
  ajustes,
}: {
  household: FilaDe<'households'>;
  ajustes: FilaDe<'ajustes'>;
}) {
  const [nombre, setNombre] = useState(household.nombre);
  const [sueldo, setSueldo] = useState<number | null>(ajustes.sueldo_mensual_centavos);
  const [fijos, setFijos] = useState<number | null>(ajustes.costos_fijos_centavos);
  const [meta, setMeta] = useState<number | null>(ajustes.meta_cocos_centavos);
  const [tasa, setTasa] = useState(() => formatearPorcentaje(ajustes.tasa_cocos_anual_bp));
  const [sena, setSena] = useState(() => formatearPorcentaje(ajustes.sena_bp));
  const [vigencia, setVigencia] = useState(() => String(diasQueValeElPresupuesto(ajustes)));
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
      sueldo_mensual_centavos: sueldo,
      costos_fijos_centavos: fijos,
      meta_cocos_centavos: meta,
      tasa_cocos_anual_bp: parsearPorcentaje(tasa),
      sena_bp: parsearPorcentaje(sena, SENA_MAXIMA_BP),
      presupuesto_vale_dias: parsearDias(vigencia),
    };

    const faltante: [CampoDelFormulario, number | null | undefined][] = [
      ['sueldo', valores.sueldo_mensual_centavos],
      ['fijos', valores.costos_fijos_centavos],
      ['meta', valores.meta_cocos_centavos],
      ['tasa', valores.tasa_cocos_anual_bp],
      ['sena', valores.sena_bp],
      ['vigencia', valores.presupuesto_vale_dias],
    ];
    const invalido = faltante.find(([, valor]) => valor === undefined || valor === null);
    if (invalido) {
      setError({
        campo: invalido[0],
        mensaje:
          MENSAJE[invalido[0]] ?? 'Escribí un importe, por ejemplo 1.800.000. Podés dejarlo en 0.',
      });
      return;
    }

    setError(undefined);
    const { cambios, previos } = diferencias(ajustes, valores as CambiosDeAjustes);

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
      <CamposJuntos columnas={3} deADos campoMinimo="12rem">
        <Campo
          etiqueta="Nombre del taller"
          value={nombre}
          maxLength={LARGO_DEL_NOMBRE}
          error={error?.campo === 'nombre' ? error.mensaje : undefined}
          onChange={(evento) => {
            setNombre(evento.target.value);
          }}
        />
        <MoneyInput
          etiqueta="Sueldo que te asignás"
          ayuda={
            ajustes.sueldo_tope_mensual
              ? 'Lo que tu casa necesita por mes. Los cobros del mes lo van pagando y, una vez cubierto, lo que sobra queda en el taller.'
              : 'Lo que cada trabajo cobrado transfiere al hogar.'
          }
          value={sueldo}
          error={error?.campo === 'sueldo' ? error.mensaje : undefined}
          onChange={setSueldo}
        />
        <MoneyInput
          etiqueta="Costos fijos por mes"
          ayuda="Alquiler, servicios y todo lo que se paga aunque no entre trabajo."
          value={fijos}
          error={error?.campo === 'fijos' ? error.mensaje : undefined}
          onChange={setFijos}
        />
        <MoneyInput
          etiqueta="Meta de Cocos"
          ayuda="A cuánto querés llegar en el ahorro invertido."
          value={meta}
          error={error?.campo === 'meta' ? error.mensaje : undefined}
          onChange={setMeta}
        />
        <Campo
          etiqueta="Seña que pedís (%)"
          inputMode="decimal"
          ayuda="Qué parte del presupuesto pedís para confirmar un trabajo. Lo normal es la mitad, y en un trabajo puntual la podés cambiar."
          value={sena}
          error={error?.campo === 'sena' ? error.mensaje : undefined}
          onChange={(evento) => {
            setSena(evento.target.value);
          }}
        />
        <Campo
          etiqueta="Días que vale un presupuesto"
          inputMode="numeric"
          ayuda="Se cuentan desde el día que lo mandás. Tu cliente ve hasta cuándo puede dejar la seña, y en cada trabajo la fecha se puede cambiar."
          value={vigencia}
          error={error?.campo === 'vigencia' ? error.mensaje : undefined}
          onChange={(evento) => {
            setVigencia(evento.target.value);
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
      </CamposJuntos>

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
