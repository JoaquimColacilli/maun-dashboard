import { FormularioDeMovimiento } from '@/features/registrar-movimiento';
import { EnConstruccion } from '@/shared/ui';

export function FinanzasPage() {
  return (
    <EnConstruccion
      titulo="Finanzas"
      detalle="El libro mayor por tesoro llega en el paso que viene. Mientras tanto, acá se carga un movimiento a mano, con o sin señal."
    >
      <section aria-labelledby="titulo-movimiento" className="flex max-w-[520px] flex-col gap-3.5">
        <h2 id="titulo-movimiento" className="text-section font-semibold">
          Cargar un movimiento
        </h2>
        <FormularioDeMovimiento />
      </section>
    </EnConstruccion>
  );
}
