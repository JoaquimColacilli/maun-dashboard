import { expect, test, type Page } from '@playwright/test';

import {
  ajustarTaller,
  cobrarPorRpc,
  crearCliente,
  distribucionDe,
  guardarProyectoPorRpc,
  iniciarSesionDePrueba,
  leerProyecto,
  vaciarTaller,
  type SesionDePrueba,
} from '../apoyo/taller';

// Ajustes fijos para que la cascada sea la misma en toda la suite: sueldo $500.000 por proyecto y
// costos fijos $250.000 mensuales. Un cobro de $700.000 deja diezmo $70.000, sueldo $500.000 y
// fijos $130.000, que es lo que se afirma abajo.
const SUELDO = 50_000_000;
const FIJOS = 25_000_000;

let sesion: SesionDePrueba;

test.beforeEach(async () => {
  sesion = await iniciarSesionDePrueba();
  await vaciarTaller(sesion);
  await ajustarTaller(sesion, {
    sueldo_mensual_centavos: SUELDO,
    costos_fijos_centavos: FIJOS,
  });
});

interface ProyectoDePrueba {
  id: string;
  clienteId: string;
  titulo: string;
}

async function proyecto(
  titulo: string,
  opciones: { pago?: number; gasto?: number; estado?: string } = {},
): Promise<ProyectoDePrueba> {
  const { pago = 0, gasto = 0, estado = 'entregado' } = opciones;
  const clienteId = await crearCliente(sesion, `Cliente de ${titulo}`);
  const id = crypto.randomUUID();

  await guardarProyectoPorRpc(sesion, {
    proyecto: {
      id,
      version: null,
      cliente_id: clienteId,
      titulo,
      estado,
      presupuesto_centavos: pago,
      comprobante: 'sin_comprobante',
    },
    pagos:
      pago === 0
        ? []
        : [
            {
              id: crypto.randomUUID(),
              fecha: '2026-09-01',
              concepto: 'Seña',
              monto_centavos: pago,
            },
          ],
    gastos:
      gasto === 0
        ? []
        : [
            {
              id: crypto.randomUUID(),
              fecha: '2026-09-02',
              descripcion: 'Melamina',
              monto_centavos: gasto,
            },
          ],
  });
  return { id, clienteId, titulo };
}

async function listoParaCortar(page: Page): Promise<void> {
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => undefined));
  await expect(page.getByRole('status').last()).toBeHidden({ timeout: 20_000 });
}

async function cobrarDesdeLaFicha(page: Page, id: string): Promise<void> {
  await page.goto(`/proyectos/${id}`);
  await page.getByRole('button', { name: /^Cobrar/ }).click();
  await page.getByRole('button', { name: /^Cobrar y repartir/ }).click();
  await expect(page).toHaveURL(new RegExp(`/proyectos/${id}$`));
}

// Arranca y termina en la lista, sin recargar: `page.goto` reinicia la app, y el cobro encolado
// puede no haber llegado todavía a IndexedDB. Cobrar dos seguidos es una sola sesión, que es además
// lo que hace el usuario.
async function cobrarDesdeLaLista(page: Page, titulo: string): Promise<void> {
  await page.getByRole('link', { name: titulo, exact: true }).click();
  await page.getByRole('button', { name: /^Cobrar/ }).click();
  await page.getByRole('button', { name: /^Cobrar y repartir/ }).click();
  await expect(page.getByText('Cobrado, sin confirmar')).toBeVisible();
  await page.getByRole('link', { name: 'Proyectos', exact: true }).first().click();
}

// Los cuatro saldos como los ve el usuario en Inicio. Se comparan por diferencia y no por valor
// absoluto: el taller de prueba conserva sus movimientos entre corridas, y lo que importa es cuánto
// movió el cobro.
interface SaldosDeInicio {
  hogar: number;
  maun: number;
  diezmo: number;
  cocos: number;
}

async function saldosEnInicio(page: Page): Promise<SaldosDeInicio> {
  await page.goto('/');
  const tesoros = page.getByRole('region', { name: 'Tesoros' });
  const leer = async (nombre: string): Promise<number> => {
    const texto = await tesoros.getByRole('button', { name: new RegExp(`^${nombre}`) }).innerText();
    const encontrado = /\$\s?([\d.]+)/.exec(texto);
    if (!encontrado?.[1]) throw new Error(`no se pudo leer el saldo de ${nombre}: «${texto}»`);
    return Number(encontrado[1].replaceAll('.', ''));
  };
  return {
    hogar: await leer('Hogar'),
    maun: await leer('Maun'),
    diezmo: await leer('Diezmo'),
    cocos: await leer('Cocos'),
  };
}

