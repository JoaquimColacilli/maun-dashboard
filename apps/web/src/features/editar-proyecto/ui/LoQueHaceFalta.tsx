import { faseDe } from '@maun/domain';
import { useMutation } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';

import {
  catalogoDelTaller,
  conUnaNecesidadDeVuelta,
  conUnaNecesidadMas,
  conUnaNecesidadTildada,
  cuantasListas,
  guardadoDeLoQueHaceFalta,
  LISTAS_DEL_TRABAJO,
  MUTACION_DE_PROYECTO,
  necesidadesDelProyecto,
  necesidadesPorTipo,
  sinUnaNecesidad,
  type Necesidad,
  type Proyecto,
  type TipoDeLaLista,
} from '@/entities/proyecto';
import { useReplicaDelTaller } from '@/entities/replica';
import { mensajeDeSincronizacion, type NecesidadParaGuardar } from '@/shared/api';
import { avisarEnPantalla, metaDeAvisos, uuidv7 } from '@/shared/lib';
import { BloquePlegable, Icono } from '@/shared/ui';

import { CampoDeNecesidad } from './CampoDeNecesidad';

const CANTIDAD_MAXIMA = 999;

function conCantidad(necesidad: Necesidad): string {
  return necesidad.cantidad === null
    ? necesidad.nombre
    : `${String(necesidad.cantidad)} ${necesidad.nombre}`;
}

interface ListaProps {
  lista: TipoDeLaLista;
  todas: readonly Necesidad[];
  bloqueado: boolean;
  alCambiar: (quedan: readonly NecesidadParaGuardar[], aviso?: () => void) => void;
}

function Lista({ lista, todas, bloqueado, alCambiar }: ListaProps) {
  const replica = useReplicaDelTaller();
  const [nombre, setNombre] = useState('');
  const [cantidad, setCantidad] = useState('');
  const campo = useRef<HTMLDivElement>(null);

  const delTipo = necesidadesPorTipo(todas, lista.tipo);
  const catalogo = catalogoDelTaller(replica, lista.tipo);
  const listas = cuantasListas(delTipo);

  function agregar(desdeElCatalogo?: string): void {
    const escrito = (desdeElCatalogo ?? nombre).trim();
    if (escrito === '' || bloqueado) return;
    const numero = Number(cantidad.trim());
    const cuantos =
      lista.conCantidad && cantidad.trim() !== '' && Number.isInteger(numero) && numero > 0
        ? Math.min(numero, CANTIDAD_MAXIMA)
        : null;

    alCambiar(
      conUnaNecesidadMas(todas, {
        id: uuidv7(),
        tipo: lista.tipo,
        nombre: escrito,
        cantidad: cuantos,
      }),
    );
    setNombre('');
    setCantidad('');
    campo.current?.querySelector('input')?.focus();
  }

  function quitar(necesidad: Necesidad): void {
    alCambiar(sinUnaNecesidad(todas, necesidad.id), () => {
      avisarEnPantalla({
        clave: `necesidad:${necesidad.id}`,
        tono: 'hecho',
        texto: `Saqué ${conCantidad(necesidad)} de la lista.`,
        accion: {
          etiqueta: 'Deshacer',
          alTocar: () => {
            alCambiar(conUnaNecesidadDeVuelta(todas, necesidad));
          },
        },
      });
    });
  }

  return (
    <section aria-label={lista.titulo} className="mt-3 first:mt-0">
      <div className="mb-1 flex items-baseline justify-between gap-3">
        <h3 className="text-label font-semibold">{lista.titulo}</h3>
        {delTipo.length > 0 && (
          <span className="text-meta text-text-2 tabular-nums">
            {listas > 0
              ? `${String(listas)} de ${String(delTipo.length)} ${lista.listos}`
              : `${String(delTipo.length)} ${delTipo.length === 1 ? 'cosa' : 'cosas'}`}
          </span>
        )}
      </div>

      {delTipo.length === 0 ? (
        <p className="border-t border-hairline-soft py-2.5 text-label text-text-2">{lista.ayuda}</p>
      ) : (
        <ul className="list-none">
          {delTipo.map((necesidad) => (
            <li
              key={necesidad.id}
              data-necesidad={necesidad.id}
              data-listo={String(necesidad.listo)}
              className="flex items-center gap-2.5 border-t border-hairline-soft"
            >
              <label className="flex min-h-11 min-w-0 flex-1 cursor-pointer items-center gap-2.5 py-1">
                <input
                  type="checkbox"
                  checked={necesidad.listo}
                  disabled={bloqueado}
                  aria-label={`${lista.listo}: ${conCantidad(necesidad)}`}
                  onChange={(evento) => {
                    alCambiar(conUnaNecesidadTildada(todas, necesidad.id, evento.target.checked));
                  }}
                  className="size-5 flex-none accent-ink"
                />
                <span className="flex min-w-0 items-baseline gap-1.5">
                  {necesidad.cantidad !== null && (
                    <span
                      className={`flex-none text-body font-semibold tabular-nums ${
                        necesidad.listo ? 'text-text-3' : 'text-ink'
                      }`}
                    >
                      {necesidad.cantidad}
                    </span>
                  )}
                  <span
                    className={`min-w-0 text-body ${
                      necesidad.listo ? 'text-text-3 line-through' : 'text-ink'
                    }`}
                  >
                    {necesidad.nombre}
                  </span>
                </span>
              </label>
              <button
                type="button"
                disabled={bloqueado}
                aria-label={`Sacar ${conCantidad(necesidad)} de la lista`}
                onClick={() => {
                  quitar(necesidad);
                }}
                className="flex size-10 flex-none items-center justify-center rounded-field text-text-3 hover:bg-surface hover:text-alerta"
              >
                <Icono nombre="trash-2" tamano={16} />
              </button>
            </li>
          ))}
        </ul>
      )}

      {!bloqueado && (
        <div ref={campo} className="mt-2 flex items-start gap-2">
          {lista.conCantidad && (
            <input
              type="text"
              inputMode="numeric"
              value={cantidad}
              aria-label={lista.cuantos}
              placeholder="6"
              maxLength={3}
              onChange={(evento) => {
                setCantidad(evento.target.value.replace(/\D/g, ''));
              }}
              onKeyDown={(evento) => {
                if (evento.key === 'Enter') {
                  evento.preventDefault();
                  agregar();
                }
              }}
              className="h-11 w-14 flex-none rounded-field border border-border bg-paper px-2 text-center text-body-lg text-ink tabular-nums"
            />
          )}
          <div
            className="flex min-w-0 flex-1"
            onKeyDown={(evento) => {
              if (evento.key !== 'Enter') return;
              evento.preventDefault();
              agregar();
            }}
          >
            <CampoDeNecesidad
              etiqueta={lista.campo}
              placeholder={lista.placeholder}
              catalogo={catalogo}
              yaCargados={delTipo}
              valor={nombre}
              alEscribir={setNombre}
              alElegir={(elegido) => {
                agregar(elegido);
              }}
            />
          </div>
          <button
            type="button"
            aria-label={lista.agregar}
            disabled={nombre.trim() === ''}
            // Sin esto, apretar el botón le saca el foco al campo primero y lo escrito se pierde
            // antes de que llegue el click. Además deja el cursor adentro para el ítem siguiente.
            onMouseDown={(toque) => {
              toque.preventDefault();
            }}
            onClick={() => {
              agregar();
            }}
            className="flex size-11 flex-none items-center justify-center rounded-field border border-border text-text-2 hover:bg-surface disabled:opacity-40"
          >
            <Icono nombre="plus" tamano={18} />
          </button>
        </div>
      )}
    </section>
  );
}

