import type { CSSProperties, ReactNode } from 'react';

import { cortar } from './guillotina.ts';
import { ALTO_DE_ESCENA, ANCHO_DE_ESCENA, Lienzo } from './lienzo.tsx';
import { PATA_DE_GALLO } from './mano.ts';
import { Escuadra, Lapiz } from './objetos.tsx';
import { limites, planoDelPiso, type Volumen } from './proyeccion.ts';
import { Caja, Cota, EnElPlano, Rayado, type Relleno } from './trazos.tsx';

export type TonoDeLaPieza = 'hogar' | 'maun' | 'diezmo' | 'cocos' | 'sobrante';

export interface PiezaDelTablero {
  id: string;
  tono: TonoDeLaPieza;
  parte: number;
  nombre: string;
  porcentaje: string;
  detalle?: string;
}

export type FormatoDelTablero = 'amplio' | 'medio' | 'mini' | 'escena';

interface Medidas {
  largo: number;
  ancho: number;
  espesor: number;
  sierra: number;
  rotulos: 'completos' | 'porcentajes' | 'ninguno';
}

const MEDIDAS: Readonly<Record<FormatoDelTablero, Medidas>> = {
  amplio: { largo: 208, ancho: 136, espesor: 6, sierra: 7, rotulos: 'completos' },
  medio: { largo: 156, ancho: 102, espesor: 5, sierra: 6, rotulos: 'porcentajes' },
  mini: { largo: 92, ancho: 60, espesor: 4, sierra: 4, rotulos: 'ninguno' },
  escena: { largo: 104, ancho: 68, espesor: 4, sierra: 4, rotulos: 'ninguno' },
};

const LETRA = 6.4;
const PARTE_MINIMA = 0.01;
const COTA = 18;

function volumenes(medidas: Medidas, conCota: boolean): Volumen[] {
  const placa: Volumen = {
    x: 0,
    y: 0,
    z: 0,
    largo: medidas.largo,
    ancho: medidas.ancho,
    alto: medidas.espesor,
  };
  return conCota
    ? [placa, { ...placa, y: -COTA, ancho: COTA, alto: medidas.espesor + 6 }]
    : [placa];
}

function Tablero({
  formato,
  conCota,
  children,
}: {
  formato: FormatoDelTablero;
  conCota: boolean;
  children: ReactNode;
}) {
  const escena = formato === 'escena';
  return (
    <Lienzo
      limites={limites(volumenes(MEDIDAS[formato], conCota))}
      ancho={escena ? ANCHO_DE_ESCENA : undefined}
      alto={escena ? ALTO_DE_ESCENA : undefined}
    >
      {children}
    </Lienzo>
  );
}

function rotulo(
  pieza: PiezaDelTablero,
  largo: number,
  ancho: number,
  medidas: Medidas,
): string | undefined {
  if (medidas.rotulos === 'ninguno' || ancho < 18) return undefined;
  const completo = `${pieza.nombre} ${pieza.porcentaje}`;
  if (medidas.rotulos === 'completos' && completo.length * LETRA + 14 <= largo) return completo;
  if (pieza.porcentaje.length * LETRA + 14 <= largo) return pieza.porcentaje;
  return undefined;
}

function corte(orden: number): CSSProperties {
  return {
    animationName: 'maun-corte',
    animationDuration: 'var(--dur-corte)',
    animationTimingFunction: 'var(--ease-out)',
    animationFillMode: 'both',
    animationDelay: `calc(${String(orden)} * var(--dur-corte-stagger) / 2)`,
  };
}

export interface TableroCortadoProps {
  piezas: readonly PiezaDelTablero[];
  formato?: FormatoDelTablero;
  medida?: string;
  animar?: boolean;
  proyectado?: boolean;
}

