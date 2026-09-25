import { useId, type ComponentType, type ReactNode } from 'react';

import { ALTO_DE_ESCENA, ANCHO_DE_ESCENA, Lienzo } from './lienzo.tsx';
import { TILDE, VUELTA } from './mano.ts';
import { Hoja, Lapiz } from './objetos.tsx';
import {
  correr,
  encerrar,
  iso,
  limites,
  planoDeCostado,
  planoDeFrente,
  planoDelPiso,
  puntos,
  recorrido,
  redondear,
  unir,
  type Limites,
  type Punto3,
} from './proyeccion.ts';
import { Caja, Cara, EnElPlano, Losa, type Contorno } from './trazos.tsx';

function Escena({ medida, children }: { medida: Limites; children: ReactNode }) {
  return (
    <Lienzo limites={medida} ancho={ANCHO_DE_ESCENA} alto={ALTO_DE_ESCENA}>
      {children}
    </Lienzo>
  );
}

const LARGO_DEL_LAPIZ = 69;

const ANOTADOR = { largo: 62, ancho: 84, alto: 6, lomo: 11, tapa: 2.5 } as const;
const HOJAS_DEL_CANTO = [1.5, 3, 4.5];
const RENGLONES_DEL_ANOTADOR = [30, 41, 52, 63, 74];
const ESCRITO =
  'M0 3c1.5-3 3-4 3.5-2.5s-1.5 3.5 0 3.5 2.5-3 3.5-3-.5 3 .5 3 1.5-6 2.5-8-1 8 0 8 2-3 3-3 0 3 1 3 2.5-3 3.5-3 0 3 1 3c1.2 0 1.5-2.5 2.5-2.5s.5 2.5 1.5 2.5 2-5 3-7-1 7 0 7 1.5-2 2.5-2';
const ESCRITO_CORTO =
  'M0 3c1.5-3 3-4 3.5-2.5s-1.5 3.5 0 3.5 1.5-6 2.5-8-1 8 0 8 2-3 3-3 0 3 1 3 2-3 3-3';
const NUMERO = 'M0 3.5c1-3 2.5-4 3-2.5s-1 4.5 0 4.5 2-5 3-5 0 5 1 5 1.5-3.5 2.5-3.5';
const LAPIZ_DEL_ANOTADOR = { x: 16, y: 58 } as const;

function Estimativo() {
  const { largo, ancho, alto, lomo, tapa } = ANOTADOR;
  const medida = limites([
    { x: 0, y: 0, z: 0, largo, ancho, alto: alto + tapa },
    { ...LAPIZ_DEL_ANOTADOR, z: alto, largo: LARGO_DEL_LAPIZ, ancho: 7, alto: 3 },
  ]);
  return (
    <Escena medida={medida}>
      <Caja
        x={0}
        y={0}
        z={0}
        largo={largo}
        ancho={ancho}
        alto={alto}
        izquierda="cara"
        derecha="cara"
      />
      <EnElPlano transform={planoDeFrente(ancho)}>
        <path
          d={HOJAS_DEL_CANTO.map((h) => `M1.5 ${String(-h)}H${String(largo - 1.5)}`).join('')}
          className="fina"
        />
      </EnElPlano>
      <EnElPlano transform={planoDeCostado(largo)}>
        <path
          d={HOJAS_DEL_CANTO.map(
            (h) => `M${String(lomo)} ${String(-h)}H${String(ancho - 1.5)}`,
          ).join('')}
          className="fina"
        />
      </EnElPlano>
      <EnElPlano transform={planoDelPiso(alto)}>
        <path
          d={RENGLONES_DEL_ANOTADOR.map((v) => `M7 ${String(v)}H${String(largo - 7)}`).join('')}
          className="renglon"
        />
        <g className="mano">
          <path d={ESCRITO} transform="translate(9 26)" />
          <path d={ESCRITO_CORTO} transform="translate(9 37)" />
          <path d={NUMERO} transform="translate(35.5 36)" />
          <path d={VUELTA} transform="translate(29.5 32)" />
        </g>
      </EnElPlano>
      <Cara
        vertices={[
          [largo, 0, 0],
          [largo, lomo, 0],
          [largo, lomo, alto],
          [largo, 0, alto],
        ]}
        relleno="tinta"
      />
      <Caja
        x={0}
        y={0}
        z={alto}
        largo={largo}
        ancho={lomo}
        alto={tapa}
        izquierda="tinta"
        derecha="tinta"
      />
      <Lapiz x={LAPIZ_DEL_ANOTADOR.x} y={LAPIZ_DEL_ANOTADOR.y} z={alto} />
    </Escena>
  );
}

