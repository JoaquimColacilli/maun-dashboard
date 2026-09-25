import type { ReactNode } from 'react';

import {
  iso,
  planoDeFrente,
  planoDelPiso,
  puntos,
  recorrido,
  redondear,
  type Limites,
} from './proyeccion.ts';
import { Caja, claseDeLinea, Cota, EnElPlano, Losa, type Contorno, type Linea } from './trazos.tsx';

export interface Ubicacion {
  x: number;
  y: number;
  z: number;
}

export function Lapiz({ x, y, z }: Ubicacion) {
  const largo = 58;
  const ancho = 7;
  const alto = 3;
  const punta = 11;
  const a = iso(x + largo, y, z + alto);
  const b = iso(x + largo, y + ancho, z + alto);
  const c = iso(x + largo, y + ancho, z);
  const mina = iso(x + largo + punta, y + ancho / 2, z + alto / 2);
  const arriba = iso(x + largo + punta - 3.5, y + ancho / 2 - 1, z + alto * 0.85);
  const abajo = iso(x + largo + punta - 3.5, y + ancho / 2 + 1, z + alto * 0.15);
  return (
    <g>
      <Caja x={x} y={y} z={z} largo={largo} ancho={ancho} alto={alto} />
      <polygon points={puntos(a, b, mina)} className="cara" />
      <polygon points={puntos(b, c, mina)} className="costado" />
      <polygon points={puntos(arriba, abajo, mina)} className="tinta" />
      <path d={`${recorrido(a, mina, c)}${recorrido(b, mina)}`} />
      <EnElPlano transform={planoDelPiso(z + alto)}>
        <path
          d={`M${String(x + 8)} ${String(y + ancho / 2)}H${String(x + largo - 12)}`}
          className="fina"
        />
      </EnElPlano>
    </g>
  );
}

export function Escuadra({ x, y, z }: Ubicacion) {
  const hoja = 74;
  const anchoDeHoja = 11;
  const mango = 42;
  const anchoDeMango = 9;
  const marcas: string[] = [];
  for (let paso = 6; paso < hoja - 2; paso += 6) {
    marcas.push(
      `M${String(x + anchoDeMango + paso)} ${String(y + anchoDeHoja)}v${String(paso % 30 === 0 ? -5 : -2.5)}`,
    );
  }
  return (
    <g>
      <Caja x={x} y={y} z={z} largo={anchoDeMango} ancho={mango} alto={5} />
      <Caja x={x + anchoDeMango} y={y} z={z + 1.5} largo={hoja} ancho={anchoDeHoja} alto={1} />
      <EnElPlano transform={planoDelPiso(z + 2.5)}>
        <path d={marcas.join('')} className="fina" />
      </EnElPlano>
    </g>
  );
}

type Punto2 = readonly [number, number];

function tramoRedondeado(desde: Punto2, hasta: Punto2, ancho: number): Contorno {
  const angulo = Math.atan2(hasta[1] - desde[1], hasta[0] - desde[0]);
  const radio = ancho / 2;
  const tapa = (centro: Punto2, inicio: number): Punto2[] =>
    [0, 1, 2, 3, 4, 5, 6].map((paso) => {
      const giro = inicio + (paso * Math.PI) / 6;
      return [
        redondear(centro[0] + radio * Math.cos(giro)),
        redondear(centro[1] + radio * Math.sin(giro)),
      ];
    });
  return [...tapa(hasta, angulo - Math.PI / 2), ...tapa(desde, angulo + Math.PI / 2)];
}

const METRO = {
  largo: 36,
  ancho: 9,
  espesor: 1.6,
  angulos: [-8, -82, -8, -82].map((grados) => (grados * Math.PI) / 180),
};

function unionesDelMetro(x: number, y: number): Punto2[] {
  const uniones: Punto2[] = [[x, y]];
  for (const angulo of METRO.angulos) {
    const [u, v] = uniones[uniones.length - 1] ?? [x, y];
    uniones.push([u + METRO.largo * Math.cos(angulo), v + METRO.largo * Math.sin(angulo)]);
  }
  return uniones;
}