async function esperarEstado(id: string, estado: string): Promise<void> {
  await expect
    .poll(async () => (await distribucionDe(sesion, id))?.estado, { timeout: 30_000 })
    .toBe(estado);
}

test('el despiece se ve antes de cobrar y la distribución queda congelada después', async ({
  page,
}) => {
  const { id } = await proyecto('Placard de tres puertas', { pago: 70_000_000 });

  const antes = await saldosEnInicio(page);

  await page.goto(`/proyectos/${id}`);
  await page.getByRole('button', { name: /^Cobrar/ }).click();

  // La confirmación es el despiece: los importes reales, antes de apretar nada.
  const despiece = page.getByRole('region', { name: 'Distribución de la ganancia' });
  await expect(despiece).toContainText('$ 700.000');
  await expect(despiece).toContainText('Diezmo 10%');
  await expect(despiece).toContainText('$ 70.000');
  await expect(despiece).toContainText('$ 500.000');
  await expect(despiece).toContainText('$ 130.000');

  await page.getByRole('button', { name: /^Cobrar y repartir/ }).click();
  await expect(page).toHaveURL(new RegExp(`/proyectos/${id}$`));

  await esperarEstado(id, 'cobrado');
  const congelada = await distribucionDe(sesion, id);
  expect(congelada?.dist_cobrado_centavos).toBe(70_000_000);
  expect(congelada?.dist_diezmo_centavos).toBe(7_000_000);
  expect(congelada?.dist_sueldo_centavos).toBe(50_000_000);
  expect(congelada?.dist_fijos_centavos).toBe(13_000_000);
  expect(congelada?.dist_remanente_centavos).toBe(0);

  // Y los cuatro tesoros de Inicio se movieron como corresponde. Lo cobrado ya había entrado a MAUN
  // cuando se cargó el pago, que es cuando el cliente puso la plata: lo que hace el cobro es sacar
  // de ahí el diezmo y el sueldo. Por eso MAUN baja 570.000 en vez de subir, y los tres asientos
  // cierran contra cero. Cocos no se toca.
  const despues = await saldosEnInicio(page);
  expect(despues.hogar - antes.hogar).toBe(500_000);
  expect(despues.diezmo - antes.diezmo).toBe(70_000);
  expect(despues.maun - antes.maun).toBe(-570_000);
  expect(despues.cocos - antes.cocos).toBe(0);
});

test('sin señal el cobro queda pendiente de confirmar, sobrevive a cerrar la app y después pasa a firme', async ({
  page,
  context,
}) => {
  const { id } = await proyecto('Mesada sin señal', { pago: 70_000_000 });

  await page.goto(`/proyectos/${id}`);
  await listoParaCortar(page);
  await context.setOffline(true);

  await cobrarDesdeLaFicha(page, id);

  // Cobrado, pero no confirmado: la fila lo dice y la distribución se marca como provisoria.
  await expect(page.getByText('Cobrado, sin confirmar')).toBeVisible();
  await expect(
    page.getByText('Este reparto todavía no lo confirmó el servidor', { exact: false }),
  ).toBeVisible();
  expect((await distribucionDe(sesion, id))?.estado).toBe('entregado');

  // Cerrar la app y reabrirla, sin señal: sigue igual.
  await page.close();
  const reabierta = await context.newPage();
  await reabierta.goto(`/proyectos/${id}`);
  await expect(reabierta.getByText('Cobrado, sin confirmar')).toBeVisible();

  await context.setOffline(false);
  await esperarEstado(id, 'cobrado');
  await expect(reabierta.getByText('Cobrado, sin confirmar')).toBeHidden({ timeout: 30_000 });
});

test('dos cobros del mismo mes hechos sin señal drenan en orden y ninguno rebota', async ({
  page,
  context,
}) => {
  const uno = await proyecto('Primero del mes', { pago: 70_000_000 });
  const dos = await proyecto('Segundo del mes', { pago: 100_000_000 });

  await page.goto('/proyectos');
  await listoParaCortar(page);
  await context.setOffline(true);

  await cobrarDesdeLaLista(page, uno.titulo);
  await cobrarDesdeLaLista(page, dos.titulo);

  await context.setOffline(false);
  await esperarEstado(uno.id, 'cobrado');
  await esperarEstado(dos.id, 'cobrado');

  // El primero se lleva los fijos que le alcanzan y el segundo, solo lo que falta del mes. La app lo
  // supo sin preguntar porque contó en el acumulado la liquidación que tenía en la cola.
  expect((await distribucionDe(sesion, uno.id))?.dist_fijos_centavos).toBe(13_000_000);
  expect((await distribucionDe(sesion, dos.id))?.dist_fijos_centavos).toBe(12_000_000);
  await expect(page.getByText('El servidor lo rechazó')).toBeHidden();
});

