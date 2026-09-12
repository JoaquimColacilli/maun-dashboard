import { formatearCuit } from '@maun/domain';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { useEffect, useId, useRef } from 'react';
import { useForm, useWatch, type SubmitHandler } from 'react-hook-form';

import {
  advertenciaDeCuit,
  cambiosDeCliente,
  CONDICION,
  CONDICIONES_EN_ORDEN,
  datosDelFormulario,
  esquemaDeCliente,
  etiquetaDeCuit,
  MUTACION_DE_CLIENTE,
  MUTACION_DE_CLIENTE_NUEVO,
  ORIGEN,
  ORIGENES_EN_ORDEN,
  pideDatosFiscales,
  valoresDelFormulario,
  type Cliente,
  type FormularioDeCliente,
} from '@/entities/cliente';
import { mensajeDeSincronizacion, type DatosDeCliente } from '@/shared/api';
import { uuidv7 } from '@/shared/lib';
import { Button, Campo, Hoja } from '@/shared/ui';

export interface HojaDeClienteProps {
  cliente?: Cliente;
  nombreInicial?: string;
  alCerrar: () => void;
  alGuardar?: (id: string, nombre: string) => void;
}

export function HojaDeCliente({ cliente, nombreInicial, alCerrar, alGuardar }: HojaDeClienteProps) {
  const idTitulo = useId();
  const primerCampo = useRef<HTMLInputElement>(null);

  const crear = useMutation(MUTACION_DE_CLIENTE_NUEVO);
  const editar = useMutation(MUTACION_DE_CLIENTE);
  const enVuelo = crear.isPending || editar.isPending;
  const fallo: unknown = crear.error ?? editar.error;

  const {
    register,
    handleSubmit,
    control,
    setValue,
    formState: { errors },
  } = useForm<FormularioDeCliente>({
    resolver: zodResolver(esquemaDeCliente),
    defaultValues: {
      ...valoresDelFormulario(cliente),
      ...(nombreInicial === undefined ? {} : { nombre: nombreInicial }),
    },
  });

  const condicion = useWatch({ control, name: 'condicion_fiscal' });
  const origen = useWatch({ control, name: 'origen_contacto' });
  const cuit = useWatch({ control, name: 'cuit' });
  const advertencia = advertenciaDeCuit(cuit);

  useEffect(() => {
    primerCampo.current?.focus();
  }, []);

  const guardar: SubmitHandler<FormularioDeCliente> = (valores) => {
    const datos: DatosDeCliente = datosDelFormulario(valores);

    if (cliente) {
      const cambios = cambiosDeCliente(valoresDelFormulario(cliente), datos);
      const previos = cambiosDeCliente(datos, valoresDelFormulario(cliente));
      if (Object.keys(cambios).length > 0) {
        editar.mutate({ id: cliente.id, cambios, previos });
      }
      alGuardar?.(cliente.id, datos.nombre);
    } else {
      const id = uuidv7();
      crear.mutate({ ...datos, id });
      alGuardar?.(id, datos.nombre);
    }
    alCerrar();
  };

  const { ref: refDelNombre, ...restoDelNombre } = register('nombre');

  return (
    <Hoja titulo={cliente ? 'Editar cliente' : 'Cliente nuevo'} alCerrar={alCerrar} ancho="amplio">
      <form
        noValidate
        onSubmit={(evento) => {
          void handleSubmit(guardar)(evento);
        }}
        className="flex min-h-0 flex-1 flex-col overflow-hidden"
      >
        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-5 py-4 md:px-6 md:py-5">
          <Campo
            {...restoDelNombre}
            ref={(nodo) => {
              refDelNombre(nodo);
              primerCampo.current = nodo;
            }}
            etiqueta="Nombre"
            autoComplete="name"
            placeholder="Como lo tenés agendado"
            error={errors.nombre?.message}
          />

          <div className="grid gap-4 md:grid-cols-2">
            <Campo
              {...register('telefono')}
              etiqueta="Teléfono"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="11 5555-5555"
              error={errors.telefono?.message}
            />
            <Campo
              {...register('zona')}
              etiqueta="Zona"
              autoComplete="address-level2"
              placeholder="Localidad o barrio"
              error={errors.zona?.message}
            />
          </div>

          <Campo
            {...register('email')}
            etiqueta="Email"
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="Opcional"
            error={errors.email?.message}
          />

          <Campo
            {...register('direccion')}
            etiqueta="Dirección"
            autoComplete="street-address"
            placeholder="Calle y número, localidad"
            error={errors.direccion?.message}
          />

          <div className="flex flex-col gap-1.5">
            <label htmlFor={`${idTitulo}-origen`} className="text-label text-text-2">
              Cómo llegó
            </label>
            <select
              {...register('origen_contacto', {
                setValueAs: (valor: string) => (valor === '' ? null : valor),
              })}
              id={`${idTitulo}-origen`}
              className="h-field rounded-field border border-border bg-paper px-3 text-body-lg text-ink"
            >
              <option value="">Sin especificar</option>
              {ORIGENES_EN_ORDEN.map((id) => (
                <option key={id} value={id}>
                  {ORIGEN[id].etiqueta}
                </option>
              ))}
            </select>
          </div>

          {origen !== null && (
            <Campo
              {...register('origen_detalle')}
              etiqueta={origen === 'referido' ? 'Quién lo refirió' : 'Detalle'}
              placeholder={
                origen === 'referido' ? 'Nombre de quien lo recomendó' : 'Lo que quieras anotar'
              }
              error={errors.origen_detalle?.message}
            />
          )}

          <fieldset className="flex flex-col gap-1.5">
            <legend className="mb-1.5 text-label text-text-2">Condición frente al IVA</legend>
            <div className="grid grid-cols-4 gap-0.5 rounded-field bg-surface p-1">
              {CONDICIONES_EN_ORDEN.map((id) => (
                <button
                  key={id}
                  type="button"
                  role="radio"
                  aria-checked={condicion === id}
                  aria-label={CONDICION[id].etiqueta}
                  onClick={() => {
                    setValue('condicion_fiscal', id, { shouldDirty: true });
                  }}
                  className={`min-h-tap rounded-control text-label ${
                    condicion === id
                      ? 'bg-elevado font-semibold text-ink shadow-float'
                      : 'font-medium text-text-2'
                  }`}
                >
                  {CONDICION[id].corto}
                </button>
              ))}
            </div>
            <span className="text-meta text-text-3">
              {CONDICION[condicion].etiqueta}. Emite {CONDICION[condicion].comprobante}.
            </span>
          </fieldset>

          {pideDatosFiscales(condicion) && (
            <>
              <div className="grid gap-4 md:grid-cols-2">
                <Campo
                  {...register('cuit', {
                    onBlur: (evento: { target: { value: string } }) => {
                      setValue('cuit', formatearCuit(evento.target.value));
                    },
                  })}
                  etiqueta={etiquetaDeCuit(condicion)}
                  inputMode="numeric"
                  placeholder="20-12345678-9"
                  className="tabular-nums"
                  error={errors.cuit?.message}
                  ayuda={errors.cuit?.message === undefined ? advertencia : undefined}
                />
                <Campo
                  {...register('razon_social')}
                  etiqueta="Razón social"
                  autoComplete="organization"
                  placeholder="Si factura a una empresa"
                  error={errors.razon_social?.message}
                />
              </div>
              <Campo
                {...register('domicilio_fiscal')}
                etiqueta="Domicilio fiscal"
                placeholder="Si es distinto de la dirección"
                error={errors.domicilio_fiscal?.message}
              />
            </>
          )}

          <div className="flex flex-col gap-1.5">
            <label htmlFor={`${idTitulo}-notas`} className="text-label text-text-2">
              Notas
            </label>
            <textarea
              {...register('notas')}
              id={`${idTitulo}-notas`}
              rows={3}
              placeholder="Lo que convenga recordar de este cliente"
              className="rounded-field border border-border bg-paper px-3.5 py-2.5 text-body-lg text-ink"
            />
          </div>

          {fallo !== null && fallo !== undefined && (
            <p role="alert" className="text-label font-medium text-alerta">
              {mensajeDeSincronizacion(fallo)}
            </p>
          )}
        </div>

        <footer className="flex flex-none items-center gap-2.5 border-t border-hairline bg-paper px-5 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] md:px-6 md:pb-3">
          <Button type="button" variant="secundario" onClick={alCerrar}>
            Cancelar
          </Button>
          <Button type="submit" cargando={enVuelo} className="flex-1">
            {cliente ? 'Guardar los cambios' : 'Guardar cliente'}
          </Button>
        </footer>
      </form>
    </Hoja>
  );
}
