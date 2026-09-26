import type { CategoriaDeAgenda, EventoPropio } from '@maun/domain';

import { Tilde } from '@/shared/ui';

import { CATEGORIA, type FormaDeLaMarca } from '../model/categorias';

export type TamanoDeLaMarca = 'chica' | 'normal' | 'grande';

const CAJA: Readonly<Record<TamanoDeLaMarca, string>> = {
  chica: 'size-[5px]',
  normal: 'size-[11px]',
  grande: 'size-[13px]',
};

const BARRA: Readonly<Record<TamanoDeLaMarca, string>> = {
  chica: 'h-[3px] w-[6px]',
  normal: 'h-[4px] w-[11px]',
  grande: 'h-[5px] w-[13px]',
};

const TRAZO: Readonly<Record<TamanoDeLaMarca, string>> = {
  chica: 'border',
  normal: 'border-[1.5px]',
  grande: 'border-[1.5px]',
};

export interface MarcaDeCategoriaProps {
  categoria: CategoriaDeAgenda;
  tamano?: TamanoDeLaMarca;
  className?: string;
}

export function MarcaDeCategoria({
  categoria,
  tamano = 'normal',
  className = '',
}: MarcaDeCategoriaProps) {
  const { forma, fondo, borde } = CATEGORIA[categoria];
  const aspecto: Readonly<Record<FormaDeLaMarca, string>> = {
    cuadrado: `${CAJA[tamano]} ${fondo}`,
    punteado: `${CAJA[tamano]} ${TRAZO[tamano]} border-dashed ${borde}`,
    rombo: `${CAJA[tamano]} ${TRAZO[tamano]} ${borde} rotate-45 scale-[0.85]`,
    circulo: `${CAJA[tamano]} rounded-pill ${fondo}`,
    barra: `${BARRA[tamano]} ${fondo}`,
    triangulo: `${CAJA[tamano]} ${fondo} [clip-path:polygon(50%_0%,100%_100%,0%_100%)]`,
  };

  return (
    <span
      aria-hidden
      data-forma={forma}
      className={`block flex-none ${aspecto[forma]} ${className}`}
    />
  );
}

export function MarcaConAnillo({
  categoria,
  importante,
}: {
  categoria: CategoriaDeAgenda;
  importante: boolean;
}) {
  return (
    <span
      aria-hidden
      className={`mt-px flex size-[22px] flex-none items-center justify-center rounded-pill ${
        importante ? 'ring-[1.5px] ring-ag-marca' : ''
      }`}
    >
      <MarcaDeCategoria categoria={categoria} />
    </span>
  );
}

export interface CasillaDeAnotacionProps {
  evento: EventoPropio;
  alTildar: () => void;
  dibujar?: boolean;
}

export function CasillaDeAnotacion({ evento, alTildar, dibujar = false }: CasillaDeAnotacionProps) {
  const { borde, fondo } = CATEGORIA[evento.categoria];
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={evento.hecha}
      aria-label={evento.texto}
      onClick={alTildar}
      className="-my-2.5 -ml-3 flex size-tap flex-none items-center justify-center rounded-field"
    >
      <span
        className={`flex size-[22px] items-center justify-center rounded-[3px] border-[1.5px] text-paper ${borde} ${
          evento.hecha ? fondo : ''
        } ${evento.importante ? 'ring-[1.5px] ring-ag-marca ring-offset-1 ring-offset-paper' : ''}`}
      >
        {evento.hecha && <Tilde tamano={14} grosor={2.5} dibujar={dibujar} />}
      </span>
    </button>
  );
}
