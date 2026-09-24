import { ALTO_DE_ESCENA, ANCHO_DE_ESCENA, Lienzo } from './lienzo.tsx';
import { TILDE } from './mano.ts';
import { Carcasa, Mueble } from './objetos.tsx';
import { limites, planoDeFrente, type Volumen } from './proyeccion.ts';
import { Cota, EnElPlano } from './trazos.tsx';

export type EtapaDelMueble = 'plano' | 'taller' | 'terminado' | 'pagado';

const MUEBLE = { largo: 72, profundidad: 28, alto: 48 } as const;

const CUERPO: Volumen = {
  x: -2,
  y: -1,
  z: 0,
  largo: MUEBLE.largo + 4,
  ancho: MUEBLE.profundidad + 3,
  alto: MUEBLE.alto,
};

const COTA: Volumen = {
  x: 0,
  y: MUEBLE.profundidad,
  z: -12,
  largo: MUEBLE.largo,
  ancho: 0,
  alto: 12,
};

const MARCA: Volumen = { x: 30, y: 0, z: MUEBLE.alto, largo: 0, ancho: 0, alto: 23 };

export interface MuebleEnEtapaProps {
  etapa: EtapaDelMueble;
  animar?: boolean;
}

export function MuebleEnEtapa({ etapa, animar = false }: MuebleEnEtapaProps) {
  const conCota = etapa === 'plano' || etapa === 'taller';
  const conMarca = etapa === 'pagado';
  return (
    <Lienzo
      limites={limites([CUERPO, ...(conCota ? [COTA] : []), ...(conMarca ? [MARCA] : [])])}
      ancho={ANCHO_DE_ESCENA}
      alto={ALTO_DE_ESCENA}
    >
      {etapa === 'taller' ? (
        <Carcasa x={0} y={0} z={0} {...MUEBLE} />
      ) : (
        <Mueble x={0} y={0} z={0} {...MUEBLE} fantasma={etapa === 'plano'} />
      )}
      {conCota && (
        <EnElPlano transform={planoDeFrente(MUEBLE.profundidad)}>
          <Cota desde={0} hasta={MUEBLE.largo} borde={0} separacion={-9} />
        </EnElPlano>
      )}
      {conMarca && (
        <path
          d={TILDE}
          pathLength={1}
          transform="translate(44 -54)"
          className={animar ? 'mano trazar' : 'mano'}
        />
      )}
    </Lienzo>
  );
}