export function TableroCortado({
  piezas,
  formato = 'amplio',
  medida,
  animar = false,
  proyectado = false,
}: TableroCortadoProps) {
  const medidas = MEDIDAS[formato];
  const { largo, ancho, espesor, sierra } = medidas;
  const conCota = medida !== undefined && formato !== 'mini' && formato !== 'escena';
  const ubicadas = cortar(
    piezas.filter((pieza) => pieza.parte >= PARTE_MINIMA),
    { x: 0, y: 0, largo, ancho },
    sierra,
  ).sort((a, b) => a.x + a.y - (b.x + b.y));

  const cota = conCota && (
    <EnElPlano transform={planoDelPiso(espesor)}>
      <Cota desde={0} hasta={largo} borde={0} separacion={12} texto={medida} />
    </EnElPlano>
  );

  if (proyectado) {
    return (
      <Tablero formato={formato} conCota={conCota}>
        {cota}
        <Caja
          x={0}
          y={0}
          z={0}
          largo={largo}
          ancho={ancho}
          alto={espesor}
          izquierda="costado"
          derecha="costado"
        />
        <EnElPlano transform={planoDelPiso(espesor)}>
          {ubicadas.map((ubicada) => {
            const { pieza } = ubicada;
            const texto = rotulo(pieza, ubicada.largo, ubicada.ancho, medidas);
            return (
              <g key={pieza.id} data-pieza={pieza.id}>
                {pieza.detalle !== undefined && <title>{pieza.detalle}</title>}
                <rect
                  x={ubicada.x}
                  y={ubicada.y}
                  width={ubicada.largo}
                  height={ubicada.ancho}
                  className="trazos"
                />
                {texto !== undefined && (
                  <text x={ubicada.x + 7} y={ubicada.y + ubicada.ancho - 7} className="rotulo">
                    {texto}
                  </text>
                )}
              </g>
            );
          })}
        </EnElPlano>
      </Tablero>
    );
  }

  return (
    <Tablero formato={formato} conCota={conCota}>
      {cota}
      {ubicadas.map((ubicada, orden) => {
        const { pieza } = ubicada;
        const canto: Relleno = pieza.tono === 'sobrante' ? 'costado' : pieza.tono;
        const texto = rotulo(pieza, ubicada.largo, ubicada.ancho, medidas);
        return (
          <g key={pieza.id} data-pieza={pieza.id} style={animar ? corte(orden) : undefined}>
            {pieza.detalle !== undefined && <title>{pieza.detalle}</title>}
            <Caja
              x={ubicada.x}
              y={ubicada.y}
              z={0}
              largo={ubicada.largo}
              ancho={ubicada.ancho}
              alto={espesor}
              izquierda={canto}
              derecha={canto}
            />
            <EnElPlano transform={planoDelPiso(espesor)}>
              {pieza.tono === 'sobrante' && (
                <Rayado x={ubicada.x} y={ubicada.y} ancho={ubicada.largo} alto={ubicada.ancho} />
              )}
              {texto !== undefined && (
                <text x={ubicada.x + 7} y={ubicada.y + ubicada.ancho - 7} className="rotulo">
                  {texto}
                </text>
              )}
            </EnElPlano>
          </g>
        );
      })}
    </Tablero>
  );
}

export interface TableroEnteroProps {
  formato?: FormatoDelTablero;
  herramientas?: boolean;
  animar?: boolean;
}

export function TableroEntero({
  formato = 'amplio',
  herramientas = false,
  animar = false,
}: TableroEnteroProps) {
  const { largo, ancho, espesor } = MEDIDAS[formato];
  const primerCorte = largo * 0.42;
  const conHerramientas = herramientas && (formato === 'amplio' || formato === 'medio');
  return (
    <Tablero formato={formato} conCota={false}>
      <Caja
        x={0}
        y={0}
        z={0}
        largo={largo}
        ancho={ancho}
        alto={espesor}
        izquierda="tinta"
        derecha="tinta"
      />
      <EnElPlano transform={planoDelPiso(espesor)}>
        {herramientas ? (
          <>
            <path d={`M${String(primerCorte)} -10V${String(ancho + 10)}`} className="eje" />
            <path
              d={PATA_DE_GALLO}
              pathLength={1}
              transform={`translate(${String(primerCorte)} 9)`}
              className={animar ? 'mano trazar' : 'mano'}
            />
          </>
        ) : (
          <path
            d={`M-10 ${String(ancho * 0.56)}H${String(largo + 10)}M${String(largo * 0.6)} -10V${String(ancho * 0.56)}`}
            className="eje"
          />
        )}
      </EnElPlano>
      {conHerramientas && (
        <>
          <Lapiz x={largo * 0.58} y={ancho * 0.2} z={espesor} />
          <Escuadra x={largo * 0.1} y={ancho * 0.42} z={espesor} />
        </>
      )}
    </Tablero>
  );
}
