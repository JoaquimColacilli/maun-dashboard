import { describirEstadoSync, useEstadoSync } from '@/shared/lib';
import { Button } from '@/shared/ui';

const TESOROS = [
  {
    id: 'hogar',
    nombre: 'Hogar',
    uso: 'La plata de la familia',
    clases: 'bg-hogar-tint text-hogar',
  },
  { id: 'maun', nombre: 'Maun', uso: 'La caja del taller', clases: 'bg-maun-tint text-maun' },
  {
    id: 'diezmo',
    nombre: 'Diezmo',
    uso: '10% de cada ganancia',
    clases: 'bg-diezmo-tint text-diezmo',
  },
  {
    id: 'cocos',
    nombre: 'Cocos',
    uso: 'Ahorro para la casa propia',
    clases: 'bg-cocos-tint text-cocos',
  },
] as const;

const TIPOGRAFIA = [
  { nombre: 'Wordmark', clases: 'font-display text-wordmark leading-tight', muestra: 'MAUN' },
  {
    nombre: 'Título de pantalla',
    clases: 'font-display text-h1 leading-tight lg:text-h1-lg',
    muestra: 'Proyectos',
  },
  {
    nombre: 'Cifra grande',
    clases: 'text-money-xl leading-tight font-semibold tracking-[-0.02em] tabular-nums',
    muestra: '$10.000.000',
  },
  {
    nombre: 'Cifra de tarjeta',
    clases: 'text-money-lg font-semibold tabular-nums lg:text-money-lg-desktop',
    muestra: '$1.240.000',
  },
  { nombre: 'Título de sección', clases: 'text-section font-semibold', muestra: 'Pagos recibidos' },
  {
    nombre: 'Cuerpo',
    clases: 'text-body leading-relaxed',
    muestra: 'Faltan $1.800.000 para cubrir el sueldo de septiembre.',
  },
  { nombre: 'Label', clases: 'text-label text-text-2', muestra: 'Entrega estimada' },
  {
    nombre: 'Meta',
    clases: 'text-meta font-medium text-text-2 tabular-nums',
    muestra: 'vie 12 sep, hace 9 días',
  },
] as const;

export function VerificacionPage() {
  const estadoSync = useEstadoSync();

  return (
    <main className="mx-auto flex max-w-content flex-col gap-12 px-(--page-pad-mobile) py-8 md:px-(--page-pad-tablet) lg:px-(--page-pad-desktop)">
      <header className="flex max-w-[720px] flex-col gap-2">
        <h1 className="font-display text-h1 leading-tight lg:text-h1-lg">
          Verificación del sistema de diseño
        </h1>
        <p className="text-body leading-relaxed text-text-2">
          Pantalla técnica, no de negocio. Si ves IBM Plex Sans, Young Serif y los colores de los
          cuatro tesoros, Tailwind está tomando los tokens de @maun/ui.
        </p>
      </header>

      <section aria-labelledby="titulo-tesoros" className="flex flex-col gap-3.5">
        <h2 id="titulo-tesoros" className="text-section font-semibold">
          Tesoros
        </h2>
        <ul className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
          {TESOROS.map((tesoro) => (
            <li
              key={tesoro.id}
              className={`flex min-h-[118px] flex-col justify-between gap-3 rounded-panel p-3.5 ${tesoro.clases}`}
            >
              <span className="text-label font-semibold">{tesoro.nombre}</span>
              <span className="text-meta text-text-2">{tesoro.uso}</span>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="titulo-tipografia" className="flex flex-col gap-3.5">
        <h2 id="titulo-tipografia" className="text-section font-semibold">
          Tipografía
        </h2>
        <dl className="flex flex-col">
          {TIPOGRAFIA.map((tipo) => (
            <div
              key={tipo.nombre}
              className="grid gap-1 border-t border-hairline-soft py-3.5 md:grid-cols-[200px_1fr] md:items-baseline md:gap-5"
            >
              <dt className="text-meta text-text-2">{tipo.nombre}</dt>
              <dd className={tipo.clases}>{tipo.muestra}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section aria-labelledby="titulo-botones" className="flex flex-col gap-3.5">
        <h2 id="titulo-botones" className="text-section font-semibold">
          Botones
        </h2>
        <div className="flex flex-wrap items-center gap-2.5">
          <Button>Guardá los cambios</Button>
          <Button cargando>Guardando…</Button>
          <Button disabled>Deshabilitado</Button>
          <Button variant="secundario">Secundario</Button>
          <Button variant="terciario">Terciario</Button>
          <Button variant="peligro">Borrar gasto</Button>
        </div>
      </section>

      <section aria-labelledby="titulo-sync" className="flex flex-col gap-2">
        <h2 id="titulo-sync" className="text-section font-semibold">
          Sincronización
        </h2>
        <p className="text-body text-text-2">{describirEstadoSync(estadoSync)}</p>
      </section>
    </main>
  );
}
