import { encode } from 'uqr';

export interface DibujoDelQrProps {
  texto: string;
  etiqueta: string;
}

const MARGEN = 4;

export function DibujoDelQr({ texto, etiqueta }: DibujoDelQrProps) {
  const { data, size } = encode(texto, { ecc: 'M', border: MARGEN });

  const trazos: string[] = [];
  data.forEach((fila, y) => {
    fila.forEach((negro, x) => {
      if (negro) trazos.push(`M${String(x)} ${String(y)}h1v1h-1z`);
    });
  });

  return (
    <svg
      role="img"
      aria-label={etiqueta}
      viewBox={`0 0 ${String(size)} ${String(size)}`}
      shapeRendering="crispEdges"
      className="block aspect-square w-full bg-paper-fijo"
    >
      <path d={trazos.join('')} className="fill-ink-fijo" />
    </svg>
  );
}

export default DibujoDelQr;
