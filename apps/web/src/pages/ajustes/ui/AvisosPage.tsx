import { Link } from 'react-router';

import { AvisosDelDispositivo } from '@/features/recibir-avisos';
import { RUTA_DE_AJUSTES } from '@/shared/lib';
import { Icono, Pagina } from '@/shared/ui';

export function AvisosPage() {
  return (
    <Pagina className="gap-5 [&>*]:max-w-[720px]">
      <header className="flex flex-col items-start gap-1.5">
        <Link
          to={RUTA_DE_AJUSTES}
          className="flex min-h-tap items-center gap-1 rounded-field pr-2 text-body font-medium text-text-2 hover:bg-surface"
        >
          <Icono nombre="chevron-left" tamano={20} />
          Ajustes
        </Link>
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