export function limitesDelMetro({ x, y, z }: Ubicacion): Limites {
  const radio = METRO.ancho / 2;
  const alto = z + METRO.angulos.length * METRO.espesor;
  const vistas = unionesDelMetro(x, y).flatMap(([u, v]) => [iso(u, v, z), iso(u, v, alto)]);
  return {
    izquierda: Math.min(...vistas.map(([h]) => h)) - radio,
    derecha: Math.max(...vistas.map(([h]) => h)) + radio,
    arriba: Math.min(...vistas.map(([, w]) => w)) - radio,
    abajo: Math.max(...vistas.map(([, w]) => w)) + radio,
  };
}

export function Metro({ x, y, z }: Ubicacion) {
  const { largo, ancho, espesor, angulos } = METRO;
  const uniones = unionesDelMetro(x, y);
  return (
    <g>
      {angulos.map((angulo, indice) => {
        const desde = uniones[indice] ?? [x, y];
        const hasta = uniones[indice + 1] ?? desde;
        const normal = angulo - Math.PI / 2;
        const marcas: string[] = [];
        for (let paso = 4; paso < largo - 2; paso += 4) {
          const largoDeMarca = paso % 20 === 0 ? 4.5 : 2.2;
          const u = desde[0] + paso * Math.cos(angulo) + (ancho / 2) * Math.cos(normal);
          const v = desde[1] + paso * Math.sin(angulo) + (ancho / 2) * Math.sin(normal);
          marcas.push(
            `M${String(redondear(u))} ${String(redondear(v))}l${String(redondear(-largoDeMarca * Math.cos(normal)))} ${String(redondear(-largoDeMarca * Math.sin(normal)))}`,
          );
        }
        const altura = z + indice * espesor;
        return (
          <g key={indice}>
            <Losa contorno={tramoRedondeado(desde, hasta, ancho)} z={altura} espesor={espesor} />
            <EnElPlano transform={planoDelPiso(altura + espesor)}>
              <path d={marcas.join('')} className="fina" />
              {indice > 0 && (
                <circle
                  cx={redondear(desde[0])}
                  cy={redondear(desde[1])}
                  r={1.6}
                  className="cara"
                />
              )}
            </EnElPlano>
          </g>
        );
      })}
    </g>
  );
}

export interface MuebleProps extends Ubicacion {
  largo: number;
  profundidad: number;
  alto: number;
  fantasma?: boolean;
  children?: ReactNode;
}

export function Mueble({
  x,
  y,
  z,
  largo,
  profundidad,
  alto,
  fantasma = false,
  children,
}: MuebleProps) {
  const linea: Linea = fantasma ? 'trazos' : 'gruesa';
  const zocalo = fantasma ? 0 : 7;
  const tapa = 3;
  const cuerpo = alto - zocalo - tapa;
  const frente = y + profundidad;
  const medio = x + largo / 2;
  const arriba = -(z + zocalo + cuerpo - 3);
  const abajo = -(z + zocalo + 3);
  const tirador = arriba + 9;
  return (
    <g>
      {!fantasma && (
        <Caja
          x={x + 3}
          y={y}
          z={z}
          largo={largo - 6}
          ancho={profundidad - 4}
          alto={zocalo}
          izquierda="costado"
        />
      )}
      <Caja
        x={x}
        y={y}
        z={z + zocalo}
        largo={largo}
        ancho={profundidad}
        alto={cuerpo}
        derecha={fantasma ? 'cara' : 'costado'}
        linea={linea}
      />
      <EnElPlano transform={planoDeFrente(frente)}>
        <path
          d={`M${String(x + 3)} ${String(arriba)}H${String(x + largo - 3)}V${String(abajo)}H${String(x + 3)}ZM${String(medio)} ${String(arriba)}V${String(abajo)}`}
          className={fantasma ? 'trazos' : 'fina'}
        />
        <path
          d={`M${String(medio - 4)} ${String(tirador)}v10M${String(medio + 4)} ${String(tirador)}v10`}
          className={claseDeLinea(linea)}
        />
      </EnElPlano>
      <Caja
        x={x - 2}
        y={y - 1}
        z={z + zocalo + cuerpo}
        largo={largo + 4}
        ancho={profundidad + 3}
        alto={tapa}
        izquierda={fantasma ? 'cara' : 'tinta'}
        derecha={fantasma ? 'cara' : 'tinta'}
        linea={linea}
      />
      {children !== undefined && (
        <EnElPlano transform={planoDeFrente(frente)}>
          <g transform={`translate(${String(medio + 4)} ${String(tirador + 10)})`}>{children}</g>
        </EnElPlano>
      )}
    </g>
  );
}

