import {
  ALTO_DE_LA_MARCA,
  ANCHO_DEL_ISOTIPO,
  ANCHO_DEL_LOGOTIPO,
  CAJA_DEL_ISOTIPO,
  CAJA_DEL_LOGOTIPO,
  GROSOR_DEL_TRAZO,
  NOMBRE_DE_LA_APP,
  TRAZO_DEL_ISOTIPO,
  TRAZOS_DEL_LOGOTIPO,
  type TrazoDeLaMarca,
} from './trazos.ts';

export interface MarcaProps {
  decorativa?: boolean;
  className?: string;
}

function Dibujo({
  trazos,
  caja,
  ancho,
  decorativa,
  className,
}: {
  trazos: readonly TrazoDeLaMarca[];
  caja: string;
  ancho: number;
  decorativa: boolean;
  className: string;
}) {
  const nombre = decorativa
    ? { 'aria-hidden': true as const }
    : { role: 'img', 'aria-label': NOMBRE_DE_LA_APP };
  return (
    <svg
      {...nombre}
      viewBox={caja}
      width={ancho}
      height={ALTO_DE_LA_MARCA}
      fill="none"
      stroke="currentColor"
      strokeWidth={GROSOR_DEL_TRAZO}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={['block flex-none', className].join(' ').trim()}
    >
      {trazos.map(({ d, grosor }) => (
        <path key={d} d={d} strokeWidth={grosor === GROSOR_DEL_TRAZO ? undefined : grosor} />
      ))}
    </svg>
  );
}

export function Logotipo({ decorativa = false, className = '' }: MarcaProps) {
  return (
    <Dibujo
      trazos={TRAZOS_DEL_LOGOTIPO}
      caja={CAJA_DEL_LOGOTIPO}
      ancho={ANCHO_DEL_LOGOTIPO}
      decorativa={decorativa}
      className={className}
    />
  );
}

export function Isotipo({ decorativa = false, className = '' }: MarcaProps) {
  return (
    <Dibujo
      trazos={[TRAZO_DEL_ISOTIPO]}
      caja={CAJA_DEL_ISOTIPO}
      ancho={ANCHO_DEL_ISOTIPO}
      decorativa={decorativa}
      className={className}
    />
  );
}
