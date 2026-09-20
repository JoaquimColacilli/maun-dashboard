import { lazy, Suspense } from 'react';

const Dibujo = lazy(async () => import('./DibujoDelQr'));

export interface QrDeUnEnlaceProps {
  texto: string;
  etiqueta: string;
}

export function QrDeUnEnlace({ texto, etiqueta }: QrDeUnEnlaceProps) {
  return (
    <Suspense
      fallback={
        <div
          aria-busy="true"
          className="aspect-square w-full animate-maun-shimmer rounded-field bg-surface-2"
        >
          <span className="sr-only" role="status">
            Dibujando el código
          </span>
        </div>
      }
    >
      <Dibujo texto={texto} etiqueta={etiqueta} />
    </Suspense>
  );
}
