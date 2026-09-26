export interface TildeProps {
  tamano?: number;
  grosor?: number;
  dibujar?: boolean;
  className?: string;
}

export function Tilde({ tamano = 16, grosor = 2.5, dibujar = false, className = '' }: TildeProps) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      width={tamano}
      height={tamano}
      fill="none"
      stroke="currentColor"
      strokeWidth={grosor}
      strokeLinecap="round"
      strokeLinejoin="round"
      data-dibujar={dibujar ? '' : undefined}
      className={['tilde flex-none', className].join(' ').trim()}
    >
      <path d="M4 12l5 5L20 6" pathLength={1} />
    </svg>
  );
}