test('un cobro rechazado con el formulario ya cerrado avisa igual y se ve en el proyecto', async ({
  page,
  context,
}) => {
  const { id, clienteId, titulo } = await proyecto('Vestidor que rebota', { pago: 70_000_000 });

  await page.goto(`/proyectos/${id}`);
  await listoParaCortar(page);
  await context.setOffline(true);

  await cobrarDesdeLaFicha(page, id);
  await expect(page.getByText('Cobrado, sin confirmar')).toBeVisible();

  // Mientras el cobro está en la cola, el proyecto se edita desde otro lado: la versión sube y el
  // cobro encolado va a rebotar con MN006.
  const fila = await leerProyecto(sesion, titulo);
  await guardarProyectoPorRpc(sesion, {
    proyecto: {
      id,
      version: fila?.version ?? 1,
      cliente_id: clienteId,
      titulo,
      estado: 'entregado',
      presupuesto_centavos: 99_000_000,
      comprobante: 'sin_comprobante',
    },
    pagos: [],
    gastos: [],
  });

  // El usuario se fue a otra pantalla antes de que vuelva la señal.
  await page.goto('/clientes');
  await context.setOffline(false);

  // Se entera igual, esté donde esté.
  const aviso = page.getByRole('alert').filter({ hasText: 'Cobro rechazado' });
  await expect(aviso).toBeVisible({ timeout: 30_000 });
  await expect(aviso).toContainText(titulo);

  // Y el proyecto volvió a su estado anterior, con la marca y el motivo a la vista.
  await aviso.getByRole('button', { name: 'Ver el proyecto' }).click();
  await expect(page.getByText('El servidor lo rechazó')).toBeVisible();
  await expect(page.getByText('Los números cambiaron desde que viste el reparto.')).toBeVisible();
  expect((await distribucionDe(sesion, id))?.estado).toBe('entregado');
});

test('un cobro con el acumulado del mes desactualizado vuelve ajustado y muestra la diferencia', async ({
  page,
  context,
}) => {
  const uno = await proyecto('Cobrado en el taller', { pago: 70_000_000 });
  const dos = await proyecto('Cobrado en el cliente', { pago: 100_000_000 });

  await page.goto(`/proyectos/${dos.id}`);
  await listoParaCortar(page);
  await context.setOffline(true);

  // Desde la PC del taller se cobra el primero. El celular no lo ve: está sin señal.
  const fila = await leerProyecto(sesion, uno.titulo);
  await cobrarPorRpc(sesion, {
    p_proyecto_id: uno.id,
    p_version: fila?.version ?? 1,
    p_fecha_cobro: new Date().toISOString().slice(0, 10),
    p_cobrado_centavos: 70_000_000,
    p_gastos_centavos: 0,
    p_tope_sueldo_centavos: SUELDO,
    p_tope_fijos_centavos: FIJOS,
    p_diezmo_centavos: 7_000_000,
    p_sueldo_centavos: 50_000_000,
    p_fijos_centavos: 13_000_000,
    p_remanente_centavos: 0,
  });

  await cobrarDesdeLaFicha(page, dos.id);
  await context.setOffline(false);
  await esperarEstado(dos.id, 'cobrado');

  // La base recalculó con su acumulado: el tope de fijos bajó a $120.000 y la diferencia quedó en el
  // remanente. No rebotó, y la app lo explica en plata.
  const congelada = await distribucionDe(sesion, dos.id);
  expect(congelada?.dist_tope_fijos_centavos).toBe(12_000_000);
  expect(congelada?.dist_fijos_centavos).toBe(12_000_000);
  expect(congelada?.dist_remanente_centavos).toBe(28_000_000);

  await expect(page.getByText('El reparto salió distinto del que viste.')).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.getByText('Costos fijos: esperabas', { exact: false })).toBeVisible();
});

test('cerrar un perdido con seña liquida la seña con diezmo y sin sueldo', async ({ page }) => {
  const { id } = await proyecto('Presupuesto que no salió', {
    pago: 20_000_000,
    estado: 'presupuesto_enviado',
  });

  await page.goto(`/proyectos/${id}`);
  await page.getByRole('button', { name: 'Dar por perdido' }).click();

  // La pantalla dice qué pasa con la seña antes de tocar nada.
  const explicacion = page.getByRole('region', { name: 'Qué pasa con la seña' });
  await expect(explicacion).toContainText('dejan de ser un anticipo');
  await expect(explicacion).toContainText('No paga sueldo');

  await page.getByRole('button', { name: /^Dar por perdido y liquidar/ }).click();
  await esperarEstado(id, 'perdido');

  const congelada = await distribucionDe(sesion, id);
  expect(congelada?.dist_diezmo_centavos).toBe(2_000_000);
  expect(congelada?.dist_sueldo_centavos).toBe(0);
  expect(congelada?.dist_fijos_centavos).toBe(18_000_000);
});

