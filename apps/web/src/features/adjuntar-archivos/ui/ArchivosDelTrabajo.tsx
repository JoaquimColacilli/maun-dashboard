import { onlineManager, useQueryClient } from '@tanstack/react-query';
import { useCallback, useId, useRef, useState, type ChangeEvent } from 'react';

import {
  archivosDelProyecto,
  esImagen,
  loQueVeElCliente,
  pesoLegible,
  rutaDeLaMiniatura,
  rutaDelArchivo,
  type Archivo,
} from '@/entities/archivo';
import { useReplicaDelTaller } from '@/entities/replica';
import {
  esFalloDeRed,
  householdDe,
  mensajeDeAcceso,
  subirAlBucketDeArchivos,
  urlDelArchivo,
} from '@/shared/api';
import {
  avisarEnPantalla,
  decodificarImagen,
  ImagenIlegible,
  rutaDeCompartir,
  uuidv7,
  Ir,
} from '@/shared/lib';
import { Button, ConSalida, Icono } from '@/shared/ui';

import { anotarArchivo, borrarArchivo, mandarALaCola, opcionesDelBorrado } from '../model/acciones';
import { SIN_SENAL_PARA_ARCHIVOS, TIPOS_QUE_SE_ELIGEN } from '../model/eleccion';
import { prepararImagen } from '../model/preparacion';
import { ArchivoRechazado, subirUnArchivo, type DependenciasDeLaSubida } from '../model/subida';
import { VisorDeImagenes } from './VisorDeImagenes';

const DEPENDENCIAS: DependenciasDeLaSubida = {
  subir: subirAlBucketDeArchivos,
  decodificar: decodificarImagen,
  preparar: (imagen) => prepararImagen(imagen),
  nuevoId: uuidv7,
};

interface RecienSubido {
  nombre: string;
  original: number;
  subido: number;
}

type Subida = { fase: 'quieta' } | { fase: 'subiendo'; actual: number; total: number };

function motivoDelFallo(nombre: string, fallo: unknown): string {
  if (fallo instanceof ArchivoRechazado) return fallo.message;
  if (fallo instanceof ImagenIlegible) return `«${nombre}»: ${fallo.message}`;
  if (esFalloDeRed(fallo)) return SIN_SENAL_PARA_ARCHIVOS;
  return `«${nombre}» no se pudo subir. ${mensajeDeAcceso(fallo)}`;
}

export interface ArchivosDelTrabajoProps {
  proyectoId: string;
}

