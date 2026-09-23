import { expect, test, type Page } from '@playwright/test';

import { listoParaCortar, saldosEnInicio } from '../apoyo/pantalla';
import {
  ajustarTaller,
  crearCliente,
  distribucionDe,
  guardarProyectoPorRpc,
  hoyEnElTaller,
  iniciarSesionDePrueba,
  movimientosPorRest,
  pagosDe,
  vaciarTaller,
  type SesionDePrueba,
} from '../apoyo/taller';

const UN_DIA_MS = 86_400_000;
const CASILLA = 'Esta plata ya estaba en tus saldos cuando empezaste con la app';

let sesion: SesionDePrueba;

test.beforeEach(async () => {
  sesion = await iniciarSesionDePrueba();
  await vaciarTaller(sesion);
  await ajustarTaller(sesion, {
    sueldo_mensual_centavos: 50_000_000,
    costos_fijos_centavos: 25_000_000,
  });
});

function diasAtras(dias: number): string {
  return hoyEnElTaller(new Date(Date.now() - dias * UN_DIA_MS));
}

interface PagoSembrado {
  fecha: string;
  monto: number;
  enLaApertura?: boolean;
}

async function entregado(titulo: string, pagos: readonly PagoSembrado[]): Promise<string> {
  const clienteId = await crearCliente(sesion, `Cliente de ${titulo}`);
  const id = crypto.randomUUID();
  await guardarProyectoPorRpc(sesion, {
    proyecto: {
      id,
      version: null,
      cliente_id: clienteId,
      titulo,
      estado: 'entregado',
      presupuesto_centavos: 70_000_000,
      comprobante: 'sin_comprobante',
    },
    pagos: pagos.map((pago) => ({
      id: crypto.randomUUID(),
      fecha: pago.fecha,
      concepto: 'Pago',
      monto_centavos: pago.monto,
      ya_en_la_apertura: pago.enLaApertura ?? false,
    })),
    gastos: [],
  });
  return id;
}

async function abrirElCobro(page: Page, id: string): Promise<void> {
  await page.goto(`/proyectos/${id}`);
  await page.getByRole('button', { name: /^Cobrar/ }).click();
  await expect(page.getByLabel('Día del cobro')).toBeVisible();
}

async function cobrar(page: Page): Promise<void> {
  await page.getByRole('button', { name: /^Cobrar y repartir/ }).click();
}

async function esperarEstado(id: string, estado: string): Promise<void> {
  await expect
    .poll(async () => (await distribucionDe(sesion, id))?.estado, { timeout: 30_000 })
    .toBe(estado);
}

async function sembrarLaApertura(): Promise<void> {
  await movimientosPorRest(sesion, [
    {
      fecha: '2026-09-14',
      tipo: 'ajuste',
      tesoro_origen: null,
      tesoro_destino: 'maun',
      monto_centavos: 100_000_000,
      categoria: 'Apertura',
      descripcion: 'Apertura',
    },
  ]);
}

test('un trabajo cobrado hace meses queda cobrado el día de su último pago, no hoy', async ({
  page,
}) => {
  const id = await entregado('Placard con baulera', [
    { fecha: '2026-07-10', monto: 30_000_000 },
    { fecha: '2026-08-20', monto: 40_000_000 },
  ]);

  await abrirElCobro(page, id);
  await expect(page.getByLabel('Día del cobro')).toHaveValue('2026-08-20');
  await expect(page.getByText('se cuentan en agosto de 2026')).toBeVisible();
  await cobrar(page);

  await esperarEstado(id, 'cobrado');
  expect((await distribucionDe(sesion, id))?.fecha_cobro).toBe('2026-08-20');
});

test('con el pago final, el cobro toma el día del pago y los dos se pueden corregir', async ({
  page,
}) => {
  const id = await entregado('Vestidor en dos pagos', [
    { fecha: diasAtras(20), monto: 30_000_000 },
  ]);
  const diaDelPago = diasAtras(3);
  const diaDelCobro = diasAtras(2);

  await abrirElCobro(page, id);
  await expect(page.getByLabel('Fecha del pago')).toHaveValue(hoyEnElTaller());
  await page.getByLabel('Fecha del pago').fill(diaDelPago);
  await expect(page.getByLabel('Día del cobro')).toHaveValue(diaDelPago);
  await page.getByLabel('Día del cobro').fill(diaDelCobro);
  await cobrar(page);

  await esperarEstado(id, 'cobrado');
  expect((await distribucionDe(sesion, id))?.fecha_cobro).toBe(diaDelCobro);
  const pagos = await pagosDe(sesion, id);
  expect(pagos.map((pago) => [pago.fecha, pago.monto_centavos]).sort()).toEqual(
    [
      [diasAtras(20), 30_000_000],
      [diaDelPago, 40_000_000],
    ].sort(),
  );
});

test('un día que todavía no llegó no deja cobrar', async ({ page }) => {
  const id = await entregado('Mesa del futuro', [{ fecha: diasAtras(5), monto: 70_000_000 }]);
  const manana = hoyEnElTaller(new Date(Date.now() + UN_DIA_MS));

  await abrirElCobro(page, id);
  await page.getByLabel('Día del cobro').fill(manana);

  await expect(page.getByText('Esa fecha todavía no llegó')).toBeVisible();
  await expect(page.getByRole('button', { name: /^Cobrar y repartir/ })).toBeDisabled();
});