test('reabrir un cobro conserva la fecha y los topes del cobro original', async ({ page }) => {
  const { id } = await proyecto('Placard que se corrige', { pago: 70_000_000 });

  await cobrarDesdeLaFicha(page, id);
  await esperarEstado(id, 'cobrado');
  const primera = await distribucionDe(sesion, id);

  // Entre el cobro y la corrección, los objetivos del taller cambian.
  await ajustarTaller(sesion, { costos_fijos_centavos: 99_000_000 });

  await page.goto(`/proyectos/${id}`);
  await page.getByRole('button', { name: 'Reabrir el cobro' }).click();
  await page.getByRole('button', { name: /^Reabrir y deshacer/ }).click();
  await esperarEstado(id, 'entregado');

  await page.reload();
  await cobrarDesdeLaFicha(page, id);
  await esperarEstado(id, 'cobrado');

  // La fecha y el tope son los del cobro original, no los de hoy: corregir un gasto no reescribe el
  // sueldo ni mueve el cobro de mes.
  const segunda = await distribucionDe(sesion, id);
  expect(segunda?.fecha_cobro).toBe(primera?.fecha_cobro);
  expect(segunda?.dist_tope_fijos_centavos).toBe(primera?.dist_tope_fijos_centavos);
  expect(segunda?.dist_fijos_centavos).toBe(13_000_000);
});

test.describe('con prefers-reduced-motion', () => {
  test.use({ reducedMotion: 'reduce' });

  test('el corte aparece entero, sin animación, y el cobro anda igual', async ({ page }) => {
    const { id } = await proyecto('Placard sin animación', { pago: 70_000_000 });

    await cobrarDesdeLaFicha(page, id);

    // Las dos duraciones del corte quedan en cero, así que el tablero está entero desde el primer
    // frame. El navegador normaliza `0ms` a `0s`, por eso se compara el número y no el texto.
    const duraciones = await page.evaluate(() => {
      const raiz = getComputedStyle(document.documentElement);
      return [
        raiz.getPropertyValue('--dur-corte').trim(),
        raiz.getPropertyValue('--dur-corte-stagger').trim(),
      ].map((valor) => Number.parseFloat(valor));
    });
    expect(duraciones).toEqual([0, 0]);

    const despiece = page.getByRole('region', { name: 'Distribución de la ganancia' });
    await expect(despiece).toContainText('$ 500.000');
    await expect(despiece).toContainText('$ 130.000');
    await esperarEstado(id, 'cobrado');
  });
});

test('un gasto cargado tarde contra un perdido cerrado ofrece el camino de salida', async ({
  page,
}) => {
  const { id } = await proyecto('Lead con nafta', {
    pago: 20_000_000,
    estado: 'presupuesto_enviado',
  });

  await page.goto(`/proyectos/${id}`);
  await page.getByRole('button', { name: 'Dar por perdido' }).click();
  await page.getByRole('button', { name: /^Dar por perdido y liquidar/ }).click();
  await esperarEstado(id, 'perdido');

  // La nafta de la visita aparece después de cerrarlo. Los campos están bloqueados, y el aviso no es
  // un «no» sin salida: ofrece descongelarlo ahí mismo.
  await page.goto(`/proyectos/${id}/editar`);
  const gastos = page.getByRole('region', { name: 'Gastos e insumos' });
  await expect(gastos.getByRole('button', { name: 'Agregar un gasto' })).toBeDisabled();

  await page.getByRole('button', { name: 'Reactivarlo para poder cargarlo' }).click();

  // Los campos se desbloquean en el lugar.
  await gastos.getByRole('button', { name: 'Agregar un gasto' }).click();
  await gastos.getByLabel('Descripción 1', { exact: true }).fill('Nafta de la visita');
  await gastos.getByLabel('Monto 1', { exact: true }).fill('50.000');
  await page.getByRole('button', { name: 'Guardar los cambios' }).click();

  // Y al guardar lleva derecho a cerrarlo de nuevo, con el reparto rehecho contando el gasto.
  await expect(page).toHaveURL(new RegExp(`/proyectos/${id}/cerrar$`), { timeout: 30_000 });
  await page.getByRole('button', { name: /^Dar por perdido y liquidar/ }).click();

  // La seña reparte sobre $150.000 de neta: diezmo $15.000 y el resto al taller.
  await expect
    .poll(async () => (await distribucionDe(sesion, id))?.dist_gastos_centavos, { timeout: 30_000 })
    .toBe(5_000_000);
  const congelada = await distribucionDe(sesion, id);
  expect(congelada?.estado).toBe('perdido');
  expect(congelada?.dist_diezmo_centavos).toBe(1_500_000);
});
