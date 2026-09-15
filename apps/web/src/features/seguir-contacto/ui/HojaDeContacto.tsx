import { useMutation } from '@tanstack/react-query';
import { useEffect, useId, useRef, useState, type SyntheticEvent } from 'react';

import { ClienteCombobox, MUTACION_DE_CLIENTE } from '@/entities/cliente';
import {
  hijosDelProyecto,
  MUTACION_DE_PROYECTO,
  pagosDelProyecto,
  type Proyecto,
} from '@/entities/proyecto';
import { useReplicaDelTaller } from '@/entities/replica';
import { filasDe, mensajeDeSincronizacion } from '@/shared/api';
import { formatearPesos, hoyLocal, metaDeAvisos, uuidv7 } from '@/shared/lib';
import { Button, Campo, FilaDeAcciones, Hoja, MoneyInput } from '@/shared/ui';

import {
  erroresDelContacto,
  etiquetaDeLaVisita,
  hayCambiosEnElContacto,
  hayQueGuardar,
  muestraElVencimiento,
  pedidoDelContacto,
  senaEditable,
  valoresConOtraVisita,
  valoresDelContacto,
  type ErroresDelContacto,
  type ValoresDelContacto,
} from '../model/contacto';

export interface HojaDeContactoProps {
  proyecto?: Proyecto;
  visitaInicial?: string;
  enfocarLaVisita?: boolean;
  alCerrar: () => void;
  alGuardar?: (id: string) => void;
}

