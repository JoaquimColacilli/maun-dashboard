import {
  DIAS_DE_ACIERTO,
  fraseDeLasCumplidas,
  fraseDeLosAciertos,
  UMBRAL_MEDIANA,
  type AnalisisDeEntregas,
  type FilaDelAnalisis,
  type GrupoPorTipo,
} from '@maun/domain';
import { useId, useMemo, useState, type ReactNode } from 'react';

import { useReplicaDelTaller } from '@/entities/replica';
import { analisisDeLaReplica } from '@/shared/api';
import {
  fechaLarga,
  hoyLocal,
  Ir,
  RUTA_DEL_HISTORIAL,
  rutaDelProyecto,
  useVolver,
} from '@/shared/lib';
import { Button, EstadoVacio, Icono, Pagina } from '@/shared/ui';

import {
  cuantosTrabajos,
  desvioEnPalabras,
  enDias,
  hayAlgoPorCarga,
  resumenDeLosDias,
  resumenDelDesvio,
} from '../model/textos';

const TARJETA = 'rounded-panel border border-hairline bg-paper px-4 py-4 md:px-5';

function Seccion({
  titulo,
  bajada,
  children,
}: {
  titulo: string;
  bajada?: string;
  children: ReactNode;
}) {
  const id = useId();
  return (
    <section aria-labelledby={id} className={TARJETA}>
      <h2 id={id} className="text-section font-semibold">
        {titulo}
      </h2>
      {bajada !== undefined && (
        <p className="mt-0.5 text-label leading-relaxed text-text-2">{bajada}</p>
      )}
      <div className="mt-3">{children}</div>
    </section>
  );
}

function Dato({ clave, valor }: { clave: string; valor: string }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 border-t border-hairline-soft py-2.5 first:border-t-0">
      <dt className="text-label text-text-2">{clave}</dt>
      <dd className="text-body font-medium tabular-nums">{valor}</dd>
    </div>
  );
}

function Precision({ analisis }: { analisis: AnalisisDeEntregas }) {
  const { precision } = analisis;
  return (
    <Seccion
      titulo="Qué tan preciso sos estimando"
      bajada="La primera fecha estimada de cada trabajo contra el día en que lo entregaste."
    >
      <p className="text-body-lg leading-snug font-medium text-pretty">{precision.frase}</p>
      {precision.desvio.modo === 'mediana' && (
        <p className="mt-1.5 text-label leading-relaxed text-text-2">
          El más adelantado, {desvioEnPalabras(precision.desvio.minimo)}; el más atrasado,{' '}
          {desvioEnPalabras(precision.desvio.maximo)}.
        </p>
      )}
      {precision.aciertos !== null && (
        <p className="mt-2 text-body leading-relaxed">
          {fraseDeLosAciertos(precision.aciertos)}{' '}
          <span className="text-text-2">
            Acertar es entregar hasta {String(DIAS_DE_ACIERTO)} días antes o después.
          </span>
        </p>
      )}
      {precision.cumplidas !== null && (
        <p className="mt-2 text-body leading-relaxed">{fraseDeLasCumplidas(precision.cumplidas)}</p>
      )}
      {precision.importadas > 0 && (
        <p className="mt-2 text-label leading-relaxed text-text-3">
          En {cuantosTrabajos(precision.importadas)} la estimada es la que tenían cargada el día en
          que la app empezó a guardar la historia de las fechas, no necesariamente la primera que
          diste.
        </p>
      )}
    </Seccion>
  );
}

function Grupo({ grupo }: { grupo: GrupoPorTipo }) {
  return (
    <li className="border-t border-hairline-soft py-3 first:border-t-0 first:pt-0">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-body-lg font-semibold">{grupo.nombre}</span>
        <span className="text-label text-text-2 tabular-nums">
          {cuantosTrabajos(grupo.trabajos)}
        </span>
      </div>
      <dl className="mt-1">
        {grupo.demora.n > 0 && (
          <Dato clave="Del arranque a la entrega" valor={resumenDeLosDias(grupo.demora)} />
        )}
        {grupo.fabricacion.n > 0 && (
          <Dato clave="Del arranque a listo" valor={resumenDeLosDias(grupo.fabricacion)} />
        )}
        {grupo.desvio.n > 0 && (
          <Dato clave="Contra lo estimado" valor={resumenDelDesvio(grupo.desvio)} />
        )}
      </dl>
    </li>
  );
}

function PorTipo({ analisis }: { analisis: AnalisisDeEntregas }) {
  const { porTipo, sinTipo } = analisis;
  return (
    <Seccion
      titulo="Cuánto tardás por tipo de proyecto"
      bajada={`Con menos de ${String(UMBRAL_MEDIANA)} trabajos de un tipo ves cada caso; desde ahí, la mediana.`}
    >
      {porTipo.length === 0 ? (
        <p className="text-body leading-relaxed text-text-2">
          Ningún trabajo entregado tiene el tipo de proyecto. Ponéselo en la ficha, con «Editar», y
          acá los vas a ver agrupados.
        </p>
      ) : (
        <ul className="list-none">
          {porTipo.map((grupo) => (
            <Grupo key={grupo.clave} grupo={grupo} />
          ))}
        </ul>
      )}
      {sinTipo !== null && porTipo.length > 0 && (
        <p className="mt-3 text-label leading-relaxed text-text-2">
          {cuantosTrabajos(sinTipo.trabajos)} sin tipo: ponéselo en su ficha para que cuenten acá.
        </p>
      )}
    </Seccion>
  );
}

