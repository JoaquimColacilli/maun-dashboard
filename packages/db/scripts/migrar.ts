import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { stdin, stdout } from 'node:process';
import { createInterface, type Interface } from 'node:readline/promises';
import { parseArgs } from 'node:util';

import { conectar } from './conexion.ts';
import { diaLocal, esFecha, leerSistemaViejo, parsearSaldoLeido } from './migracion/entrada.ts';
import {
  MigracionRechazada,
  migrar,
  type AjustesDeHoy,
  type LoDeDespues,
} from './migracion/escritura.ts';
import {
  diferenciasConElViejo,
  guardarInforme,
  informeDeDatosSucios,
  informeRechazado,
  redactarInforme,
  type EncabezadoDelInforme,
} from './migracion/informe.ts';
import { armarPlan, saldosEnCero, TESOROS_EN_ORDEN, type Plan } from './migracion/plan.ts';

const USO = `Uso:
  pnpm --filter @maun/db db:migrar --archivo <json> --household <id> \\
    --hogar=<saldo> --maun=<saldo> --diezmo=<saldo> --cocos=<saldo> \\
    [--corte AAAA-MM-DD] [--separar "<nombre exacto>"]... [--insumos-como-notas <id viejo>]... \\
    [--sueldo-despues=<importe> --fijos-despues=<importe> --meta-cocos-despues=<importe> \\
     --tasa-cocos-despues=<porcentaje>] [--cocos-despues=<saldo real>] \\
    [--informes <carpeta>] [--escribir]

Los cuatro saldos van como los muestra el sistema viejo el día del corte (1.234.567, o -124.000),
con "=" para que un saldo negativo no se lea como otra opción. Sin --escribir es un ensayo.

Las opciones --*-despues se aplican al final, en la misma transacción: los cuatro ajustes van
juntos (la tasa en porcentaje: 26 es 26%), y --cocos-despues es el saldo real de Cocos, del que el
script ajusta la diferencia contra el saldo que quedó.`;

function salir(mensaje: string): never {
  console.error(mensaje);
  process.exit(1);
}

const { values } = parseArgs({
  allowPositionals: true,
  options: {
    archivo: { type: 'string' },
    household: { type: 'string' },
    hogar: { type: 'string' },
    maun: { type: 'string' },
    diezmo: { type: 'string' },
    cocos: { type: 'string' },
    corte: { type: 'string' },
    separar: { type: 'string', multiple: true, default: [] },
    'insumos-como-notas': { type: 'string', multiple: true, default: [] },
    'sueldo-despues': { type: 'string' },
    'fijos-despues': { type: 'string' },
    'meta-cocos-despues': { type: 'string' },
    'tasa-cocos-despues': { type: 'string' },
    'cocos-despues': { type: 'string' },
    informes: { type: 'string' },
    escribir: { type: 'boolean', default: false },
  },
});

const archivo = values.archivo ?? salir(`Falta --archivo.\n\n${USO}`);
const householdId = values.household ?? salir(`Falta --household.\n\n${USO}`);
if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(householdId)) {
  salir(`--household tiene que ser el id del household: ${householdId} no lo es.`);
}

const leidos = saldosEnCero();
for (const tesoro of TESOROS_EN_ORDEN) {
  const escrito =
    values[tesoro] ??
    salir(
      `Falta --${tesoro}: el saldo de ${tesoro.toUpperCase()} como lo muestra el sistema viejo el día del corte.\n\n${USO}`,
    );
  const importe = parsearSaldoLeido(escrito);
  if (importe === null) {
    salir(
      `--${tesoro}=${escrito} no se entiende. Escribilo como lo muestra la app vieja: 1.234.567, o -124.000.`,
    );
  }
  leidos[tesoro] = importe;
}

function importeSinSigno(nombre: string, escrito: string): number {
  const importe = parsearSaldoLeido(escrito);
  if (importe === null || importe < 0) {
    salir(
      `--${nombre}=${escrito} no se entiende: tiene que ser un importe sin signo, como 1.800.000.`,
    );
  }
  return importe;
}

const sueldoDespues = values['sueldo-despues'];
const fijosDespues = values['fijos-despues'];
const metaDespues = values['meta-cocos-despues'];
const tasaDespues = values['tasa-cocos-despues'];
let ajustesDeHoy: AjustesDeHoy | null = null;
if ([sueldoDespues, fijosDespues, metaDespues, tasaDespues].some((valor) => valor !== undefined)) {
  if (
    sueldoDespues === undefined ||
    fijosDespues === undefined ||
    metaDespues === undefined ||
    tasaDespues === undefined
  ) {
    salir(
      'Los ajustes de después van los cuatro juntos: --sueldo-despues, --fijos-despues, --meta-cocos-despues y --tasa-cocos-despues.',
    );
  }
  const tasaBp = importeSinSigno('tasa-cocos-despues', tasaDespues);
  if (tasaBp > 100_000) {
    salir(`--tasa-cocos-despues=${tasaDespues} está fuera de lo que acepta la base (hasta 1000%).`);
  }
  ajustesDeHoy = {
    sueldo: importeSinSigno('sueldo-despues', sueldoDespues),
    fijos: importeSinSigno('fijos-despues', fijosDespues),
    metaCocos: importeSinSigno('meta-cocos-despues', metaDespues),
    tasaBp,
  };
}
const cocosDespues = values['cocos-despues'];
const despues: LoDeDespues = {
  ajustes: ajustesDeHoy,
  cocos: cocosDespues === undefined ? null : importeSinSigno('cocos-despues', cocosDespues),
};