const PAGINA = { largo: 62, ancho: 84, corrida: 5, caida: 4 } as const;
const PARTIDAS = [30, 37, 44, 51];
const PARTIDAS_HECHAS = [30, 37];
const PARTIDAS_QUE_FALTAN = [51, 58];
const LAPIZ_DEL_PRESUPUESTO = { x: 10, y: 40.5 } as const;

function Encabezado() {
  return (
    <g>
      <rect x={8} y={9} width={10} height={10} className="tinta" />
      <path d="M22 11H44M22 16.5H36" className="fina" />
    </g>
  );
}

function Partidas({ renglones }: { renglones: readonly number[] }) {
  return (
    <g>
      <path d={renglones.map((v) => `M8 ${String(v)}H34`).join('')} className="fina" />
      <path d={renglones.map((v) => `M42 ${String(v)}H54`).join('')} />
    </g>
  );
}

function Preparando() {
  const { largo, ancho } = PAGINA;
  const medida = limites([
    { x: 0, y: 0, z: 0, largo, ancho, alto: 1 },
    { ...LAPIZ_DEL_PRESUPUESTO, z: 1, largo: LARGO_DEL_LAPIZ, ancho: 7, alto: 3 },
  ]);
  return (
    <Escena medida={medida}>
      <Hoja x={0} y={0} z={0} largo={largo} ancho={ancho}>
        <Encabezado />
        <Partidas renglones={PARTIDAS_HECHAS} />
        <path
          d={`${PARTIDAS_QUE_FALTAN.map((v) => `M8 ${String(v)}H34M42 ${String(v)}H54`).join('')}M8 66H54M36 74H54`}
          className="trazos"
        />
      </Hoja>
      <Lapiz x={LAPIZ_DEL_PRESUPUESTO.x} y={LAPIZ_DEL_PRESUPUESTO.y} z={1} />
    </Escena>
  );
}

function HojasDelPresupuesto() {
  const { largo, ancho, corrida, caida } = PAGINA;
  return (
    <g>
      <Hoja x={corrida} y={-caida} z={0} largo={largo} ancho={ancho} />
      <Hoja x={0} y={0} z={1} largo={largo} ancho={ancho}>
        <Encabezado />
        <Partidas renglones={PARTIDAS} />
        <path d="M8 60H54" className="fina" />
        <path d="M36 68H54" />
        <path d="M36 73H54M36 75.5H54" className="fina" />
        <path d="M50 14V-4a3 3 0 0 1 6 0V17a4.5 4.5 0 0 1-9 0V-1" />
      </Hoja>
    </g>
  );
}

function limitesDelPresupuesto(): Limites {
  const { largo, ancho, corrida, caida } = PAGINA;
  return limites([
    { x: 0, y: -caida - 3, z: 0, largo: largo + corrida, ancho: ancho + caida + 3, alto: 1 },
  ]);
}

function Presupuesto() {
  return (
    <Escena medida={limitesDelPresupuesto()}>
      <HojasDelPresupuesto />
    </Escena>
  );
}

const MONEDA = { radio: 9.5, espesor: 2.2, cuantas: 5, x: 38, y: 64 } as const;

const CONTORNO_DE_LA_MONEDA: Contorno = Array.from({ length: 32 }, (_, paso) => {
  const giro = (paso * Math.PI) / 16;
  return [
    redondear(MONEDA.x + MONEDA.radio * Math.cos(giro)),
    redondear(MONEDA.y + MONEDA.radio * Math.sin(giro)),
  ] as const;
});

function Sena() {
  const tope = 1 + MONEDA.cuantas * MONEDA.espesor;
  const medida = unir(
    limitesDelPresupuesto(),
    encerrar(CONTORNO_DE_LA_MONEDA.map(([x, y]): Punto3 => [x, y, tope])),
  );
  return (
    <Escena medida={medida}>
      <HojasDelPresupuesto />
      {Array.from({ length: MONEDA.cuantas }, (_, moneda) => (
        <Losa
          key={moneda}
          contorno={CONTORNO_DE_LA_MONEDA}
          z={1 + moneda * MONEDA.espesor}
          espesor={MONEDA.espesor}
        />
      ))}
    </Escena>
  );
}

const TABLERO = { largo: 84, ancho: 56, alto: 5 } as const;
const CORTE = { y: 20, desde: 38, sierra: 2 } as const;
const SIERRA = { hoja: 58, punta: 8, talon: 15, mango: 22, alto: 24, inclinacion: 35 } as const;

