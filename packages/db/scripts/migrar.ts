import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { stdin, stdout } from 'node:process';
import { createInterface, type Interface } from 'node:readline/promises';
import { parseArgs } from 'node:util';

import { conectar } from './conexion.ts';
import { diaLocal, esFecha, leerSistemaViejo, parsearSaldoLeido } from './migracion/entrada.ts';
import { MigracionRechazada, migrar } from './migracion/escritura.ts';
import {
  diferenciasConElViejo,
  guardarInforme,
  informeDeDatosSucios,
  informeRechazado,
  redactarInforme,
  type EncabezadoDelInforme,
} from './migracion/informe.ts';
import { armarPlan, saldosEnCero, TESOROS_EN_ORDEN } from './migracion/plan.ts';

const USO = `Uso:
  pnpm --filter @maun/db db:migrar --archivo <json> --household <id> \\
    --hogar=<saldo> --maun=<saldo> --diezmo=<saldo> --cocos=<saldo> \\
    [--corte AAAA-MM-DD] [--separar "<nombre exacto>"]... [--informes <carpeta>] [--escribir]

Los cuatro saldos van como los muestra el sistema viejo el día del corte (1.234.567, o -124.000),
con "=" para que un saldo negativo no se lea como otra opción. Sin --escribir es un ensayo.`;

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

const encabezado: EncabezadoDelInforme = {
  modo: values.escribir ? 'escritura' : 'ensayo',
  generado: new Date(),
  archivo: path.resolve(archivo),
  huella: createHash('sha256').update(contenido).digest('hex'),
  householdId,
  corte,
  leidos,
  separar: values.separar,
};
const carpeta = values.informes ?? path.dirname(path.resolve(archivo));

const sistema = leerSistemaViejo(json);
if (sistema.sucios.length > 0) {
  const informe = informeDeDatosSucios(sistema, encabezado);
  console.log(informe);
  salir(`Informe guardado en ${guardarInforme(carpeta, encabezado, informe)}`);
}

const plan = armarPlan(sistema, { separar: values.separar, corte });

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