function PorCarga({ analisis }: { analisis: AnalisisDeEntregas }) {
  if (!hayAlgoPorCarga(analisis.porCarga)) return null;
  return (
    <Seccion
      titulo="Según cuántos trabajos tenías en curso"
      bajada="Del arranque a la entrega, según cuántos otros trabajos había en el taller cuando lo aprobaste."
    >
      <dl>
        {analisis.porCarga
          .filter((grupo) => grupo.demora.n > 0)
          .map((grupo) => (
            <Dato
              key={grupo.nombre}
              clave={`${grupo.nombre} en curso`}
              valor={resumenDeLosDias(grupo.demora)}
            />
          ))}
      </dl>
    </Seccion>
  );
}

function FilaDelTrabajo({ fila, hoy }: { fila: FilaDelAnalisis; hoy: string }) {
  return (
    <li className="border-t border-hairline-soft py-3 first:border-t-0 first:pt-0">
      <Ir
        a={rutaDelProyecto(fila.id)}
        className="text-body font-semibold underline decoration-hairline underline-offset-2 hover:decoration-ink"
      >
        {fila.titulo}
      </Ir>
      <span className="ml-2 text-label text-text-3">{fila.tipo ?? 'Sin tipo'}</span>
      <dl className="mt-1 grid grid-cols-1 gap-x-6 gap-y-0.5 text-label @md:grid-cols-2">
        <div className="flex gap-1.5">
          <dt className="text-text-2">Estimada</dt>
          <dd className="font-medium tabular-nums">
            {fila.primeraEstimada === null ? 'Sin fecha' : fechaLarga(fila.primeraEstimada, hoy)}
          </dd>
        </div>
        <div className="flex gap-1.5">
          <dt className="text-text-2">Entregado</dt>
          <dd className="font-medium tabular-nums">
            {fechaLarga(fila.entregado, hoy)}
            {fila.desvio !== null && `, ${desvioEnPalabras(fila.desvio)}`}
          </dd>
        </div>
        {fila.comprometida !== null && (
          <div className="flex gap-1.5">
            <dt className="text-text-2">Comprometida</dt>
            <dd className="font-medium tabular-nums">
              {fechaLarga(fila.comprometida, hoy)}, {fila.cumplida === true ? 'cumplida' : 'no'}
            </dd>
          </div>
        )}
        {fila.demora !== null && (
          <div className="flex gap-1.5">
            <dt className="text-text-2">Tardó</dt>
            <dd className="font-medium tabular-nums">{enDias(fila.demora)}</dd>
          </div>
        )}
      </dl>
    </li>
  );
}

function TrabajoPorTrabajo({ analisis, hoy }: { analisis: AnalisisDeEntregas; hoy: string }) {
  const pocos = analisis.trabajos.length < UMBRAL_MEDIANA;
  const [elegido, setElegido] = useState<boolean | null>(null);
  const abierto = pocos || (elegido ?? false);
  const id = useId();
  return (
    <Seccion
      titulo="Trabajo por trabajo"
      bajada={`${cuantosTrabajos(analisis.trabajos.length)} entregados, del más nuevo al más viejo.`}
    >
      {!pocos && (
        <Button
          variant="secundario"
          size="chico"
          aria-expanded={abierto}
          aria-controls={id}
          onClick={() => {
            setElegido(!abierto);
          }}
        >
          <Icono nombre={abierto ? 'chevron-up' : 'chevron-down'} tamano={16} />
          {abierto ? 'Esconder los números' : 'Ver los números'}
        </Button>
      )}
      <div id={id} hidden={!abierto} className={`@container ${pocos ? '' : 'mt-3'}`}>
        <ul className="list-none">
          {analisis.trabajos.map((fila) => (
            <FilaDelTrabajo key={fila.id} fila={fila} hoy={hoy} />
          ))}
        </ul>
        {analisis.sinFecha > 0 && (
          <p className="mt-3 text-label leading-relaxed text-text-3">
            {cuantosTrabajos(analisis.sinFecha)} entregados sin el día de la entrega cargado no
            entran en la cuenta.
          </p>
        )}
      </div>
    </Seccion>
  );
}

export function AnaliticoPage() {
  const replica = useReplicaDelTaller();
  const hoy = hoyLocal();
  const analisis = useMemo(() => analisisDeLaReplica(replica), [replica]);
  const vuelta = useVolver(RUTA_DEL_HISTORIAL, 'Historial');

  return (
    <Pagina className="gap-3 md:gap-4">
      <Ir
        a={RUTA_DEL_HISTORIAL}
        alTocar={vuelta.volver}
        className="-ml-1 flex min-h-tap w-fit items-center gap-1 rounded-pill pr-3 pl-1 text-body font-medium text-text-2 hover:bg-ink/5"
      >
        <Icono nombre="chevron-left" tamano={20} />
        {vuelta.etiqueta}
      </Ir>
      <header className="flex flex-col gap-1">
        <h1 className="font-display text-h1 leading-tight lg:text-h1-lg">Analítico de entregas</h1>
        <p className="max-w-[60ch] text-body leading-relaxed text-text-2">
          Qué tan cerca quedás de la fecha que estimás y cuánto tardás en cada tipo de mueble. No te
          muestra cuentas que los datos todavía no sostienen.
        </p>
      </header>

      {analisis.trabajos.length === 0 ? (
        <EstadoVacio
          ilustracion="sin-historial"
          titulo="Todavía no hay entregas para comparar"
          detalle="Cuando entregues un trabajo con su fecha estimada, acá vas a ver qué tan cerca quedaste y cuánto tardás en cada tipo de proyecto."
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 md:gap-4 lg:grid-cols-2 lg:items-start">
          <div className="flex flex-col gap-3 md:gap-4">
            <Precision analisis={analisis} />
            <PorTipo analisis={analisis} />
            <PorCarga analisis={analisis} />
          </div>
          <TrabajoPorTrabajo analisis={analisis} hoy={hoy} />
        </div>
      )}
    </Pagina>
  );
}
