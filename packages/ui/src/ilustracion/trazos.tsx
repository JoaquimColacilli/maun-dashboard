import type { ReactNode } from 'react';

import { iso, puntos, recorrido, type Volumen } from './proyeccion.ts';

export type Relleno = 'cara' | 'costado' | 'tinta' | 'hogar' | 'maun' | 'diezmo' | 'cocos' | 'nada';

export type Linea = 'gruesa' | 'fina' | 'trazos' | 'eje' | 'mano';

export function claseDeLinea(linea: Linea): string | undefined {
  return linea === 'gruesa' ? undefined : linea;
}

function clases(...lista: readonly (string | undefined)[]): string {
  return lista.filter((clase) => clase !== undefined).join(' ');
}

export interface CajaProps extends Volumen {
  arriba?: Relleno;
  izquierda?: Relleno;
  derecha?: Relleno;
  linea?: Linea;
}

export function Caja({
  x,
  y,
  z,
  largo,
  ancho,
  alto,
  arriba = 'cara',
  izquierda = 'cara',
  derecha = 'costado',
  linea = 'gruesa',
}: CajaProps) {
  const x1 = x + largo;
  const y1 = y + ancho;
  const z1 = z + alto;
  const a = iso(x, y, z1);
  const b = iso(x1, y, z1);
  const c = iso(x1, y1, z1);
  const d = iso(x, y1, z1);
  const e = iso(x1, y, z);
  const f = iso(x1, y1, z);
  const g = iso(x, y1, z);
  const caras: readonly (readonly [string, Relleno, string])[] = [
    ['arriba', arriba, puntos(a, b, c, d)],
    ['izquierda', izquierda, puntos(d, c, f, g)],
    ['derecha', derecha, puntos(c, b, e, f)],
  ];
  return (
    <g>
      {caras.map(([lado, relleno, contorno]) =>
        relleno === 'nada' ? null : (
          <polygon key={lado} points={contorno} className={clases(relleno, 'sin-linea')} />
        ),
      )}
      <path
        d={`${recorrido(a, b, e, f, g, d)}Z${recorrido(d, c, b)}${recorrido(c, f)}`}
        className={claseDeLinea(linea)}
      />
    </g>
  );
}

export function EnElPlano({ transform, children }: { transform: string; children: ReactNode }) {
  return <g transform={transform}>{children}</g>;
}

export interface CotaProps {
  desde: number;
  hasta: number;
  borde: number;
  separacion: number;
  texto?: string;
}

export function Cota({ desde, hasta, borde, separacion, texto }: CotaProps) {
  const sentido = Math.sign(separacion);
  const linea = borde - separacion;
  const inicio = borde - sentido * 3;
  const fin = linea - sentido * 3;
  return (
    <g>
      <path
        d={`M${String(desde)} ${String(inicio)}V${String(fin)}M${String(hasta)} ${String(inicio)}V${String(fin)}M${String(desde)} ${String(linea)}H${String(hasta)}`}
        className="fina"
      />
      <path
        d={`M${String(desde - 2.5)} ${String(linea + 2.5)}l5 -5M${String(hasta - 2.5)} ${String(linea + 2.5)}l5 -5`}
      />
      {texto !== undefined && (
        <text x={(desde + hasta) / 2} y={linea - 4} textAnchor="middle" className="cota">
          {texto}
        </text>
      )}
    </g>
  );
}

export interface RayadoProps {
  x: number;
  y: number;
  ancho: number;
  alto: number;
  paso?: number;
}

export function Rayado({ x, y, ancho, alto, paso = 5 }: RayadoProps) {
  const tramos: string[] = [];
  for (let k = paso; k < ancho + alto; k += paso) {
    const desdeX = Math.max(0, k - alto);
    const desdeY = Math.min(k, alto);
    const hastaX = Math.min(k, ancho);
    const hastaY = Math.max(0, k - ancho);
    tramos.push(
      `M${String(x + desdeX)} ${String(y + desdeY)}L${String(x + hastaX)} ${String(y + hastaY)}`,
    );
  }
  return <path d={tramos.join('')} className="fina" />;
}

export type Contorno = readonly (readonly [number, number])[];

export interface LosaProps {
  contorno: Contorno;
  z: number;
  espesor: number;
}

export function Losa({ contorno, z, espesor }: LosaProps) {
  return (
    <g>
      <polygon points={puntos(...contorno.map(([u, v]) => iso(u, v, z)))} className="costado" />
      <polygon
        points={puntos(...contorno.map(([u, v]) => iso(u, v, z + espesor)))}
        className="cara"
      />
    </g>
  );
}
