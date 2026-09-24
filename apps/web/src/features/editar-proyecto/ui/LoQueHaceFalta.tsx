import {
  cantidadEscrita,
  cuentaDeLoQueHaceFalta,
  faseDe,
  nombreEscrito,
  segmentosDeLoQueHaceFalta,
  type SegmentoDeLoQueHaceFalta,
} from '@maun/domain';
import { useMutation } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';

import {
  catalogoDelTaller,
  conUnaNecesidadDeVuelta,
  conUnaNecesidadEditada,
  conUnaNecesidadMas,
  conUnaNecesidadTildada,
  guardadoDeLoQueHaceFalta,
  listaDelTipo,
  MUTACION_DE_PROYECTO,
  necesidadesDelProyecto,
  nombreConCantidad,
  sinUnaNecesidad,
  type Necesidad,
  type Proyecto,
} from '@/entities/proyecto';
import { useReplicaDelTaller } from '@/entities/replica';
import { mensajeDeSincronizacion, type NecesidadParaGuardar } from '@/shared/api';
import { avisarEnPantalla, metaDeAvisos, uuidv7 } from '@/shared/lib';
import { BloquePlegable, Icono } from '@/shared/ui';

import { CampoDeNecesidad } from './CampoDeNecesidad';
import { FilaDeNecesidad } from './FilaDeNecesidad';

interface ListaProps {
  segmento: SegmentoDeLoQueHaceFalta<Necesidad>;
  todas: readonly Necesidad[];
  bloqueado: boolean;
  alCambiar: (quedan: readonly NecesidadParaGuardar[], aviso?: () => void) => void;
}

function Lista({ segmento, todas, bloqueado, alCambiar }: ListaProps) {
  const lista = listaDelTipo(segmento.tipo);
  const replica = useReplicaDelTaller();
  const [nombre, setNombre] = useState('');
  const [cantidad, setCantidad] = useState('');
  const campo = useRef<HTMLDivElement>(null);

  const delTipo = segmento.items;
  const catalogo = catalogoDelTaller(replica, lista.tipo);
  const listas = segmento.listos;

  function agregar(desdeElCatalogo?: string): void {
    const escrito = nombreEscrito(desdeElCatalogo ?? nombre);
    if (escrito === '' || bloqueado) return;

    alCambiar(
      conUnaNecesidadMas(todas, {
        id: uuidv7(),
        tipo: lista.tipo,
        nombre: escrito,
        cantidad: cantidadEscrita(cantidad),
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
        texto: `Saqué ${nombreConCantidad(necesidad)} de la lista.`,
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
            <FilaDeNecesidad
              key={necesidad.id}
              necesidad={necesidad}
              lista={lista}
              bloqueado={bloqueado}
              alTildar={(listo) => {
                alCambiar(conUnaNecesidadTildada(todas, necesidad.id, listo));
              }}
              alEditar={(cambios) => {
                alCambiar(conUnaNecesidadEditada(todas, necesidad.id, cambios));
              }}
              alQuitar={() => {
                quitar(necesidad);
              }}
            />
          ))}
        </ul>
      )}

      {!bloqueado && (
        <div ref={campo} className="mt-2 flex items-start gap-2">
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            value={cantidad}
            aria-label={lista.cuantos}
            placeholder={lista.ejemploDeCantidad}
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
            className="flex size-11 flex-none items-center justify-center rounded-pill border border-border text-text-2 hover:bg-surface disabled:opacity-40"
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

  const enConsultas = faseDe(proyecto.estado) === 'consultas';
  const bloqueado = proyecto.estado === 'cobrado' || proyecto.estado === 'perdido';
  const { cuantas, listas } = cuentaDeLoQueHaceFalta(todas);

  return (
    <BloquePlegable
      titulo="Lo que hace falta"
      abiertoAlPrincipio={abiertoAlPrincipio ?? (enConsultas || proyecto.estado === 'en_curso')}
      ayuda="Los materiales y los herrajes que hay que pedir, y las herramientas que hay que tener el día que lo hagas. Se te sugieren los que ya usaste."
      resumen={
        cuantas === 0
          ? undefined
          : listas === cuantas
            ? 'todo listo'
            : `${String(listas)} de ${String(cuantas)}`
      }
    >
      {segmentosDeLoQueHaceFalta(todas).map((segmento) => (
        <Lista
          key={segmento.tipo}
          segmento={segmento}
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