test.describe('con el reloj del dispositivo en UTC', () => {
  test.use({ timezoneId: 'UTC' });

  test('cobrado a las 23:30 sin señal, queda con ese día aunque llegue al servidor después de medianoche', async ({
    page,
    context,
  }) => {
    const ayer = diasAtras(1);
    const id = await entregado('Mesada de medianoche', [
      { fecha: diasAtras(10), monto: 30_000_000 },
    ]);

    await page.clock.setFixedTime(new Date(`${ayer}T23:30:00-03:00`));
    await page.goto(`/proyectos/${id}`);
    await listoParaCortar(page);
    await context.setOffline(true);

    await page.getByRole('button', { name: /^Cobrar/ }).click();
    await expect(page.getByLabel('Fecha del pago')).toHaveValue(ayer);
    await expect(page.getByLabel('Día del cobro')).toHaveValue(ayer);
    await cobrar(page);
    await expect(page.getByText('Cobrado, sin confirmar')).toBeVisible();

    await page.clock.setFixedTime(new Date());
    await context.setOffline(false);
    await esperarEstado(id, 'cobrado');

    expect((await distribucionDe(sesion, id))?.fecha_cobro).toBe(ayer);
    const pagos = await pagosDe(sesion, id);
    expect(pagos.find((pago) => pago.monto_centavos === 40_000_000)?.fecha).toBe(ayer);
  });
});

test('un cobro de antes de la apertura queda en el libro con su fecha y no mueve ningún tesoro', async ({
  page,
}) => {
  await sembrarLaApertura();
  const id = await entregado('Placard de julio', [
    { fecha: '2026-07-10', monto: 70_000_000, enLaApertura: true },
  ]);
  const antes = await saldosEnInicio(page);
  expect(antes).toEqual({ hogar: 0, maun: 1_000_000, diezmo: 0, cocos: 0 });

  await abrirElCobro(page, id);
  await expect(page.getByLabel('Día del cobro')).toHaveValue('2026-07-10');
  await expect(page.getByRole('checkbox', { name: CASILLA })).toBeChecked();
  await expect(page.getByText('no mueve los tesoros: ya estaba en tus saldos')).toBeVisible();
  await cobrar(page);

  await esperarEstado(id, 'cobrado');
  const congelada = await distribucionDe(sesion, id);
  expect(congelada).toMatchObject({
    fecha_cobro: '2026-07-10',
    reparto_ya_en_la_apertura: true,
    dist_diezmo_centavos: 7_000_000,
    dist_sueldo_centavos: 50_000_000,
    dist_fijos_centavos: 13_000_000,
  });

  expect(await saldosEnInicio(page)).toEqual(antes);
});

test('si esa plata no estaba en los saldos, destildar la casilla hace que el reparto mueva los tesoros', async ({
  page,
}) => {
  await sembrarLaApertura();
  const id = await entregado('Rack de julio', [{ fecha: '2026-07-10', monto: 70_000_000 }]);
  const antes = await saldosEnInicio(page);

  await abrirElCobro(page, id);
  const casilla = page.getByRole('checkbox', { name: CASILLA });
  await expect(casilla).toBeChecked();
  await casilla.uncheck();
  await expect(page.getByText('Los saldos de los tesoros se mueven con esto.')).toBeVisible();
  await cobrar(page);

  await esperarEstado(id, 'cobrado');
  expect((await distribucionDe(sesion, id))?.reparto_ya_en_la_apertura).toBe(false);

  const despues = await saldosEnInicio(page);
  expect(despues.hogar - antes.hogar).toBe(500_000);
  expect(despues.diezmo - antes.diezmo).toBe(70_000);
  expect(despues.maun - antes.maun).toBe(-570_000);
  expect(despues.cocos - antes.cocos).toBe(0);
});

test('reabrir un cobro trae su día puesto, y al volver a cobrarlo se puede corregir', async ({
  page,
}) => {
  const primero = diasAtras(6);
  const corregido = diasAtras(4);
  const id = await entregado('Vanitory que se corrige', [{ fecha: primero, monto: 70_000_000 }]);

  await abrirElCobro(page, id);
  await cobrar(page);
  await esperarEstado(id, 'cobrado');
  expect((await distribucionDe(sesion, id))?.fecha_cobro).toBe(primero);

  await page.goto(`/proyectos/${id}`);
  await page.getByRole('button', { name: 'Reabrir el cobro' }).click();
  await page.getByRole('button', { name: /^Reabrir y deshacer/ }).click();
  await esperarEstado(id, 'entregado');

  await page.reload();
  await abrirElCobro(page, id);
  await expect(page.getByLabel('Día del cobro')).toHaveValue(primero);
  await page.getByLabel('Día del cobro').fill(corregido);
  await cobrar(page);

  await esperarEstado(id, 'cobrado');
  expect((await distribucionDe(sesion, id))?.fecha_cobro).toBe(corregido);
});