export function ArchivosDelTrabajo({ proyectoId }: ArchivosDelTrabajoProps) {
  const replica = useReplicaDelTaller();
  const cliente = useQueryClient();
  const idTitulo = useId();
  const selector = useRef<HTMLInputElement>(null);
  const [subida, setSubida] = useState<Subida>({ fase: 'quieta' });
  const [problemas, setProblemas] = useState<string[]>([]);
  const [recienSubidos, setRecienSubidos] = useState<RecienSubido[]>([]);
  const [enElVisor, setEnElVisor] = useState<string | null>(null);

  const archivos = archivosDelProyecto(replica, proyectoId);
  const imagenes = archivos.filter(esImagen);
  const documentos = archivos.filter((archivo) => !esImagen(archivo));
  const vistos = loQueVeElCliente(archivos);
  const household = householdDe(replica);
  const subiendo = subida.fase === 'subiendo';

  const cerrarElVisor = useCallback(() => {
    setEnElVisor(null);
  }, []);

  function borrar(archivo: Archivo): void {
    if (enElVisor !== null && imagenes.length <= 1) setEnElVisor(null);
    borrarArchivo(mandarALaCola(cliente), archivo, opcionesDelBorrado(cliente, archivo));
  }

  function elegir(): void {
    if (!onlineManager.isOnline()) {
      setProblemas([SIN_SENAL_PARA_ARCHIVOS]);
      return;
    }
    setProblemas([]);
    selector.current?.click();
  }

  async function alElegir(evento: ChangeEvent<HTMLInputElement>): Promise<void> {
    const elegidos = [...(evento.target.files ?? [])];
    evento.target.value = '';
    if (elegidos.length === 0 || household === undefined) return;
    if (!onlineManager.isOnline()) {
      setProblemas([SIN_SENAL_PARA_ARCHIVOS]);
      return;
    }

    const encontrados: string[] = [];
    const subidos: RecienSubido[] = [];
    setProblemas([]);
    setRecienSubidos([]);

    for (const [indice, elegido] of elegidos.entries()) {
      setSubida({ fase: 'subiendo', actual: indice + 1, total: elegidos.length });
      try {
        const resultado = await subirUnArchivo(
          elegido,
          { householdId: household.id, proyectoId },
          DEPENDENCIAS,
        );
        anotarArchivo(mandarALaCola(cliente), resultado.nuevo);
        subidos.push({
          nombre: resultado.nuevo.nombre,
          original: resultado.original,
          subido: resultado.subido,
        });
      } catch (fallo) {
        const motivo = motivoDelFallo(elegido.name, fallo);
        if (!encontrados.includes(motivo)) encontrados.push(motivo);
        if (esFalloDeRed(fallo)) break;
      }
    }

    setSubida({ fase: 'quieta' });
    setProblemas(encontrados);
    setRecienSubidos(subidos);
    if (subidos.length > 0) {
      avisarEnPantalla({
        clave: `archivos-subidos-${proyectoId}`,
        tono: 'hecho',
        texto:
          subidos.length === 1
            ? 'Archivo subido.'
            : `Se subieron ${String(subidos.length)} archivos.`,
      });
    }
  }

  return (
    <section aria-labelledby={idTitulo}>
      <div className="mb-1 flex items-baseline justify-between gap-3">
        <h2 id={idTitulo} className="text-section font-semibold">
          Archivos
        </h2>
        {vistos.total > 0 && (
          <span className="text-label text-text-2 tabular-nums">
            {vistos.total === 1 ? '1 archivo' : `${String(vistos.total)} archivos`} · el cliente ve{' '}
            {vistos.todos ? 'todos' : String(vistos.compartidos)}
          </span>
        )}
      </div>
      <p className="text-meta leading-relaxed text-text-3">
        Fotos, capturas y PDF. Las fotos se achican antes de subirse. Los videos no entran.
      </p>

      {vistos.ninguno && (
        <p className="mt-2 flex flex-wrap items-baseline gap-x-2 gap-y-1 border-t border-hairline py-3 text-label leading-relaxed text-text-2">
          <Icono nombre="eye-off" tamano={15} className="flex-none translate-y-0.5 text-text-3" />
          <span>El cliente no ve ninguno: un archivo sube privado y se comparte de a uno.</span>
          <Ir
            a={rutaDeCompartir(proyectoId)}
            className="font-medium text-ink underline decoration-hairline underline-offset-3 hover:decoration-ink"
          >
            Elegir cuáles ve
          </Ir>
        </p>
      )}

      {archivos.length === 0 && (
        <p className="mt-2 border-t border-hairline py-3 text-label text-text-2">
          Todavía no hay archivos de este trabajo.
        </p>
      )}

      {imagenes.length > 0 && (
        <div className="@container mt-2.5">
          <ul
            aria-label="Fotos e imágenes"
            className="grid grid-cols-3 gap-2 @md:grid-cols-4 @xl:grid-cols-5"
          >
            {imagenes.map((imagen) => (
              <li key={imagen.id}>
                <button
                  type="button"
                  aria-label={`Ver ${imagen.nombre}`}
                  onClick={() => {
                    setEnElVisor(imagen.id);
                  }}
                  className="block aspect-square w-full overflow-hidden rounded-field bg-surface"
                >
                  <img
                    src={urlDelArchivo(rutaDeLaMiniatura(imagen))}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    className="size-full object-cover"
                  />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {documentos.length > 0 && (
        <ul aria-label="Documentos" className="mt-2.5">
          {documentos.map((documento) => (
            <li
              key={documento.id}
              className="flex min-h-12 items-center gap-2.5 border-t border-hairline-soft"
            >
              <Icono nombre="file-text" tamano={18} className="flex-none text-text-2" />
              <a
                href={urlDelArchivo(rutaDelArchivo(documento))}
                target="_blank"
                rel="noopener noreferrer"
                className="min-w-0 flex-1 truncate text-body font-medium underline decoration-hairline underline-offset-3 hover:decoration-ink"
              >
                {documento.nombre}
              </a>
              <span className="flex-none text-meta text-text-3 tabular-nums">
                {pesoLegible(documento.bytes)}
              </span>
              <button
                type="button"
                aria-label={`Borrar «${documento.nombre}»`}
                onClick={() => {
                  borrar(documento);
                }}
                className="flex size-tap flex-none items-center justify-center rounded-field text-text-3 hover:bg-surface hover:text-alerta"
              >
                <Icono nombre="trash-2" tamano={16} />
              </button>
            </li>
          ))}
        </ul>
      )}

      <Button variant="secundario" className="mt-3 w-full" cargando={subiendo} onClick={elegir}>
        <Icono nombre="plus" tamano={16} />
        Subir fotos o PDF
      </Button>
      <input
        ref={selector}
        type="file"
        multiple
        accept={TIPOS_QUE_SE_ELIGEN}
        tabIndex={-1}
        aria-hidden
        className="sr-only"
        onChange={(evento) => {
          void alElegir(evento);
        }}
      />

      {subida.fase === 'subiendo' && (
        <p role="status" className="mt-2 text-label text-text-2">
          Subiendo {String(subida.actual)} de {String(subida.total)}…
        </p>
      )}

      {recienSubidos.length > 0 && (
        <ul aria-label="Recién subidos" className="mt-2 text-meta leading-relaxed text-text-3">
          {recienSubidos.map((subido) => (
            <li key={`${subido.nombre}-${String(subido.subido)}`}>
              {subido.nombre}:{' '}
              <span className="whitespace-nowrap">
                {subido.original === subido.subido
                  ? pesoLegible(subido.subido)
                  : `${pesoLegible(subido.original)} → ${pesoLegible(subido.subido)}`}
              </span>
            </li>
          ))}
        </ul>
      )}

      {problemas.map((problema) => (
        <p
          key={problema}
          role="alert"
          className="mt-2 text-label leading-relaxed font-medium text-alerta"
        >
          {problema}
        </p>
      ))}

      <ConSalida valor={enElVisor}>
        {(inicial) => (
          <VisorDeImagenes
            imagenes={imagenes}
            inicial={inicial}
            alCerrar={cerrarElVisor}
            alBorrar={borrar}
          />
        )}
      </ConSalida>
    </section>
  );
}