const corte = values.corte ?? diaLocal(new Date());
if (!esFecha(corte)) {
  salir(`--corte tiene que ser una fecha AAAA-MM-DD: ${values.corte ?? ''} no lo es.`);
}

let contenido = '';
try {
  contenido = readFileSync(archivo, 'utf8');
} catch {
  salir(`No se pudo leer ${archivo}.`);
}
let json: unknown;
try {
  json = JSON.parse(contenido);
} catch {
  salir(`${archivo} no es JSON válido.`);
}

const insumosComoNotas = values['insumos-como-notas'];
const encabezado: EncabezadoDelInforme = {
  modo: values.escribir ? 'escritura' : 'ensayo',
  generado: new Date(),
  archivo: path.resolve(archivo),
  huella: createHash('sha256').update(contenido).digest('hex'),
  householdId,
  corte,
  leidos,
  separar: values.separar,
  insumosComoNotas,
  despues,
};
const carpeta = values.informes ?? path.dirname(path.resolve(archivo));

const sistema = leerSistemaViejo(json);
if (sistema.sucios.length > 0) {
  const informe = informeDeDatosSucios(sistema, encabezado);
  console.log(informe);
  salir(`Informe guardado en ${guardarInforme(carpeta, encabezado, informe)}`);
}

let plan: Plan;
try {
  plan = armarPlan(sistema, { separar: values.separar, insumosComoNotas, corte });
} catch (error) {
  salir(error instanceof Error ? error.message : String(error));
}

let terminal: Interface | undefined;
function preguntar(pregunta: string): Promise<string> {
  terminal ??= createInterface({ input: stdin, output: stdout });
  return terminal.question(pregunta);
}

const cliente = await conectar();
let abierta = false;
try {
  await cliente.query('begin');
  abierta = true;

  const resultado = await migrar(cliente, plan, {
    householdId,
    leidos,
    corte,
    despues,
    confirmarClientes: async (descripcion) => {
      if (encabezado.modo === 'ensayo') return true;
      console.log(`\n${descripcion}\n`);
      const respuesta = await preguntar(
        '¿Los clientes quedaron bien agrupados? Todavía no se escribió nada. (s/n) ',
      );
      return respuesta.trim().toLowerCase().startsWith('s');
    },
  });

  if (encabezado.modo === 'ensayo') {
    await cliente.query('rollback');
    abierta = false;
    const informe = redactarInforme(
      plan,
      resultado,
      encabezado,
      'Ensayo: no se escribió nada. Todo corrió en una transacción que terminó en rollback.',
    );
    console.log(informe);
    console.log(`Informe guardado en ${guardarInforme(carpeta, encabezado, informe)}`);
  } else {
    const pendiente = redactarInforme(
      plan,
      resultado,
      encabezado,
      'Escritura sin confirmar: si este informe quedó así, no se escribió nada.',
    );
    const ruta = guardarInforme(carpeta, encabezado, pendiente);
    console.log(pendiente);
    console.log(`Informe guardado en ${ruta}`);
    for (const diferencia of diferenciasConElViejo(leidos, plan.saldosViejos)) {
      console.log(`Atención: ${diferencia}`);
    }

    const respuesta = await preguntar(
      '\nTodo esto está adentro de una transacción abierta. Para escribirlo en la base, escribí "confirmo": ',
    );
    const confirmada = respuesta.trim() === 'confirmo';
    await cliente.query(confirmada ? 'commit' : 'rollback');
    abierta = false;
    writeFileSync(
      ruta,
      redactarInforme(
        plan,
        resultado,
        encabezado,
        confirmada
          ? `Escritura confirmada: quedó escrito en la base el ${new Date().toLocaleString('es-AR')}.`
          : 'Escritura cancelada: no se confirmó y no se escribió nada.',
      ),
      'utf8',
    );
    console.log(confirmada ? 'Listo: quedó escrito.' : 'No se escribió nada.');
  }
} catch (error) {
  if (abierta) await cliente.query('rollback');
  if (!(error instanceof MigracionRechazada)) throw error;
  console.error(error.message);
  console.error(
    `Informe guardado en ${guardarInforme(carpeta, encabezado, informeRechazado(error.message, plan, encabezado))}`,
  );
  process.exitCode = 1;
} finally {
  terminal?.close();
  await cliente.end();
}
