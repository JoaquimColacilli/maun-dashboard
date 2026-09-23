import { esAnteriorALaApertura } from '@maun/domain';
import { useEffect, useRef, useState, type SyntheticEvent } from 'react';

import { CasillaDeLaApertura } from '@/entities/movimiento';
import type { Proyecto } from '@/entities/proyecto';
import type { CambiosDeProyecto, PagoParaGuardar } from '@/shared/api';
import { errorDeLaFechaDeLaPlata, hoyEnElTaller, uuidv7 } from '@/shared/lib';
import { Button, Campo, FilaDeAcciones, MoneyInput } from '@/shared/ui';

import {
  conOtroDia,
  conOtroVencimiento,
  errorDelDia,
  pasoDelRelevamiento,
  valoresDelRelevamiento,
} from '../model/relevamiento';

export interface FormularioDelRelevamientoProps {
  proyecto: Proyecto;
  conPago: boolean;
  apertura: string | null;
  alListo: (cambios: CambiosDeProyecto, dia: string, pagos: PagoParaGuardar[]) => void;
  alCancelar: () => void;
}

export function FormularioDelRelevamiento({
  proyecto,
  conPago,
  apertura,
  alListo,
  alCancelar,
}: FormularioDelRelevamientoProps) {
  const hoy = hoyEnElTaller();
  const [valores, setValores] = useState(() => valoresDelRelevamiento(proyecto, hoy));
  const [error, setError] = useState<string | undefined>(undefined);
  const campoDelDia = useRef<HTMLInputElement>(null);
  const idDelPago = useRef(uuidv7());

  useEffect(() => {
    campoDelDia.current?.focus();
  }, []);

  function enviar(evento: SyntheticEvent<HTMLFormElement>): void {
    evento.preventDefault();
    const encontrado = errorDelDia(valores, hoy);
    setError(encontrado);
    if (encontrado !== undefined) return;
    const { cambios, pagos } = pasoDelRelevamiento(valores, idDelPago.current, apertura);
    alListo(cambios, valores.dia, pagos);
  }

  return (
    <form noValidate onSubmit={enviar} className="mt-3 flex flex-col gap-3">
      <Campo
        ref={campoDelDia}
        etiqueta="Qué día fuiste"
        type="date"
        max={hoy}
        value={valores.dia}
        onChange={(evento) => {
          const dia = evento.target.value;
          setValores((previos) => conOtroDia(previos, dia, hoy));
          setError(undefined);
        }}
        error={error}
      />
      <Campo
        etiqueta="Entregar el presupuesto antes del"
        type="date"
        value={valores.vencimiento}
        onChange={(evento) => {
          const vencimiento = evento.target.value;
          setValores((previos) => conOtroVencimiento(previos, vencimiento));
        }}
        ayuda="Una semana de trabajo desde la visita. Cambiala si lo prometiste para otro día."
      />
      {conPago && (
        <MoneyInput
          etiqueta="Cuánto te pagó la visita"
          placeholder="Opcional"
          value={valores.pago}
          onChange={(pago) => {
            setValores((previos) => ({ ...previos, pago }));
          }}
          ayuda="Si no te la pagó, lo que sigue es un estimativo. Igual podés presupuestar."
        />
      )}
      {conPago && (valores.pago ?? 0) > 0 && (
        <CasillaDeLaApertura
          fecha={valores.dia}
          apertura={apertura}
          marcada={valores.pagoEnLaApertura}
          alCambiar={(marcada) => {
            setValores((previos) => ({ ...previos, pagoEnLaApertura: marcada }));
          }}
        />
      )}
      <FilaDeAcciones>
        <Button type="submit">Anotar el relevamiento</Button>
        <Button variant="secundario" onClick={alCancelar}>
          Todavía no
        </Button>
      </FilaDeAcciones>
    </form>
  );
}

export interface FormularioDeUnMontoProps {
  alListo: (monto: number | null) => void;
  alCancelar: () => void;
}

function FormularioDeUnMonto({
  etiqueta,
  ayuda,
  enviar,
  alListo,
  alCancelar,
}: FormularioDeUnMontoProps & { etiqueta: string; ayuda: string; enviar: string }) {
  const [monto, setMonto] = useState<number | null>(null);
  const campo = useRef<HTMLInputElement>(null);

  useEffect(() => {
    campo.current?.focus();
  }, []);

  return (
    <form
      noValidate
      onSubmit={(evento) => {
        evento.preventDefault();
        alListo(monto);
      }}
      className="mt-3 flex flex-col gap-2.5"
    >
      <MoneyInput
        ref={campo}
        etiqueta={etiqueta}
        placeholder="Opcional"
        value={monto}
        onChange={setMonto}
        ayuda={ayuda}
      />
      <FilaDeAcciones>
        <Button type="submit">{enviar}</Button>
        <Button variant="secundario" onClick={alCancelar}>
          Todavía no
        </Button>
      </FilaDeAcciones>
    </form>
  );
}

export function FormularioDelPresupuesto(props: FormularioDeUnMontoProps) {
  return (
    <FormularioDeUnMonto
      {...props}
      etiqueta="Cuánto presupuestaste"
      ayuda="Si lo dejás vacío, lo cargás cuando lo apruebe."
      enviar="Marcar como enviado"
    />
  );
}

export interface FormularioDelPagoProps {
  apertura: string | null;
  alListo: (monto: number | null, dia: string, yaEnLaApertura: boolean) => void;
  alCancelar: () => void;
}

export function FormularioDelPago({ apertura, alListo, alCancelar }: FormularioDelPagoProps) {
  const hoy = hoyEnElTaller();
  const [monto, setMonto] = useState<number | null>(null);
  const [dia, setDia] = useState(hoy);
  const [marcada, setMarcada] = useState(true);
  const [error, setError] = useState<string | undefined>(undefined);
  const campo = useRef<HTMLInputElement>(null);
  const hayPago = monto !== null && monto > 0;

  useEffect(() => {
    campo.current?.focus();
  }, []);

  return (
    <form
      noValidate
      onSubmit={(evento) => {
        evento.preventDefault();
        const encontrado = hayPago ? errorDeLaFechaDeLaPlata(dia, hoy) : undefined;
        setError(encontrado);
        if (encontrado !== undefined) return;
        alListo(monto, dia, marcada && esAnteriorALaApertura(dia, apertura));
      }}
      className="mt-3 flex flex-col gap-2.5"
    >
      <MoneyInput
        ref={campo}
        etiqueta="Cuánto te pagó"
        placeholder="Opcional"
        value={monto}
        onChange={setMonto}
        ayuda="Si todavía no te pagó y vas a presupuestar igual, dejalo vacío."
      />
      {hayPago && (
        <>
          <Campo
            etiqueta="Qué día te pagó"
            type="date"
            max={hoy}
            value={dia}
            error={error}
            onChange={(evento) => {
              setDia(evento.target.value);
              setError(undefined);
            }}
          />
          <CasillaDeLaApertura
            fecha={dia}
            apertura={apertura}
            marcada={marcada}
            alCambiar={setMarcada}
          />
        </>
      )}
      <FilaDeAcciones>
        <Button type="submit">Pasar a presupuestar</Button>
        <Button variant="secundario" onClick={alCancelar}>
          Todavía no
        </Button>
      </FilaDeAcciones>
    </form>
  );
}