export function HojaDeContacto({
  proyecto,
  visitaInicial,
  enfocarLaVisita = false,
  alCerrar,
  alGuardar,
}: HojaDeContactoProps) {
  const replica = useReplicaDelTaller();
  const idCampos = useId();
  const cuerpo = useRef<HTMLDivElement>(null);
  const hoy = hoyLocal();

  const clientes = filasDe(replica, 'clientes');
  const pagos = proyecto === undefined ? [] : pagosDelProyecto(replica, proyecto.id);
  const sena = senaEditable(pagos);
  const cobrado = pagos.reduce((suma, pago) => suma + pago.monto_centavos, 0);

  const alAbrir = useRef({ id: proyecto?.id ?? uuidv7(), idDeSenaNueva: uuidv7() });
  const [iniciales] = useState<ValoresDelContacto>(() =>
    valoresDelContacto(proyecto, sena, visitaInicial),
  );
  const [valores, setValores] = useState<ValoresDelContacto>(iniciales);
  const [telefono, setTelefono] = useState<string | undefined>(undefined);
  const [errores, setErrores] = useState<ErroresDelContacto>({});
  const [rechazo, setRechazo] = useState<unknown>(null);
  const yaTermino = useRef(false);
  const enfocarAlAbrir = useRef(enfocarLaVisita);

  const guardar = useMutation({
    ...MUTACION_DE_PROYECTO,
    meta: metaDeAvisos('contactoGuardado', { errorEnPantalla: true }),
  });
  const editarCliente = useMutation(MUTACION_DE_CLIENTE);

  const cliente = clientes.find((fila) => fila.id === valores.clienteId);
  const telefonoVisible = telefono ?? cliente?.telefono ?? '';

  useEffect(() => {
    const selector = enfocarAlAbrir.current ? 'input[name="visita"]' : 'input';
    cuerpo.current?.querySelector<HTMLInputElement>(selector)?.focus();
  }, []);

  useEffect(() => {
    if (!guardar.isPaused || yaTermino.current) return;
    yaTermino.current = true;
    if (alGuardar) alGuardar(alAbrir.current.id);
    else alCerrar();
  }, [guardar.isPaused, alGuardar, alCerrar]);

  function cambiar<Campo extends keyof ValoresDelContacto>(
    campo: Campo,
    valor: ValoresDelContacto[Campo],
  ): void {
    setValores((previos) => ({ ...previos, [campo]: valor }));
    setErrores((previos) => ({
      ...previos,
      [campo === 'clienteId' ? 'cliente' : campo]: undefined,
    }));
  }

  function terminar(): void {
    if (yaTermino.current) return;
    yaTermino.current = true;
    if (alGuardar) alGuardar(alAbrir.current.id);
    else alCerrar();
  }

  function enviar(evento: SyntheticEvent<HTMLFormElement>): void {
    evento.preventDefault();
    const encontrados = erroresDelContacto(valores, telefonoVisible);
    setErrores(encontrados);
    if (Object.values(encontrados).some((mensaje) => mensaje !== undefined)) return;

    const telefonoAnterior = cliente?.telefono ?? '';
    if (telefono !== undefined && telefono.trim() !== telefonoAnterior.trim()) {
      editarCliente.mutate({
        id: valores.clienteId,
        cambios: { telefono: telefono.trim() },
        previos: { telefono: telefonoAnterior },
      });
    }

    const pedido = pedidoDelContacto({
      id: alAbrir.current.id,
      proyecto,
      valores,
      sena,
      idDeSenaNueva: alAbrir.current.idDeSenaNueva,
      hoy,
    });

    if (!hayQueGuardar(proyecto, pedido)) {
      terminar();
      return;
    }

    setRechazo(null);
    guardar.mutate(
      {
        pedido,
        previos: {
          proyecto: proyecto ?? null,
          ...hijosDelProyecto(replica, alAbrir.current.id),
        },
      },
      { onSuccess: terminar, onError: setRechazo },
    );
  }

  const esContactoSinEtapa = proyecto === undefined || proyecto.estado === 'contacto';

  return (
    <Hoja
      titulo={proyecto ? 'Editar el contacto' : 'Cargar contacto'}
      alCerrar={alCerrar}
      conCambios={hayCambiosEnElContacto(iniciales, valores, cliente?.telefono ?? '', telefono)}
    >
      {(pedirCierre) => (
        <form noValidate onSubmit={enviar} className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div
            ref={cuerpo}
            className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-5 py-4 md:px-6 md:py-5"
          >
            <ClienteCombobox
              clientes={clientes}
              elegidoId={valores.clienteId === '' ? null : valores.clienteId}
              alElegir={(elegido) => {
                cambiar('clienteId', elegido?.id ?? '');
                setTelefono(undefined);
              }}
              error={errores.cliente}
            />

            {valores.clienteId !== '' && (
              <Campo
                etiqueta="Teléfono"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                placeholder="11 5555-5555"
                value={telefonoVisible}
                onChange={(evento) => {
                  setTelefono(evento.target.value);
                }}
                error={errores.telefono}
                ayuda={
                  errores.telefono === undefined
                    ? 'Queda en el cliente: es el que usan Llamar y WhatsApp.'
                    : undefined
                }
              />
            )}

            <Campo
              etiqueta="Qué pide"
              placeholder="Placard, cocina, biblioteca…"
              maxLength={200}
              value={valores.titulo}
              onChange={(evento) => {
                cambiar('titulo', evento.target.value);
              }}
              error={errores.titulo}
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <Campo
                etiqueta={etiquetaDeLaVisita(proyecto, hoy)}
                name="visita"
                type="date"
                value={valores.visita}
                onChange={(evento) => {
                  const visita = evento.target.value;
                  setValores((previos) => valoresConOtraVisita(proyecto, previos, visita, hoy));
                }}
                ayuda={
                  esContactoSinEtapa
                    ? 'Si ya fuiste, queda a presupuestar; si es más adelante, queda agendada.'
                    : undefined
                }
              />

              {pagos.length > 1 ? (
                <div className="flex flex-col gap-1.5">
                  <span className="text-label text-text-2">Seña cobrada</span>
                  <span className="flex h-field items-center text-body-lg font-semibold tabular-nums">
                    {formatearPesos(cobrado)}
                  </span>
                  <span className="text-meta text-text-3">
                    Son {String(pagos.length)} pagos: se corrigen desde el detalle del trabajo.
                  </span>
                </div>
              ) : (
                <MoneyInput
                  etiqueta="Seña cobrada"
                  placeholder="$ 0"
                  value={valores.sena}
                  onChange={(centavos) => {
                    cambiar('sena', centavos);
                  }}
                  ayuda="Lo que te dejó en la visita. Entra a la caja del taller."
                />
              )}
            </div>

            {muestraElVencimiento(proyecto) && (
              <Campo
                etiqueta="Entregar el presupuesto antes del"
                type="date"
                value={valores.vencimiento}
                onChange={(evento) => {
                  cambiar('vencimiento', evento.target.value);
                }}
                ayuda={
                  proyecto?.estado === 'a_presupuestar'
                    ? 'Sale en la agenda hasta que lo mandes. Si cambiás el día del relevamiento se corre sola, salvo que la hayas puesto a mano.'
                    : 'Sale en la agenda hasta que marques que lo mandaste.'
                }
              />
            )}

            <div className="flex flex-col gap-1.5">
              <label htmlFor={`${idCampos}-notas`} className="text-label text-text-2">
                Notas
              </label>
              <textarea
                id={`${idCampos}-notas`}
                rows={3}
                value={valores.notas}
                onChange={(evento) => {
                  cambiar('notas', evento.target.value);
                }}
                placeholder="Lo que te dijo por teléfono, medidas, cómo llegar…"
                className="rounded-field border border-border bg-paper px-3.5 py-2.5 text-body-lg text-ink"
              />
              {errores.notas !== undefined && (
                <span role="alert" className="text-label font-medium text-alerta">
                  {errores.notas}
                </span>
              )}
            </div>

            {rechazo !== null && (
              <p role="alert" className="text-label font-medium text-alerta">
                {mensajeDeSincronizacion(rechazo)}
              </p>
            )}
          </div>

          <footer className="flex-none border-t border-hairline bg-paper px-5 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] md:px-6 md:pb-3">
            <FilaDeAcciones>
              <Button type="button" variant="secundario" onClick={pedirCierre}>
                Cancelar
              </Button>
              <Button type="submit" cargando={guardar.isPending && !guardar.isPaused}>
                {proyecto ? 'Guardar los cambios' : 'Guardar contacto'}
              </Button>
            </FilaDeAcciones>
          </footer>
        </form>
      )}
    </Hoja>
  );
}
