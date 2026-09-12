import { expect, test, type Page } from '@playwright/test';

import { listoParaCortar, saldosEnInicio } from '../apoyo/pantalla';
import {
  ajustarTaller,
  cobrarPorRpc,
  crearCliente,
  guardarProyectoPorRpc,
  iniciarSesionDePrueba,
  movimientosDelTaller,
  vaciarTaller,
  type SesionDePrueba,
} from '../apoyo/taller';

const SUELDO = 50_000_000;
const FIJOS = 25_000_000;

let sesion: SesionDePrueba;

test.beforeEach(async () => {
  sesion = await iniciarSesionDePrueba();
  await vaciarTaller(sesion);
  await ajustarTaller(sesion, {
    sueldo_mensual_centavos: SUELDO,
    costos_fijos_centavos: FIJOS,
    meta_cocos_centavos: 100_000_000,
  });
});

interface Carga {
  grupo: string;
  clase?: string;
  monto: string;
  descripcion: string;
  fecha?: string;
}

async function cargar(
  page: Page,
  { grupo, clase, monto, descripcion, fecha }: Carga,
): Promise<void> {
  await page.getByRole('button', { name: 'Cargar movimiento' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('radio', { name: grupo }).click();
  if (clase !== undefined) {
    await page
      .getByRole('group', { name: 'Detalle del tipo' })
      .getByRole('button', { name: clase, exact: true })
      .click();
  }
  await page.getByLabel('Cuánta plata').fill(monto);
  await page.getByLabel('Qué fue').fill(descripcion);
  if (fecha !== undefined) await page.getByLabel('Otra fecha').fill(fecha);
  await page.getByRole('button', { name: 'Cargar el movimiento' }).click();
  await expect(page.getByRole('dialog')).toBeHidden();
}

async function recorrerConTab(page: Page, pasos: number): Promise<string[]> {
  const visto: string[] = [];
  for (let paso = 0; paso < pasos; paso += 1) {
    await page.keyboard.press('Tab');
    const foco = await page.evaluate(() => {
      const activo = document.activeElement;
      if (!activo || activo === document.body) return '';
      const etiqueta = activo.getAttribute('aria-label') ?? '';
      return `${activo.tagName.toLowerCase()}:${etiqueta}:${activo.textContent.trim().slice(0, 30)}`;
    });
    if (foco !== '') visto.push(foco);
  }
  return visto;
}

async function esperarMovimientos(cuantos: number): Promise<void> {
  await expect
    .poll(async () => (await movimientosDelTaller(sesion)).length, { timeout: 30_000 })
    .toBe(cuantos);
}

async function pagarDiezmo(page: Page, monto: string, descripcion: string): Promise<void> {
  await page.getByRole('link', { name: 'Registrar un pago' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByLabel('Cuánta plata').fill(monto);
  await page.getByLabel('Qué fue').fill(descripcion);
  await page.getByRole('button', { name: 'Cargar el movimiento' }).click();
  await expect(page.getByRole('dialog')).toBeHidden();
}

async function cobrarUnTrabajo(titulo: string, monto: number): Promise<string> {
  const clienteId = await crearCliente(sesion, `Cliente de ${titulo}`);
  const id = crypto.randomUUID();
  await guardarProyectoPorRpc(sesion, {
    proyecto: {
      id,
      version: null,
      cliente_id: clienteId,
      titulo,
      estado: 'entregado',
      presupuesto_centavos: monto,
      comprobante: 'sin_comprobante',
    },
    pagos: [
      { id: crypto.randomUUID(), fecha: '2026-09-01', concepto: 'Seña', monto_centavos: monto },
    ],
    gastos: [],
  });

  const neta = monto;
  const diezmo = Math.floor((neta * 1000 + 5000) / 10000);
  const sueldo = Math.min(SUELDO, neta - diezmo);
  const fijos = Math.min(FIJOS, neta - diezmo - sueldo);
  await cobrarPorRpc(sesion, {
    p_proyecto_id: id,
    p_version: 1,
    p_fecha_cobro: '2026-09-05',
    p_cobrado_centavos: monto,
    p_gastos_centavos: 0,
    p_tope_sueldo_centavos: SUELDO,
    p_tope_fijos_centavos: FIJOS,
    p_diezmo_centavos: diezmo,
    p_sueldo_centavos: sueldo,
    p_fijos_centavos: fijos,
    p_remanente_centavos: neta - diezmo - sueldo - fijos,
  });
  return id;
}

test('los ocho tipos manuales mueven los cuatro tesoros, con la contrapartida de los dos lados', async ({
  page,
}) => {
  const antes = await saldosEnInicio(page);

  await page.goto('/finanzas');
  await cargar(page, {
    grupo: 'Ingreso',
    clase: 'Al hogar',
    monto: '100.000',
    descripcion: 'Docencia',
  });
  await cargar(page, {
    grupo: 'Ingreso',
    clase: 'Al taller',
    monto: '200.000',
    descripcion: 'Recortes',
  });
  await cargar(page, { grupo: 'Gasto', clase: 'Del hogar', monto: '10.000', descripcion: 'Súper' });
  await cargar(page, {
    grupo: 'Gasto',
    clase: 'Del taller',
    monto: '20.000',
    descripcion: 'Herrajes',
  });
  await cargar(page, {
    grupo: 'Cocos',
    clase: 'Aporte',
    monto: '50.000',
    descripcion: 'Aporte del mes',
  });
  await cargar(page, { grupo: 'Cocos', clase: 'Retiro', monto: '5.000', descripcion: 'Retiro' });
  await cargar(page, { grupo: 'Cocos', clase: 'Gasto', monto: '1.000', descripcion: 'Sellos' });
  await cargar(page, { grupo: 'Diezmo', monto: '2.000', descripcion: 'Diezmo de septiembre' });

  await expect(page.getByRole('status').last()).toBeHidden({ timeout: 30_000 });

  const filas = await movimientosDelTaller(sesion);
  expect(filas).toHaveLength(8);
  expect(
    filas.map((fila) => [fila.tipo, fila.tesoro_origen, fila.tesoro_destino, fila.monto_centavos]),
  ).toEqual(
    expect.arrayContaining([
      ['ingreso', null, 'hogar', 10_000_000],
      ['ingreso', null, 'maun', 20_000_000],
      ['gasto', 'hogar', null, 1_000_000],
      ['gasto', 'maun', null, 2_000_000],
      ['aporte_cocos', 'maun', 'cocos', 5_000_000],
      ['transferencia', 'cocos', 'maun', 500_000],
      ['gasto', 'cocos', null, 100_000],
      ['pago_diezmo', 'diezmo', null, 200_000],
    ]),
  );

  const despues = await saldosEnInicio(page);
  expect(despues.hogar - antes.hogar).toBe(90_000);
  expect(despues.maun - antes.maun).toBe(135_000);
  expect(despues.cocos - antes.cocos).toBe(44_000);
  expect(despues.diezmo - antes.diezmo).toBe(-2_000);
});

test('una transferencia es una sola fila que dice de dónde sale y a dónde entra', async ({
  page,
}) => {
  await page.goto('/finanzas');
  await cargar(page, {
    grupo: 'Cocos',
    clase: 'Aporte',
    monto: '60.000',
    descripcion: 'Aporte de septiembre',
  });

  const fila = page.getByRole('button', { name: /Aporte de septiembre/ });
  await expect(fila).toHaveCount(1);
  await expect(fila).toContainText('Maun');
  await expect(fila).toContainText('Cocos');
  await expect(fila).toContainText('$ 60.000');
  await expect(fila).not.toContainText('−$');
  await expect(fila).not.toContainText('+$');

  await page.getByRole('button', { name: 'Entradas', exact: true }).click();
  await expect(fila).toBeHidden();
  await page.getByRole('button', { name: 'Salidas', exact: true }).click();
  await expect(fila).toBeHidden();
  await page.getByRole('button', { name: 'Entre tesoros', exact: true }).click();
  await expect(fila).toBeVisible();
});

test('en modo avión el movimiento aparece sin confirmar, sobrevive a cerrar la app y después pasa a firme', async ({
  page,
  context,
}) => {
  await page.goto('/finanzas');
  await listoParaCortar(page);
  await context.setOffline(true);

  await cargar(page, {
    grupo: 'Gasto',
    clase: 'Del hogar',
    monto: '33.000',
    descripcion: 'Súper sin señal',
  });

  const fila = page.getByRole('button', { name: /Súper sin señal/ });
  await expect(fila).toBeVisible();
  await expect(fila).toContainText('sin confirmar');
  expect(await movimientosDelTaller(sesion)).toHaveLength(0);

  await page.close();
  const reabierta = await context.newPage();
  await reabierta.goto('/finanzas');
  const despues = reabierta.getByRole('button', { name: /Súper sin señal/ });
  await expect(despues).toBeVisible();
  await expect(despues).toContainText('sin confirmar');

  await context.setOffline(false);
  await expect(despues).not.toContainText('sin confirmar', { timeout: 30_000 });
  expect(await movimientosDelTaller(sesion)).toHaveLength(1);
});

test('el pago de diezmo se registra desde su pantalla y el texto cambia con el saldo', async ({
  page,
}) => {
  await cobrarUnTrabajo('Placard del diezmo', 70_000_000);

  await page.goto('/diezmo');
  const estado = page.getByRole('region', { name: 'Estado del diezmo' });
  await expect(estado).toContainText('Debés', { timeout: 20_000 });
  await expect(estado).toContainText('$ 70.000');

  await pagarDiezmo(page, '50.000', 'Pago parcial');

  await expect(page).toHaveURL(/\/diezmo$/);
  await expect(estado).toContainText('Debés');
  await expect(estado).toContainText('$ 20.000');
  await expect(page.getByRole('button', { name: /Pago parcial/ })).toBeVisible();
});

test('los tres estados del diezmo: con deuda, al día y pagado de más', async ({ page }) => {
  await cobrarUnTrabajo('Mesada del diezmo', 70_000_000);

  await page.goto('/diezmo');
  const estado = page.getByRole('region', { name: 'Estado del diezmo' });
  await expect(estado).toContainText('Debés', { timeout: 20_000 });
  await expect(estado).toContainText('$ 70.000');

  await pagarDiezmo(page, '70.000', 'Pago completo');
  await expect(estado).toContainText('Estás al día');
  await expect(estado).not.toContainText('$');

  await pagarDiezmo(page, '30.000', 'Pago de más');
  await expect(estado).toContainText('Pagaste de más');
  await expect(estado).toContainText('$ 30.000');
});

test('el ajuste de Cocos calcula la diferencia, elige el concepto por el signo y deja el saldo escrito', async ({
  page,
}) => {
  await page.goto('/finanzas');
  await cargar(page, {
    grupo: 'Cocos',
    clase: 'Aporte',
    monto: '100.000',
    descripcion: 'Aporte inicial',
  });

  await page.goto('/ajustes');
  await page.getByLabel('El saldo que tenés de verdad').fill('112.500');
  await expect(page.getByText('Ajuste de Cocos (intereses o depósito)')).toBeVisible();
  await page.getByRole('button', { name: 'Ajustar el saldo de Cocos' }).click();
  await expect(page.getByText('Cocos queda en $ 112.500')).toBeVisible();

  await esperarMovimientos(2);
  const conIntereses = await movimientosDelTaller(sesion);
  const alza = conIntereses.find((fila) => fila.tipo === 'ajuste');
  expect(alza?.monto_centavos).toBe(1_250_000);
  expect(alza?.tesoro_destino).toBe('cocos');
  expect(alza?.tesoro_origen).toBeNull();
  expect(alza?.descripcion).toBe('Ajuste de Cocos (intereses o depósito)');

  const saldos = await saldosEnInicio(page);
  expect(saldos.cocos).toBe(112_500);

  await page.goto('/ajustes');
  await page.getByLabel('El saldo que tenés de verdad').fill('100.000');
  await expect(page.getByText('Ajuste de Cocos (retiro o corrección)')).toBeVisible();
  await page.getByRole('button', { name: 'Ajustar el saldo de Cocos' }).click();
  await esperarMovimientos(3);

  const conRetiro = await movimientosDelTaller(sesion);
  const baja = conRetiro.find((fila) => fila.tipo === 'ajuste' && fila.tesoro_origen === 'cocos');
  expect(baja?.monto_centavos).toBe(1_250_000);
  expect(baja?.tesoro_destino).toBeNull();
  expect(baja?.descripcion).toBe('Ajuste de Cocos (retiro o corrección)');
  expect((await saldosEnInicio(page)).cocos).toBe(100_000);
});

test('un movimiento que sale de un trabajo no se edita ni se borra, y la interfaz lo explica', async ({
  page,
}) => {
  const id = await cobrarUnTrabajo('Ropero derivado', 70_000_000);

  await page.goto('/finanzas');
  await page
    .getByRole('button', { name: /Diezmo del reparto|Ropero derivado/ })
    .first()
    .click();

  const ficha = page.getByRole('dialog');
  await expect(ficha).toBeVisible();
  await expect(ficha).toContainText('Este asiento lo genera el proyecto');
  await expect(ficha.getByRole('button', { name: 'Editar' })).toBeDisabled();
  await expect(ficha.getByRole('button', { name: 'Borrar' })).toBeDisabled();

  await ficha.getByRole('link', { name: /Ver «Ropero derivado»/ }).click();
  await expect(page).toHaveURL(new RegExp(`/proyectos/${id}$`));
});

test('un movimiento cargado a mano se edita y se borra desde su ficha', async ({ page }) => {
  await page.goto('/finanzas');
  await cargar(page, {
    grupo: 'Gasto',
    clase: 'Del taller',
    monto: '40.000',
    descripcion: 'Hoja de sierra',
  });
  await expect(page.getByRole('status').last()).toBeHidden({ timeout: 30_000 });

  await page.getByRole('button', { name: /Hoja de sierra/ }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByLabel('Qué fue').fill('Hoja de sierra de 12 pulgadas');
  await page.getByRole('button', { name: 'Guardar los cambios' }).click();
  await expect(page.getByRole('button', { name: /Hoja de sierra de 12 pulgadas/ })).toBeVisible();

  await page.getByRole('button', { name: /Hoja de sierra de 12 pulgadas/ }).click();
  await page.getByRole('button', { name: 'Borrar', exact: true }).click();
  await page.getByRole('button', { name: 'Borrarlo' }).click();
  await expect(page.getByRole('button', { name: /Hoja de sierra/ })).toBeHidden();

  await esperarMovimientos(0);
});

test('los filtros por tesoro, tipo y mes, y la búsqueda, se combinan', async ({ page }) => {
  await page.goto('/finanzas');
  await cargar(page, {
    grupo: 'Gasto',
    clase: 'Del hogar',
    monto: '11.000',
    descripcion: 'Verdulería',
  });
  await cargar(page, {
    grupo: 'Gasto',
    clase: 'Del taller',
    monto: '22.000',
    descripcion: 'Tornillos',
  });
  await cargar(page, {
    grupo: 'Ingreso',
    clase: 'Al hogar',
    monto: '33.000',
    descripcion: 'Clases de carpintería',
  });
  await cargar(page, {
    grupo: 'Gasto',
    clase: 'Del taller',
    monto: '44.000',
    descripcion: 'Alquiler de agosto',
    fecha: '2026-08-10',
  });

  const verduleria = page.getByRole('button', { name: /Verdulería/ });
  const tornillos = page.getByRole('button', { name: /Tornillos/ });
  const clases = page.getByRole('button', { name: /Clases de carpintería/ });

  await page.getByRole('button', { name: 'Hogar', exact: true }).click();
  await expect(verduleria).toBeVisible();
  await expect(tornillos).toBeHidden();
  await expect(clases).toBeVisible();

  await page.getByRole('button', { name: 'Salidas', exact: true }).click();
  await expect(verduleria).toBeVisible();
  await expect(clases).toBeHidden();

  await page.getByLabel('Buscar en el libro').fill('torni');
  await expect(verduleria).toBeHidden();
  await expect(page.getByText('Nada con esos filtros')).toBeVisible();

  await page.getByRole('button', { name: 'Limpiar los filtros' }).click();
  await expect(verduleria).toBeVisible();
  await expect(tornillos).toBeVisible();
  await expect(clases).toBeVisible();

  await page.getByLabel('Mes').selectOption('2026-08');
  await expect(verduleria).toBeHidden();
  await expect(page.getByRole('button', { name: /Alquiler de agosto/ })).toBeVisible();

  await page.getByLabel('Mes').selectOption('todos');
  await expect(verduleria).toBeVisible();
  await expect(page.getByRole('button', { name: /Alquiler de agosto/ })).toBeVisible();
});

test('el gráfico del mes no llega al árbol de accesibilidad y la tabla con los mismos números sí', async ({
  page,
}) => {
  await page.goto('/finanzas');
  const resumen = page.getByRole('region', { name: /Septiembre contra agosto/ });
  await expect(resumen).toBeVisible();
  await expect(resumen.locator('svg[viewBox="0 0 360 152"]')).toHaveAttribute(
    'aria-hidden',
    'true',
  );
  await expect(resumen.getByRole('img')).toHaveCount(0);

  const verNumeros = resumen.getByRole('button', { name: 'Ver los números' });
  await expect(verNumeros).toHaveAttribute('aria-expanded', 'false');
  await expect(resumen.getByRole('table')).toBeHidden();

  await verNumeros.click();
  const tabla = resumen.getByRole('table');
  await expect(tabla).toBeVisible();
  await expect(tabla.getByRole('rowheader', { name: 'Entró al hogar' })).toBeVisible();
  await expect(tabla.getByRole('rowheader', { name: 'Gastó el hogar' })).toBeVisible();
  await expect(tabla.getByRole('rowheader', { name: 'Facturó el taller' })).toBeVisible();
  await expect(resumen.getByRole('button', { name: 'Ocultar los números' })).toBeVisible();
});

test('finanzas y diezmo se recorren enteros con el teclado', async ({ page }) => {
  await page.goto('/finanzas');
  await cargar(page, {
    grupo: 'Gasto',
    clase: 'Del hogar',
    monto: '9.000',
    descripcion: 'Farmacia',
  });

  const recorrido = await recorrerConTab(page, 60);
  expect(recorrido.some((foco) => foco.includes('Cargar movimiento'))).toBe(true);
  expect(recorrido.some((foco) => foco.includes('Todos'))).toBe(true);
  expect(recorrido.some((foco) => foco.includes('Buscar en el libro'))).toBe(true);
  expect(recorrido.some((foco) => foco.includes('Farmacia'))).toBe(true);
  expect(recorrido.some((foco) => foco.includes('los números'))).toBe(true);

  await page.goto('/diezmo');
  const enDiezmo = await recorrerConTab(page, 40);
  expect(enDiezmo.some((foco) => foco.includes('Registrar un pago'))).toBe(true);
  expect(enDiezmo.some((foco) => foco.includes('Farmacia'))).toBe(false);
});