function TableroConCorte() {
  const { largo, ancho, alto } = TABLERO;
  const { y: c0, desde, sierra } = CORTE;
  const c1 = c0 + sierra;
  const a = iso(0, 0, alto);
  const b = iso(largo, 0, alto);
  const c = iso(largo, ancho, alto);
  const d = iso(0, ancho, alto);
  const e = iso(largo, 0, 0);
  const f = iso(largo, ancho, 0);
  const g = iso(0, ancho, 0);
  const entra = iso(largo, c0, alto);
  const fondo = iso(desde, c0, alto);
  const otroFondo = iso(desde, c1, alto);
  const sale = iso(largo, c1, alto);
  const entraAbajo = iso(largo, c0, 0);
  const saleAbajo = iso(largo, c1, 0);
  return (
    <g>
      <polygon
        points={puntos(a, b, entra, fondo, otroFondo, sale, c, d)}
        className="cara sin-linea"
      />
      <polygon points={puntos(d, c, f, g)} className="cara sin-linea" />
      <polygon points={puntos(b, entra, entraAbajo, e)} className="costado sin-linea" />
      <polygon points={puntos(sale, c, f, saleAbajo)} className="costado sin-linea" />
      <polygon
        points={puntos(entra, fondo, otroFondo, sale, saleAbajo, entraAbajo)}
        className="tinta sin-linea"
      />
      <path
        d={[
          recorrido(entraAbajo, e, b, a, d, g, f, saleAbajo),
          recorrido(d, c, sale, otroFondo, fondo, entra, b),
          recorrido(c, f),
          recorrido(entra, entraAbajo),
          recorrido(sale, saleAbajo),
        ].join('')}
      />
    </g>
  );
}

function Serrucho() {
  const { hoja, punta, talon, mango, alto } = SIERRA;
  const dientes: string[] = ['M1 0'];
  for (let paso = 1; paso < hoja - 3; paso += 3) {
    dientes.push(`L${String(paso + 1.5)} 1.8L${String(paso + 3)} 0`);
  }
  const m = (valor: number) => String(hoja + valor);
  const arriba = String(-alto);
  return (
    <g>
      <polygon
        points={`0,0 ${String(hoja)},0 ${String(hoja)},${String(-talon)} 0,${String(-punta)}`}
        className="cara"
      />
      <path d={dientes.join('')} className="fina" />
      <path
        d={`M${m(-3)} 3H${m(mango - 8)}Q${m(mango)} 3 ${m(mango)}-5V-16Q${m(mango)}${arriba} ${m(mango - 8)}${arriba}H${m(1)}Q${m(-3)}${arriba} ${m(-3)}-20ZM${m(5)}-4H${m(15)}Q${m(17)}-4 ${m(17)}-6V-14Q${m(17)}-16 ${m(15)}-16H${m(5)}Q${m(3)}-16 ${m(3)}-14V-6Q${m(3)}-4 ${m(5)}-4Z`}
        fillRule="evenodd"
        className="costado"
      />
      <circle cx={hoja - 5} cy={-6} r={1} className="fina" />
      <circle cx={hoja - 5} cy={-13} r={1} className="fina" />
    </g>
  );
}

function enLaSierra(u: number, v: number): Punto3 {
  const angulo = (SIERRA.inclinacion * Math.PI) / 180;
  return [
    CORTE.desde + 1 + u * Math.cos(angulo) + v * Math.sin(angulo),
    CORTE.y + CORTE.sierra / 2,
    u * Math.sin(angulo) - v * Math.cos(angulo),
  ];
}

function Fabricacion() {
  const recorte = useId();
  const { largo, ancho, alto } = TABLERO;
  const [punta, plano] = enLaSierra(0, 0);
  const fin = SIERRA.hoja + SIERRA.mango;
  const medida = unir(
    limites([{ x: 0, y: 0, z: 0, largo, ancho, alto }]),
    encerrar([
      enLaSierra(fin, 3),
      enLaSierra(fin, -SIERRA.alto),
      enLaSierra(SIERRA.hoja - 3, -SIERRA.alto),
    ]),
  );
  return (
    <Escena medida={medida}>
      <TableroConCorte />
      <EnElPlano transform={planoDelPiso(alto)}>
        <path d={`M${String(CORTE.desde)} ${String(plano)}H-10`} className="eje" />
      </EnElPlano>
      <EnElPlano transform={planoDeFrente(plano)}>
        <defs>
          <clipPath id={recorte}>
            <rect x={-50} y={-300} width={400} height={300 - alto} />
          </clipPath>
        </defs>
        <g clipPath={`url(#${recorte})`}>
          <g transform={`translate(${String(punta)} 0) rotate(${String(-SIERRA.inclinacion)})`}>
            <Serrucho />
          </g>
        </g>
      </EnElPlano>
    </Escena>
  );
}