export interface LoQueHaceFaltaProps {
  proyecto: Proyecto;
  abiertoAlPrincipio?: boolean;
}

export function LoQueHaceFalta({ proyecto, abiertoAlPrincipio }: LoQueHaceFaltaProps) {
  const replica = useReplicaDelTaller();
  const todas = necesidadesDelProyecto(replica, proyecto.id);

  const ultimo = useRef({ proyecto, todas });
  useEffect(() => {
    ultimo.current = { proyecto, todas };
  });

  const guardar = useMutation({
    ...MUTACION_DE_PROYECTO,
    meta: metaDeAvisos('loQueHaceFalta', { silencioso: true, sujeto: proyecto.titulo }),
  });

  function alCambiar(quedan: readonly NecesidadParaGuardar[], aviso?: () => void): void {
    const actual = ultimo.current;
    guardar.mutate(guardadoDeLoQueHaceFalta(actual.proyecto, actual.todas, quedan));
    aviso?.();
  }

  const enSeguimiento = faseDe(proyecto.estado) === 'seguimiento';
  const bloqueado = proyecto.estado === 'cobrado' || proyecto.estado === 'perdido';
  const cuantas = todas.length;
  const listas = cuantasListas(todas);

  return (
    <BloquePlegable
      titulo="Lo que hace falta"
      abiertoAlPrincipio={abiertoAlPrincipio ?? (enSeguimiento || proyecto.estado === 'en_curso')}
      ayuda="Los herrajes que hay que pedir y las herramientas que hay que tener el día que lo hagas. Se te sugieren los que ya usaste."
      resumen={
        cuantas === 0
          ? undefined
          : listas === cuantas
            ? 'todo listo'
            : `${String(listas)} de ${String(cuantas)}`
      }
    >
      {LISTAS_DEL_TRABAJO.map((lista) => (
        <Lista
          key={lista.tipo}
          lista={lista}
          todas={todas}
          bloqueado={bloqueado}
          alCambiar={alCambiar}
        />
      ))}

      {bloqueado && (
        <p className="mt-2.5 text-meta leading-normal text-text-3">
          Este trabajo está cerrado: la lista queda como quedó.
        </p>
      )}

      {guardar.isError && (
        <p role="alert" className="mt-1.5 text-label font-medium text-alerta">
          {mensajeDeSincronizacion(guardar.error)}
        </p>
      )}
    </BloquePlegable>
  );
}
