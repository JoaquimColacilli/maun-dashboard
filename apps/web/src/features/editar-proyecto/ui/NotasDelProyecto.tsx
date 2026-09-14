import { useMutation } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';

import { MUTACION_DE_NOTAS, type Proyecto } from '@/entities/proyecto';
import { mensajeDeSincronizacion } from '@/shared/api';
import { useAlgoEnCurso } from '@/shared/lib';
import { Icono } from '@/shared/ui';

const DEMORA_DE_LAS_NOTAS_MS = 900;

export interface NotasDelProyectoProps {
  proyecto: Proyecto;
  titulo: string;
  placeholder: string;
}

export function NotasDelProyecto({ proyecto, titulo, placeholder }: NotasDelProyectoProps) {
  const guardarNotas = useMutation(MUTACION_DE_NOTAS);
  const [notas, setNotas] = useState<string | null>(null);
  const [sinGuardar, setSinGuardar] = useState(false);
  const reloj = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useAlgoEnCurso(sinGuardar);

  useEffect(
    () => () => {
      clearTimeout(reloj.current);
    },
    [],
  );

  const notasVisibles = notas ?? proyecto.notas;

  function alEscribirNotas(texto: string): void {
    setNotas(texto);
    setSinGuardar(true);
    clearTimeout(reloj.current);
    reloj.current = setTimeout(() => {
      setSinGuardar(false);
      guardarNotas.mutate({
        id: proyecto.id,
        cambios: { notas: texto.trim() },
        previos: { notas: proyecto.notas },
        version: proyecto.version,
      });
    }, DEMORA_DE_LAS_NOTAS_MS);
  }

  const estadoDeLasNotas = guardarNotas.isPaused
    ? {
        texto: 'Sin señal: se guarda cuando vuelva',
        icono: 'cloud-off' as const,
        tono: 'text-text-2',
      }
    : guardarNotas.isPending
      ? { texto: 'Guardando…', icono: 'arrow-up-down' as const, tono: 'text-text-2' }
      : guardarNotas.isError
        ? { texto: 'No se pudo guardar', icono: 'triangle-alert' as const, tono: 'text-alerta' }
        : guardarNotas.isSuccess
          ? { texto: 'Guardado', icono: 'check' as const, tono: 'text-hogar' }
          : undefined;

  return (
    <section aria-label={titulo}>
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <h2 className="text-section font-semibold">{titulo}</h2>
        {estadoDeLasNotas !== undefined && (
          <span
            role="status"
            className={`flex items-center gap-1.5 text-meta ${estadoDeLasNotas.tono}`}
          >
            <Icono nombre={estadoDeLasNotas.icono} tamano={13} />
            {estadoDeLasNotas.texto}
          </span>
        )}
      </div>
      <textarea
        value={notasVisibles}
        onChange={(evento) => {
          alEscribirNotas(evento.target.value);
        }}
        rows={Math.max(4, notasVisibles.split('\n').length + 1)}
        aria-label={titulo}
        placeholder={placeholder}
        className="block w-full resize-y rounded-field border border-hairline bg-paper-notas px-3.5 py-2.5 text-body-lg text-ink focus:border-ink"
      />
      {guardarNotas.isError && (
        <p role="alert" className="mt-1.5 text-label font-medium text-alerta">
          {mensajeDeSincronizacion(guardarNotas.error)}
        </p>
      )}
    </section>
  );
}