const CASA = { largo: 48, ancho: 56, alto: 28, techo: 26, alero: 3, espesor: 2.5 } as const;

function techo() {
  const { largo, ancho, alto, techo: subida, alero, espesor } = CASA;
  const medio = largo / 2;
  const cumbre = alto + subida;
  const borde = alto - (alero * subida) / medio;
  return {
    medio,
    cumbre,
    borde,
    bajo: borde - espesor,
    atras: -alero,
    frente: ancho + alero,
    derecha: largo + alero,
    izquierda: -alero,
  };
}

function Casa() {
  const { largo, ancho, alto, espesor } = CASA;
  const { medio, cumbre, borde, bajo, atras, frente, derecha, izquierda } = techo();
  return (
    <g>
      <Caja x={0} y={0} z={0} largo={largo} ancho={ancho} alto={alto} />
      <Cara
        vertices={[
          [0, ancho, 0],
          [largo, ancho, 0],
          [largo, ancho, alto],
          [medio, ancho, cumbre],
          [0, ancho, alto],
        ]}
        relleno="cara"
      />
      <EnElPlano transform={planoDeFrente(ancho)}>
        <path d={`M${String(medio - 7)} 0V-20H${String(medio + 7)}V0`} />
        <circle cx={medio + 4} cy={-10} r={0.9} className="tinta" />
        <circle cx={medio} cy={-(alto + 9)} r={4} />
      </EnElPlano>
      <EnElPlano transform={planoDeCostado(largo)}>
        {[9, 33].map((u) => (
          <g key={u}>
            <rect x={u} y={-21} width={14} height={11} className="cara" />
            <path
              d={`M${String(u + 7)} -21V-10M${String(u)} -15.5H${String(u + 14)}`}
              className="fina"
            />
          </g>
        ))}
      </EnElPlano>
      <Cara
        vertices={[
          [medio, atras, cumbre],
          [medio, frente, cumbre],
          [derecha, frente, borde],
          [derecha, atras, borde],
        ]}
        relleno="cara"
      />
      {[derecha, izquierda].map((lado) => (
        <Cara
          key={lado}
          vertices={[
            [medio, frente, cumbre],
            [lado, frente, borde],
            [lado, frente, bajo],
            [medio, frente, cumbre - espesor],
          ]}
          relleno="tinta"
        />
      ))}
      <Cara
        vertices={[
          [derecha, atras, borde],
          [derecha, frente, borde],
          [derecha, frente, bajo],
          [derecha, atras, bajo],
        ]}
        relleno="tinta"
      />
    </g>
  );
}

function limitesDeLaCasa(): Limites {
  const { largo, ancho, alto } = CASA;
  const { medio, cumbre, borde, bajo, atras, frente, derecha, izquierda } = techo();
  return unir(
    limites([{ x: 0, y: 0, z: 0, largo, ancho, alto }]),
    encerrar([
      [medio, atras, cumbre],
      [derecha, atras, borde],
      [izquierda, frente, borde],
      [izquierda, frente, bajo],
      [derecha, frente, bajo],
    ]),
  );
}

function Entregado() {
  return (
    <Escena medida={limitesDeLaCasa()}>
      <Casa />
    </Escena>
  );
}

const TILDE_DEL_PAGO = { x: 33, y: -54 } as const;
const MEDIDA_DE_LA_TILDE: Limites = { izquierda: 0, derecha: 21.3, arriba: -1.95, abajo: 15.75 };

function Pagado() {
  const { x, y } = TILDE_DEL_PAGO;
  return (
    <Escena medida={unir(limitesDeLaCasa(), correr(MEDIDA_DE_LA_TILDE, x, y))}>
      <Casa />
      <path d={TILDE} transform={`translate(${String(x)} ${String(y)})`} className="mano" />
    </Escena>
  );
}

const ESCENAS = {
  estimativo: Estimativo,
  preparando: Preparando,
  presupuesto: Presupuesto,
  sena: Sena,
  fabricacion: Fabricacion,
  entregado: Entregado,
  pagado: Pagado,
} as const satisfies Record<string, ComponentType>;

export type EtapaDelTrabajo = keyof typeof ESCENAS;

export const ETAPAS_DEL_TRABAJO = Object.keys(ESCENAS) as readonly EtapaDelTrabajo[];

export interface TrabajoEnEtapaProps {
  etapa: EtapaDelTrabajo;
}

export function TrabajoEnEtapa({ etapa }: TrabajoEnEtapaProps) {
  const Dibujo: ComponentType = ESCENAS[etapa];
  return <Dibujo />;
}
