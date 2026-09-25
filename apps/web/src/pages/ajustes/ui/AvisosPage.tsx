import { AvisosDelDispositivo } from '@/features/recibir-avisos';
import { Ir, RUTA_DE_AJUSTES, useVolver } from '@/shared/lib';
import { Icono, Pagina } from '@/shared/ui';

export function AvisosPage() {
  const vuelta = useVolver(RUTA_DE_AJUSTES, 'Ajustes');
  return (
    <Pagina className="gap-3 md:gap-4">
      <header className="flex flex-col items-start gap-1.5">
        <Ir
          a={RUTA_DE_AJUSTES}
          alTocar={vuelta.volver}
          className="-ml-1 flex min-h-tap items-center gap-1 rounded-pill pr-3 pl-1 text-body font-medium text-text-2 hover:bg-ink/5"
        >
          <Icono nombre="chevron-left" tamano={20} />
          {vuelta.etiqueta}
        </Ir>
        <h1 className="font-display text-h1 leading-tight lg:text-h1-lg">Avisos</h1>
        <p className="max-w-[520px] text-body leading-relaxed text-text-2">
          Un recordatorio a la mañana con lo que tenés ese día. Nada de esto reemplaza a la agenda:
          lo que manda es lo que ves en la pantalla.
        </p>
      </header>
      <AvisosDelDispositivo />
    </Pagina>
  );
}