export function Etiqueta() {
  return (
    <g>
      <path d="M0 0q2 6 7 9" className="fina" />
      <g transform="translate(5 8) rotate(10)">
        <path d="M0 0h21a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H0l-4-4V4z" className="cara" />
        <circle cx={0} cy={7.5} r={1.2} className="cara" />
        {[7, 12.5, 18].map((centro) => (
          <circle key={centro} cx={centro} cy={7.5} r={2} className="fina" />
        ))}
      </g>
    </g>
  );
}

export interface HojaProps extends Ubicacion {
  largo: number;
  ancho: number;
  esquina?: boolean;
  children?: ReactNode;
}

export function Hoja({ x, y, z, largo, ancho, esquina = false, children }: HojaProps) {
  const doblez = 14;
  const x1 = x + largo;
  const y1 = y + ancho;
  const contorno = esquina
    ? puntos(
        iso(x, y, z),
        iso(x1, y, z),
        iso(x1, y1 - doblez, z),
        iso(x1 - doblez, y1, z),
        iso(x, y1, z),
      )
    : puntos(iso(x, y, z), iso(x1, y, z), iso(x1, y1, z), iso(x, y1, z));
  const pliegue = [
    iso(x1, y1 - doblez, z),
    iso(x1 - doblez, y1 - doblez, z + 0.5),
    iso(x1 - doblez, y1, z),
  ] as const;
  return (
    <g>
      <polygon points={contorno} className="cara" />
      <EnElPlano transform={planoDelPiso(z)}>{children}</EnElPlano>
      {esquina && <polygon points={puntos(...pliegue)} className="costado" />}
      <polygon points={contorno} />
      {esquina && <path d={recorrido(...pliegue)} />}
    </g>
  );
}

export interface PlanoDelMuebleProps {
  x: number;
  y: number;
  ancho?: number;
  alto?: number;
  linea?: 'fina' | 'trazos';
}

export function PlanoDelMueble({
  x,
  y,
  ancho = 48,
  alto = 30,
  linea = 'fina',
}: PlanoDelMuebleProps) {
  const medio = x + ancho / 2;
  return (
    <g>
      <path
        d={`M${String(x)} ${String(y)}h${String(ancho)}v${String(alto)}h${String(-ancho)}zM${String(medio)} ${String(y)}v${String(alto - 5)}M${String(x)} ${String(y + alto - 5)}h${String(ancho)}M${String(medio - 3)} ${String(y + 6)}v6M${String(medio + 3)} ${String(y + 6)}v6`}
        className={linea}
      />
      <Cota desde={x} hasta={x + ancho} borde={y} separacion={6} />
    </g>
  );
}

export function Agenda({ x, y, z }: Ubicacion) {
  const largo = 64;
  const ancho = 86;
  const alto = 9;
  const hojas = [2.6, 4.4, 6.2]
    .map((altura) => `M${String(x + 1.5)} ${String(-(z + altura))}H${String(x + largo - 1.5)}`)
    .join('');
  return (
    <g>
      <Caja
        x={x}
        y={y}
        z={z}
        largo={largo}
        ancho={ancho}
        alto={alto}
        izquierda="cara"
        derecha="cara"
      />
      <EnElPlano transform={planoDeFrente(y + ancho)}>
        <path d={hojas} className="fina" />
      </EnElPlano>
      <EnElPlano transform={planoDelPiso(z + alto)}>
        <rect x={x + 12} y={y + 16} width={40} height={16} rx={1.5} className="fina" />
      </EnElPlano>
      {[10, 28, 46, 64].map((posicion) => (
        <Caja
          key={posicion}
          x={x + largo}
          y={y + posicion}
          z={z + 1.5}
          largo={5}
          ancho={12}
          alto={6}
          izquierda="costado"
          derecha="cara"
        />
      ))}
    </g>
  );
}
