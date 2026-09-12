import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import type { Tesoro } from '../../src/enums.ts';
import { describirGrupos } from './clientes.ts';
import { diaLocal, ESTADOS_VIEJOS, type SistemaViejo } from './entrada.ts';
import type { ResultadoDeLaMigracion } from './escritura.ts';
import {
  ESTADO_NUEVO,
  TESOROS_EN_ORDEN,
  type Plan,
  type Saldos,
  type SaldosViejos,
} from './plan.ts';

export type ModoDeMigracion = 'ensayo' | 'escritura';

export interface EncabezadoDelInforme {
  modo: ModoDeMigracion;
  generado: Date;
  archivo: string;
  huella: string;
  householdId: string;
  corte: string;
  leidos: Saldos;
  separar: readonly string[];
}

export const DIFERENCIA_TOLERADA_CON_EL_VIEJO = 50;

const NOMBRE_DEL_TESORO: Record<Tesoro, string> = {
  hogar: 'HOGAR',
  maun: 'MAUN',
  diezmo: 'DIEZMO',
  cocos: 'COCOS',
};

export function pesos(importe: number): string {
  const signo = importe < 0 ? '-' : '';
  const absoluto = Math.abs(importe);
  const enteros = String(Math.floor(absoluto / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const resto = absoluto % 100;
  return `${signo}$${enteros}${resto === 0 ? '' : `,${String(resto).padStart(2, '0')}`}`;
}

function tabla(encabezados: readonly string[], filas: readonly (readonly string[])[]): string[] {
  const celda = (texto: string) => texto.replaceAll('|', '\\|').replaceAll('\n', ' ');
  return [
    `| ${encabezados.map(celda).join(' | ')} |`,
    `| ${encabezados.map(() => '---').join(' | ')} |`,
    ...filas.map((fila) => `| ${fila.map(celda).join(' | ')} |`),
  ];
}

function puntos(items: readonly string[], siNoHay: string): string[] {
  return items.length === 0 ? [siNoHay] : items.map((item) => `- ${item}`);
}

function instante(fecha: Date): string {
  const hora = [fecha.getHours(), fecha.getMinutes(), fecha.getSeconds()]
    .map((parte) => String(parte).padStart(2, '0'))
    .join(':');
  return `${diaLocal(fecha)} ${hora}`;
}

export function nombreDelInforme(encabezado: EncabezadoDelInforme): string {
  const marca = instante(encabezado.generado)
    .replaceAll('-', '')
    .replace(' ', '-')
    .replaceAll(':', '');
  return `informe-migracion-${encabezado.modo}-${marca}.md`;
}

export function guardarInforme(
  carpeta: string,
  encabezado: EncabezadoDelInforme,
  texto: string,
): string {
  mkdirSync(carpeta, { recursive: true });
  const ruta = path.join(carpeta, nombreDelInforme(encabezado));
  writeFileSync(ruta, texto, 'utf8');
  return ruta;
}

export function diferenciasConElViejo(leidos: Saldos, viejos: SaldosViejos): string[] {
  return TESOROS_EN_ORDEN.flatMap((tesoro) => {
    const diferencia = leidos[tesoro] - viejos[tesoro];
    if (Math.abs(diferencia) <= DIFERENCIA_TOLERADA_CON_EL_VIEJO) return [];
    return [
      `${NOMBRE_DEL_TESORO[tesoro]}: leíste ${pesos(leidos[tesoro])} y el sistema viejo, con este mismo JSON, calcula ${pesos(viejos[tesoro])} (diferencia ${pesos(diferencia)}).`,
    ];
  });
}

function encabezado(datos: EncabezadoDelInforme, titulo: string): string[] {
  const leidos = TESOROS_EN_ORDEN.map(
    (tesoro) => `${NOMBRE_DEL_TESORO[tesoro]} ${pesos(datos.leidos[tesoro])}`,
  ).join(' · ');
  return [
    `# Migración del sistema viejo: ${titulo}`,
    '',
    `- Generado: ${instante(datos.generado)}`,
    `- Archivo: ${datos.archivo}`,
    `- SHA-256 del archivo: ${datos.huella}`,
    `- Household destino: ${datos.householdId}`,
    `- Fecha de corte: ${datos.corte}`,
    `- Saldos que leíste en el sistema viejo: ${leidos}`,
    `- Nombres separados a mano (--separar): ${datos.separar.length === 0 ? 'ninguno' : datos.separar.map((nombre) => JSON.stringify(nombre)).join(', ')}`,
  ];
}

export function informeDeDatosSucios(sistema: SistemaViejo, datos: EncabezadoDelInforme): string {
  return [
    ...encabezado(datos, 'datos sucios'),
    '',
    `**No se migró nada.** El JSON tiene ${String(sistema.sucios.length)} datos sucios. El script no los corrige solo: corregilos en el archivo y volvé a correr el ensayo.`,
    '',
    '## Datos sucios',
    '',
    ...puntos(sistema.sucios, 'Ninguno.'),
    '',
    '## Avisos',
    '',
    ...puntos(sistema.avisos, 'Ninguno.'),
    '',
  ].join('\n');
}

export function informeRechazado(motivo: string, plan: Plan, datos: EncabezadoDelInforme): string {
  return [
    ...encabezado(datos, 'rechazada'),
    '',
    `**No se escribió nada.** ${motivo}`,
    '',
    '## Clientes',
    '',
    '```',
    describirGrupos(plan.clientes),
    '```',
    '',
    '## Avisos',
    '',
    ...puntos(plan.avisos, 'Ninguno.'),
    '',
  ].join('\n');
}

function seccionDeSaldos(
  plan: Plan,
  resultado: ResultadoDeLaMigracion,
  datos: EncabezadoDelInforme,
) {
  const { saldos, objetivo } = resultado;
  const diferencias = diferenciasConElViejo(datos.leidos, plan.saldosViejos);
  return [
    '## Saldos',
    '',
    '«De los proyectos» son los pagos, los gastos y el reparto de los cobros, que arma la vista `libro_mayor`. «A mano» son los movimientos de `maun3_m` que entran. La apertura es la diferencia contra lo que leíste.',
    '',
    'DIEZMO va con el signo de la base: positivo es lo que falta pagar. El sistema viejo lo mostraba al revés (pagado − generado), así que el saldo que leíste entra con el signo cambiado.',
    '',
    ...tabla(
      [
        'Tesoro',
        'De los proyectos',
        'A mano',
        'Apertura',
        'Queda',
        'Tenía que quedar',
        'Leíste',
        'El sistema viejo, con este JSON',
      ],
      TESOROS_EN_ORDEN.map((tesoro) => [
        NOMBRE_DEL_TESORO[tesoro],
        pesos(saldos.proyectos[tesoro]),
        pesos(saldos.manuales[tesoro]),
        pesos(saldos.apertura[tesoro]),
        pesos(saldos.final[tesoro]),
        pesos(objetivo[tesoro]),
        pesos(datos.leidos[tesoro]),
        pesos(plan.saldosViejos[tesoro]),
      ]),
    ),
    '',
    ...(diferencias.length === 0
      ? [
          'Los cuatro saldos que leíste coinciden con los que calcula el sistema viejo con este JSON, contando el redondeo a pesos de su pantalla.',
        ]
      : [
          '**Atención: lo que leíste no coincide con lo que calcula el sistema viejo con este mismo JSON.** Puede ser un error al leer, o un JSON sacado otro día. La apertura igual deja los saldos en lo que leíste.',
          '',
          ...puntos(diferencias, ''),
        ]),
    '',
  ];
}

function seccionDeCobrados(plan: Plan, resultado: ResultadoDeLaMigracion): string[] {
  if (resultado.liquidaciones.length === 0)
    return ['## Cobrados', '', 'No hay proyectos cobrados.', ''];
  return [
    '## Cobrados: el reparto con las reglas de hoy',
    '',
    'El sistema viejo repartía sobre el presupuesto y con los errores del ADR 0003. Acá cada cobro se recalcula con la cascada de hoy sobre lo cobrado, pasando por `cobrar_proyecto`, y la apertura absorbe la diferencia en los saldos.',
    '',
    '**La fecha de cobro es una aproximación**: el sistema viejo no la guardaba. Sale del último pago, y de ella depende en qué mes cae el tope de costos fijos.',
    '',
    ...tabla(
      [
        'Proyecto',
        'Fecha de cobro',
        'Cobrado',
        'Gastos',
        'Neta',
        'Diezmo',
        'Sueldo',
        'Fijos',
        'Remanente',
        'El viejo registró (diezmo · sueldo · fijos)',
      ],
      resultado.liquidaciones.map(({ proyecto, liquidacion }) => {
        const viejo = plan.repartoViejo.get(proyecto.viejo.id);
        return [
          proyecto.viejo.titulo,
          `${liquidacion.fecha} (${proyecto.origenDeLaFechaDeCobro})`,
          pesos(liquidacion.cobrado),
          pesos(liquidacion.gastos),
          pesos(liquidacion.cobrado - liquidacion.gastos),
          pesos(liquidacion.diezmo),
          pesos(liquidacion.sueldo),
          pesos(liquidacion.fijos),
          pesos(liquidacion.remanente),
          viejo === undefined
            ? 'nada'
            : `${pesos(viejo.diezmo)} · ${pesos(viejo.sueldo)} · ${pesos(viejo.fijos)}`,
        ];
      }),
    ),
    '',
  ];
}

function agrupar<T>(items: readonly T[], clave: (item: T) => string, monto: (item: T) => number) {
  const grupos = new Map<string, { cantidad: number; total: number }>();
  for (const item of items) {
    const grupo = grupos.get(clave(item)) ?? { cantidad: 0, total: 0 };
    grupo.cantidad += 1;
    grupo.total += monto(item);
    grupos.set(clave(item), grupo);
  }
  return [...grupos];
}

function lado(tesoro: Tesoro | null): string {
  return tesoro === null ? 'afuera' : NOMBRE_DEL_TESORO[tesoro];
}

export function redactarInforme(
  plan: Plan,
  resultado: ResultadoDeLaMigracion,
  datos: EncabezadoDelInforme,
  desenlace: string,
): string {
  const nombres = plan.clientes.reduce((suma, grupo) => suma + grupo.variantes.length, 0);
  const { household, conteos } = resultado;
  const lineas: string[] = [
    ...encabezado(datos, datos.modo),
    `- Escribe como: ${household.email}, titular de «${household.nombre}»`,
    '',
    `**${desenlace}**`,
    '',
    '## Resumen',
    '',
    ...tabla(
      ['', 'Cantidad'],
      [
        ['Clientes', `${String(plan.clientes.length)} (de ${String(nombres)} nombres distintos)`],
        ['Proyectos', String(conteos.proyectos)],
        ['Cobrados, recalculados', String(conteos.cobrados)],
        ['Pagos', String(conteos.pagos)],
        ['Gastos', String(conteos.gastos)],
        ['Movimientos a mano que entran', String(plan.movimientos.length)],
        ['Movimientos descartados', String(plan.descartados.length)],
        ['Asientos de apertura', String(resultado.aperturas.length)],
      ],
    ),
    '',
    ...seccionDeSaldos(plan, resultado, datos),
    '## Verificaciones',
    '',
    ...puntos(resultado.verificaciones, 'Ninguna.'),
    '',
    '## Datos sucios',
    '',
    'Ninguno.',
    '',
    '## Avisos',
    '',
    ...puntos(plan.avisos, 'Ninguno.'),
    '',
    '## Clientes',
    '',
    'Agrupados por el nombre sin acentos, sin distinguir mayúsculas, con los espacios colapsados y sin puntuación al final. La ñ no es un acento: «Peña» y «Pena» quedan separados. Si un grupo junta variantes, el cliente toma la que tiene más proyectos.',
    '',
    '```',
    describirGrupos(plan.clientes),
    '```',
    '',
    '## Proyectos por estado',
    '',
    ...tabla(
      ['En el sistema viejo', 'Entra como', 'Proyectos'],
      ESTADOS_VIEJOS.map((estado) => [
        estado,
        estado === 'cobrado'
          ? 'cobrado: entra entregado y se cobra con cobrar_proyecto'
          : ESTADO_NUEVO[estado],
        String(plan.proyectos.filter((proyecto) => proyecto.viejo.estado === estado).length),
      ]),
    ),
    '',
    'Ninguno entra como perdido: el sistema viejo no tenía ese estado.',
    '',
    '## Proyectos',
    '',
    ...tabla(
      ['Fila', 'Id viejo', 'Cliente', 'Trabajo', 'Estado', 'Presupuesto', 'Pagos', 'Gastos'],
      plan.proyectos.map((proyecto) => [
        `maun3_p[${String(proyecto.viejo.indice)}]`,
        proyecto.viejo.id,
        proyecto.clienteNombre,
        proyecto.viejo.titulo,
        `${proyecto.viejo.estado} → ${proyecto.liquidar ? 'cobrado' : proyecto.estado}`,
        proyecto.viejo.presupuesto === null ? 'sin presupuesto' : pesos(proyecto.viejo.presupuesto),
        `${String(proyecto.viejo.pagos.length)} · ${pesos(proyecto.cobrado)}`,
        `${String(proyecto.viejo.gastos.length)} · ${pesos(proyecto.gastos)}`,
      ]),
    ),
    '',
    ...seccionDeCobrados(plan, resultado),
    '## Movimientos a mano que entran',
    '',
    ...tabla(
      ['Tipo viejo', 'Entra como', 'Cantidad', 'Total'],
      agrupar(
        plan.movimientos,
        (movimiento) =>
          `${movimiento.viejo.tipo}\t${movimiento.tipo} (${lado(movimiento.origen)} → ${lado(movimiento.destino)})`,
        (movimiento) => movimiento.monto,
      ).map(([clave, grupo]) => [...clave.split('\t'), String(grupo.cantidad), pesos(grupo.total)]),
    ),
    '',
    '## Movimientos descartados',
    '',
    ...(plan.descartados.length === 0
      ? ['Ninguno.']
      : tabla(
          ['Motivo', 'Tipo viejo', 'Cantidad', 'Total'],
          agrupar(
            plan.descartados,
            (movimiento) => `${movimiento.descarte ?? ''}\t${movimiento.tipo}`,
            (movimiento) => movimiento.monto,
          ).map(([clave, grupo]) => [
            ...clave.split('\t'),
            String(grupo.cantidad),
            pesos(grupo.total),
          ]),
        )),
    '',
    '## Apertura',
    '',
    ...(resultado.aperturas.length === 0
      ? ['No hizo falta: los saldos ya daban lo que leíste.']
      : tabla(
          ['Tesoro', 'Asiento', 'Importe', 'Fecha', 'Descripción'],
          resultado.aperturas.map((apertura) => [
            NOMBRE_DEL_TESORO[apertura.tesoro],
            apertura.diferencia > 0
              ? `ajuste: afuera → ${NOMBRE_DEL_TESORO[apertura.tesoro]}`
              : `ajuste: ${NOMBRE_DEL_TESORO[apertura.tesoro]} → afuera`,
            pesos(apertura.diferencia),
            apertura.fecha,
            apertura.descripcion,
          ]),
        )),
    '',
    '## Configuración',
    '',
    ...tabla(
      ['', 'Estaba en el household', 'Queda (de maun3_c)'],
      [
        ['Sueldo', pesos(household.ajustes.sueldo), pesos(plan.sistema.configuracion.sueldo)],
        ['Costos fijos', pesos(household.ajustes.fijos), pesos(plan.sistema.configuracion.fijos)],
        [
          'Meta de Cocos',
          pesos(household.ajustes.metaCocos),
          pesos(plan.sistema.configuracion.metaCocos),
        ],
        [
          'Tasa de Cocos',
          `${String(household.ajustes.tasaBp / 100)}%`,
          `${String(plan.sistema.configuracion.tasaBp / 100)}%`,
        ],
      ],
    ),
    '',
  ];
  return lineas.join('\n');
}
