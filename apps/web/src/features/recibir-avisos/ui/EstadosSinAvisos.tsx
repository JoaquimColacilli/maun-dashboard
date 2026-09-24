import { useId } from 'react';

import { Button, Icono } from '@/shared/ui';

import { PASOS_EN_EL_IPHONE, pasosParaDesbloquear } from '../model/textos';

const TARJETA = 'flex flex-col gap-2.5 rounded-panel border border-hairline p-5';
const TITULO = 'flex items-center gap-2.5 text-section leading-tight font-semibold';
const TEXTO = 'text-body leading-relaxed text-text-2';
const PASOS = 'flex list-decimal flex-col gap-1.5 pl-5 text-body leading-relaxed';
const FILAS_DEL_ESQUELETO = ['entregas', 'visitas', 'presupuestos', 'seguimientos', 'anotaciones'];

export function EsqueletoDeLosAvisos() {
  return (
    <div role="status" aria-busy="true" className="flex flex-col gap-4">
      <span className="sr-only">Leyendo tus avisos…</span>
      <div aria-hidden className="h-[92px] rounded-panel border border-hairline bg-paper" />
      {FILAS_DEL_ESQUELETO.map((fila) => (
        <div
          key={fila}
          aria-hidden
          className="flex items-center gap-3.5 border-t border-hairline-soft py-3.5"
        >
          <div className="size-[22px] rounded-control bg-ink/6" />
          <div className="flex flex-1 flex-col gap-2">
            <div className="h-3.5 w-2/5 rounded-control bg-ink/6" />
            <div className="h-3 w-[70%] rounded-control bg-ink/6" />
          </div>
          <div className="h-9 w-[120px] rounded-field bg-ink/6" />
        </div>
      ))}
    </div>
  );
}

export function ErrorDeLosAvisos({
  sinSenal,
  alReintentar,
}: {
  sinSenal: boolean;
  alReintentar: () => void;
}) {
  return (
    <div role="alert" className={TARJETA}>
      <p className={TITULO}>
        <Icono nombre="triangle-alert" tamano={20} className="flex-none" />
        {sinSenal
          ? 'Sin señal no podemos leer tus avisos'
          : 'No pudimos leer tu configuración de avisos'}
      </p>
      <p className={TEXTO}>
        Los avisos que ya estaban activos siguen andando. Lo que no pudimos traer son tus
        preferencias para mostrarlas acá.
      </p>
      <div>
        <Button onClick={alReintentar}>Reintentar</Button>
      </div>
    </div>
  );
}

export function SinClaves() {
  const id = useId();
  return (
    <section aria-labelledby={id} className={TARJETA}>
      <h2 id={id} className={TITULO}>
        <Icono nombre="bell-off" tamano={20} className="flex-none" />
        Los avisos todavía no están listos
      </h2>
      <p className={TEXTO}>
        El servidor no tiene cargadas las claves para mandar avisos, así que por ahora no se pueden
        activar en ningún dispositivo. No es algo que se arregle desde esta pantalla.
      </p>
      <p className="text-label text-text-3">Mientras tanto, la agenda sigue mostrando todo.</p>
    </section>
  );
}

export function InstalarEnElIphone() {
  const id = useId();
  return (
    <div className="flex flex-col gap-4">
      <section
        aria-labelledby={id}
        className="overflow-hidden rounded-panel border border-hairline"
      >
        <div className="flex flex-col gap-2.5 border-b border-hairline p-5">
          <h2 id={id} className={TITULO}>
            <Icono nombre="smartphone" tamano={20} className="flex-none" />
            Primero agregá MAUN a la pantalla de inicio
          </h2>
          <p className={TEXTO}>
            En el iPhone, los avisos solo llegan si la app está agregada a la pantalla de inicio. No
            es un paso nuestro: es un requisito del sistema. Son treinta segundos y además abre más
            rápido.
          </p>
        </div>
        <div className="flex flex-col gap-2 px-5 py-4.5">
          <h3 className="text-body font-semibold">iPhone, en Safari</h3>
          <ol className={`${PASOS} text-text-2`}>
            {PASOS_EN_EL_IPHONE.map((paso) => (
              <li key={paso}>{paso}</li>
            ))}
          </ol>
        </div>
      </section>
      <p className="text-label leading-relaxed text-text-3">
        Cuando la abras desde el ícono, volvé acá y vas a poder activar los avisos.
      </p>
    </div>
  );
}

export function SinSoporte() {
  const id = useId();
  return (
    <section aria-labelledby={id} className={TARJETA}>
      <h2 id={id} className={TITULO}>
        <Icono nombre="bell-off" tamano={20} className="flex-none" />
        Este navegador no puede recibir avisos
      </h2>
      <p className={TEXTO}>
        Para recibirlos, abrí MAUN en Chrome, Edge o Firefox. Mientras tanto, la agenda sigue
        mostrando todo.
      </p>
    </section>
  );
}

export function AvisosBloqueados({
  comoApp,
  mensaje,
  alRevisar,
}: {
  comoApp: boolean;
  mensaje: string | null;
  alRevisar: () => void;
}) {
  const id = useId();
  return (
    <section
      aria-labelledby={id}
      className="flex flex-col gap-3 rounded-panel border border-alerta bg-alerta-tint p-5"
    >
      <h2 id={id} className={TITULO}>
        <Icono nombre="bell-off" tamano={20} className="flex-none" />
        Los avisos están bloqueados
      </h2>
      <p className={TEXTO}>
        Le dijiste que no al permiso, y desde la app no se puede volver a preguntar: lo decide el
        sistema. Se habilita a mano en dos toques.
      </p>
      <ol className={PASOS}>
        {pasosParaDesbloquear(comoApp).map((paso) => (
          <li key={paso}>{paso}</li>
        ))}
      </ol>
      <div className="flex flex-wrap items-center gap-2.5">
        <Button onClick={alRevisar}>Ya lo habilité</Button>
        <span className="text-label text-text-3">
          Mientras tanto, la agenda sigue mostrando todo.
        </span>
      </div>
      {mensaje !== null && (
        <p role="alert" className="text-label leading-relaxed font-medium text-alerta">
          {mensaje}
        </p>
      )}
    </section>
  );
}

export function MejorEsfuerzo() {
  return (
    <p className="max-w-[560px] border-l-2 border-border py-3.5 pl-4 text-body leading-relaxed text-text-2">
      Es un recordatorio, no una alarma. El servicio que los manda puede saltear un aviso sin
      decirte nada, sobre todo si el teléfono está sin señal, y si la app pasa una semana sin usarse
      el servidor se pausa y los avisos dejan de salir. Para lo que no se puede perder, abrí la
      agenda: ahí está todo, siempre.
    </p>
  );
}
