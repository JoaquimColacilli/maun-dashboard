import { useId, type ReactNode } from 'react';

import { ALTO_DE_ESCENA, ANCHO_DE_ESCENA, Lienzo } from './lienzo.tsx';
import { CRUZ, VUELTA } from './mano.ts';
import {
  Agenda,
  Etiqueta,
  Hoja,
  limitesDelMetro,
  Metro,
  Mueble,
  PlanoDelMueble,
} from './objetos.tsx';
import {
  encerrar,
  limites,
  planoDeFrente,
  planoDelPiso,
  planoInclinado,
  type Limites,
  type Volumen,
} from './proyeccion.ts';
import { Caja, Cara, Cota, EnElPlano } from './trazos.tsx';

function Escena({
  volumenes,
  medida,
  children,
}: {
  volumenes?: readonly Volumen[];
  medida?: Limites;
  children: ReactNode;
}) {
  return (
    <Lienzo
      limites={medida ?? limites(volumenes ?? [])}
      ancho={ANCHO_DE_ESCENA}
      alto={ALTO_DE_ESCENA}
    >
      {children}
    </Lienzo>
  );
}

const HOJA: Volumen = { x: 0, y: 0, z: 0, largo: 88, ancho: 66, alto: 0 };

const MUEBLE = { largo: 72, profundidad: 28, alto: 48 } as const;

export function SinProyectos() {
  const { largo, profundidad, alto } = MUEBLE;
  return (
    <Escena
      volumenes={[
        { x: -2, y: -1, z: 0, largo: largo + 4, ancho: profundidad + 3, alto },
        { x: 0, y: profundidad, z: -12, largo, ancho: 0, alto: 12 },
      ]}
    >
      <Mueble x={0} y={0} z={0} {...MUEBLE} fantasma />
      <EnElPlano transform={planoDeFrente(profundidad)}>
        <Cota desde={0} hasta={largo} borde={0} separacion={-9} />
      </EnElPlano>
    </Escena>
  );
}

export function SinConsultas() {
  return (
    <Escena medida={limitesDelMetro({ x: 0, y: 0, z: 0 })}>
      <Metro x={0} y={0} z={0} />
    </Escena>
  );
}

export function SinSeguimiento() {
  return (
    <Escena volumenes={[HOJA]}>
      <Hoja x={0} y={0} z={0} largo={88} ancho={66} esquina>
        <PlanoDelMueble x={16} y={20} />
      </Hoja>
    </Escena>
  );
}

export function SinClientes() {
  return (
    <Escena volumenes={[{ x: 0, y: 0, z: 0, largo: 69, ancho: 86, alto: 9 }]}>
      <Agenda x={0} y={0} z={0} />
    </Escena>
  );
}

export function SinMovimientos() {
  return (
    <Escena volumenes={[{ x: 0, y: -3, z: 0, largo: 96, ancho: 66, alto: 28 }]}>
      {[0, 1, 2, 3].map((indice) => (
        <Caja
          key={indice}
          x={indice % 2 === 0 ? 0 : 4}
          y={indice % 2 === 0 ? 0 : -3}
          z={indice * 7}
          largo={92}
          ancho={63}
          alto={6}
          izquierda="cara"
          derecha="cara"
        />
      ))}
    </Escena>
  );
}

export function SinOpiniones() {
  return (
    <Escena volumenes={[{ x: -2, y: -1, z: 0, largo: 76, ancho: 31, alto: 48 }]}>
      <Mueble x={0} y={0} z={0} largo={72} profundidad={28} alto={48}>
        <Etiqueta />
      </Mueble>
    </Escena>
  );
}

const TARJETA = { largo: 80, pie: 19, alto: 46 } as const;
const FIRMA =
  'M2 18c4-10 9-19 13-17c4 2-4 14-8 16c6-7 12-9 15-6c2 2-1 5 2 5c4 0 8-7 12-9c-3 7-6 11-4 12c3 1 9-4 12-6c-10 8-26 11-44 12';

export function Gracias({ animar }: { animar: boolean }) {
  const { largo, pie, alto } = TARJETA;
  const lomo = [
    [0, pie, alto],
    [largo, pie, alto],
  ] as const;
  return (
    <Escena
      medida={encerrar([...lomo, [0, 0, 0], [largo, 0, 0], [largo, 2 * pie, 0], [0, 2 * pie, 0]])}
    >
      <Cara vertices={[...lomo, [largo, 0, 0], [0, 0, 0]]} relleno="costado" />
      <Cara vertices={[...lomo, [largo, 2 * pie, 0], [0, 2 * pie, 0]]} relleno="cara" />
      <EnElPlano transform={planoInclinado([0, pie, alto], [0, 2 * pie, 0])}>
        <path
          d={FIRMA}
          pathLength={1}
          transform="translate(18 12) scale(1.1)"
          className={animar ? 'mano trazar' : 'mano'}
        />
      </EnElPlano>
    </Escena>
  );
}

export function AgendaVacia() {
  const lineas: string[] = [];
  for (let columna = 0; columna <= 7; columna += 1) {
    lineas.push(`M${String(8 + columna * 11)} 22V77`);
  }
  for (let fila = 0; fila <= 5; fila += 1) {
    lineas.push(`M8 ${String(22 + fila * 11)}H85`);
  }
  return (
    <Escena volumenes={[{ x: 0, y: 0, z: 0, largo: 90, ancho: 84, alto: 0 }]}>
      <Hoja x={0} y={0} z={0} largo={90} ancho={84}>
        <path d="M8 12H48" />
        <path d={lineas.join('')} className="fina" />
        <path d={VUELTA} transform="translate(47 43)" className="mano" />
      </Hoja>
    </Escena>
  );
}

export function SinSenal() {
  return (
    <Escena volumenes={[HOJA]}>
      <Hoja x={0} y={0} z={0} largo={88} ancho={66}>
        <PlanoDelMueble x={20} y={20} linea="trazos" />
      </Hoja>
    </Escena>
  );
}

export function Anulado() {
  return (
    <Escena volumenes={[HOJA]}>
      <Hoja x={0} y={0} z={0} largo={88} ancho={66}>
        <PlanoDelMueble x={20} y={20} />
        <path d={CRUZ} transform="translate(22 14)" className="mano" />
      </Hoja>
    </Escena>
  );
}

export function SeCorto() {
  const recorte = useId();
  const mitad = 44;
  const aire = 7;
  const caida = 3;
  return (
    <Escena volumenes={[{ ...HOJA, largo: 88 + aire, ancho: 66 + caida }]}>
      <defs>
        <clipPath id={`${recorte}a`}>
          <rect x={0} y={0} width={mitad} height={66} />
        </clipPath>
        <clipPath id={`${recorte}b`}>
          <rect x={mitad} y={0} width={88 - mitad} height={66} />
        </clipPath>
      </defs>
      <Hoja x={0} y={0} z={0} largo={mitad} ancho={66}>
        <g clipPath={`url(#${recorte}a)`}>
          <PlanoDelMueble x={20} y={20} />
        </g>
      </Hoja>
      <Hoja x={mitad + aire} y={caida} z={0} largo={88 - mitad} ancho={66}>
        <g transform={`translate(${String(aire)} ${String(caida)})`}>
          <g clipPath={`url(#${recorte}b)`}>
            <PlanoDelMueble x={20} y={20} />
          </g>
        </g>
      </Hoja>
      <EnElPlano transform={planoDelPiso(0)}>
        <path d={`M${String(mitad + aire / 2)} -12V${String(66 + caida + 12)}`} className="eje" />
      </EnElPlano>
    </Escena>
  );
}
