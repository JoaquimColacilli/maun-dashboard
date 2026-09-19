import { expect, test, type Page } from '@playwright/test';

import { indicadorDeSync, listoParaCortar, saldosEnInicio } from '../apoyo/pantalla';
import {
  ajustarTaller,
  contactoPorRpc,
  crearCliente,
  distribucionDe,
  iniciarSesionDePrueba,
  leerContacto,
  leerProyecto,
  pagosDe,
  vaciarTaller,
  type SesionDePrueba,
} from '../apoyo/taller';

const UN_DIA_MS = 86_400_000;
const CARGA = { timeout: 30_000 };

let sesion: SesionDePrueba;

test.beforeEach(async () => {
  sesion = await iniciarSesionDePrueba();
  await vaciarTaller(sesion);
});

function fechaLocal(desplazamientoEnDias: number): string {
  const dia = new Date(Date.now() + desplazamientoEnDias * UN_DIA_MS);
  const mes = String(dia.getMonth() + 1).padStart(2, '0');
  const numero = String(dia.getDate()).padStart(2, '0');
  return `${String(dia.getFullYear())}-${mes}-${numero}`;
}

function unaSemanaDeTrabajoDesde(fecha: string): string {
  const [anio = 0, mes = 1, dia = 1] = fecha.split('-').map(Number);
  const cursor = new Date(Date.UTC(anio, mes - 1, dia));
  let habiles = 0;
  while (habiles < 5) {
    cursor.setUTCDate(cursor.getUTCDate() + 1);
    const semana = cursor.getUTCDay();
    if (semana !== 0 && semana !== 6) habiles += 1;
  }
  return cursor.toISOString().slice(0, 10);
}

async function tareasEnLaBase(titulo: string): Promise<boolean[]> {
  const fila = await leerContacto(sesion, titulo);
  return fila === undefined
    ? []
    : [
        fila.presupuesto_diseno,
        fila.presupuesto_despiece,
        fila.presupuesto_cotizacion,
        fila.presupuesto_pdf,
      ];
}

function tarjetas(page: Page) {
  return page.getByRole('list', { name: 'Contactos' }).getByRole('listitem');
}

async function abrir(page: Page, ruta: string): Promise<void> {
  await page.goto(ruta);
  await expect(page.getByRole('main')).toBeVisible({ timeout: 30_000 });
}

async function esperarEstado(titulo: string, estado: string): Promise<void> {
  await expect
    .poll(async () => (await leerProyecto(sesion, titulo))?.estado, { timeout: 30_000 })
    .toBe(estado);
}

async function recorrerConTab(page: Page, pasos: number): Promise<string[]> {
  const visto: string[] = [];
  for (let paso = 0; paso < pasos; paso += 1) {
    await page.keyboard.press('Tab');
    const foco = await page.evaluate(() => {
      const activo = document.activeElement;
      if (!activo || activo === document.body) return '';
      const etiqueta = activo.getAttribute('aria-label') ?? '';
      return `${activo.tagName.toLowerCase()}:${etiqueta}:${activo.textContent.trim().slice(0, 40)}`;
    });
    if (foco !== '') visto.push(foco);
  }
  return visto;
}

test('el caso del audio: contacto sin presupuesto, seña en la visita, aprobado, y la seña es el mismo pago', async ({
  page,
}) => {
  const titulo = 'Placard con escritorio';
  await ajustarTaller(sesion, { sena_bp: 5000 });
  const antes = await saldosEnInicio(page);

  await abrir(page, '/seguimiento');
  await page.getByRole('button', { name: 'Cargar el primer contacto' }).click();
  const alta = page.getByRole('dialog', { name: 'Cargar contacto' });
  await alta.getByRole('combobox', { name: 'Cliente' }).fill('Ramiro Díaz');
  await alta.getByRole('option', { name: /Crear «Ramiro Díaz»/ }).click();
  await alta.getByLabel('Teléfono').fill('11 5555-1234');
  await alta.getByLabel('Qué pide').fill(titulo);
  await alta.getByRole('button', { name: 'Guardar contacto' }).click();

  await expect(page.getByRole('heading', { level: 1 })).toHaveText(titulo);
  await expect(page.getByRole('region', { name: 'Qué falta' })).toContainText(
    'Falta agendar la visita',
  );
  await esperarEstado(titulo, 'contacto');
  const creado = await leerProyecto(sesion, titulo);
  const id = creado?.id ?? '';
  expect(creado?.presupuesto_centavos).toBeNull();

  await page.getByRole('button', { name: 'Editar', exact: true }).click();
  const edicion = page.getByRole('dialog', { name: 'Editar el contacto' });
  await edicion.getByLabel('Visita', { exact: true }).fill(fechaLocal(-1));
  await edicion.getByLabel('Seña cobrada').fill('150.000');
  await edicion.getByRole('button', { name: 'Guardar los cambios' }).click();
  await expect(edicion).toBeHidden();
  await expect(page.getByRole('region', { name: 'Qué falta' })).toContainText('Falta presupuestar');

  await expect.poll(async () => (await pagosDe(sesion, id)).length, { timeout: 30_000 }).toBe(1);
  const [sena] = await pagosDe(sesion, id);
  expect(sena?.monto_centavos).toBe(15_000_000);
  expect(sena?.fecha).toBe(fechaLocal(-1));
  await esperarEstado(titulo, 'a_presupuestar');

  const conSena = await saldosEnInicio(page);
  expect(conSena.maun - antes.maun).toBe(150_000);

  await abrir(page, '/proyectos');
  await expect(page.getByRole('link', { name: titulo, exact: true })).toHaveCount(0);

  await page.getByRole('tab', { name: /Seguimiento/ }).click();
  await page.getByRole('link', { name: titulo, exact: true }).click();
  await page.getByRole('button', { name: 'Mandé el presupuesto' }).click();
  await page.getByLabel('Cuánto presupuestaste').fill('1.200.000');
  await page.getByRole('button', { name: 'Marcar como enviado' }).click();
  await expect(page.getByRole('region', { name: 'Qué falta' })).toContainText(
    'Falta llamar para saber',
  );

  await page.getByRole('button', { name: 'Lo aprobó: pasar a Proyectos' }).click();
  await expect(page).toHaveURL(new RegExp(`/proyectos/${id}/aprobar$`));
  await expect(page.getByLabel('Presupuesto aprobado')).toHaveValue('1.200.000');
  await expect(page.getByText('Ya cobrado antes')).toBeVisible();
  // La seña viene sugerida con lo que falta para la mitad: 600.000 menos los 150.000 de la visita.
  await expect(page.getByLabel('Seña que cobrás ahora')).toHaveValue('450.000');
  await page.getByLabel('Seña que cobrás ahora').fill('');
  await expect(page.locator('dl').first()).toContainText('$ 150.000');
  await expect(page.locator('dl').first()).toContainText('$ 1.050.000');
  await page.getByRole('button', { name: 'Pasar a Proyectos' }).click();

  await expect(page).toHaveURL(new RegExp(`/proyectos/${id}$`), { timeout: 30_000 });
  await expect(page.getByText('Pasó de Seguimiento a Activos')).toBeVisible();
  await expect(page.getByRole('region', { name: 'Pagos recibidos' })).toContainText(
    'Seña de la visita',
  );

  await page.getByRole('link', { name: 'Proyectos', exact: true }).first().click();
  await expect(page).toHaveURL(/\/proyectos$/);
  await expect(page.getByRole('link', { name: titulo, exact: true })).toBeVisible();
  await page.getByRole('tab', { name: /Seguimiento/ }).click();
  await expect(page.getByRole('heading', { level: 2 })).toHaveText(
    'Nadie en seguimiento por ahora',
  );
  await expect(page.getByRole('link', { name: titulo, exact: true })).toHaveCount(0);

  await esperarEstado(titulo, 'en_curso');
  const aprobado = await leerProyecto(sesion, titulo);
  expect(aprobado?.presupuesto_centavos).toBe(120_000_000);
  const pagosDespues = await pagosDe(sesion, id);
  expect(pagosDespues).toHaveLength(1);
  expect(pagosDespues[0]?.id).toBe(sena?.id);
  expect(pagosDespues[0]?.monto_centavos).toBe(15_000_000);

  const despues = await saldosEnInicio(page);
  expect(despues.maun - antes.maun).toBe(150_000);
});

test('aprobar con la seña cargada ahí mismo: un pago más, y lo de la visita no se cuenta dos veces', async ({
  page,
}) => {
  await ajustarTaller(sesion, { sena_bp: 5000 });
  const { id, titulo } = await contactoPorRpc(sesion, {
    titulo: 'Biblioteca de pared',
    estado: 'presupuesto_enviado',
    sena: 20_000_000,
  });

  await abrir(page, `/proyectos/${id}/aprobar`);
  await page.getByLabel('Presupuesto aprobado').fill('1.000.000');

  // Sugerida: la mitad de 1.000.000 son 500.000, y ya cobró 200.000 en la visita.
  await expect(page.getByLabel('Seña que cobrás ahora')).toHaveValue('300.000');
  const cuenta = page.locator('dl').first();
  await expect(cuenta).toContainText('$ 200.000');
  await expect(cuenta).toContainText('$ 300.000');
  await expect(cuenta).toContainText('$ 500.000');

  await page.getByRole('button', { name: 'Pasar a Proyectos' }).click();
  await expect(page).toHaveURL(new RegExp(`/proyectos/${id}$`), CARGA);
  await esperarEstado(titulo, 'en_curso');

  await expect.poll(async () => (await pagosDe(sesion, id)).length, { timeout: 30_000 }).toBe(2);
  const pagos = await pagosDe(sesion, id);
  expect(pagos.map((pago) => pago.monto_centavos).sort((uno, otro) => uno - otro)).toEqual([
    20_000_000, 30_000_000,
  ]);

  const ficha = page.getByRole('region', { name: 'Pagos recibidos' });
  await expect(ficha).toContainText('Seña');
  await expect(ficha).toContainText('$ 300.000');
  await expect(ficha).toContainText('$ 200.000');
  await expect(page.getByRole('region', { name: 'Seña para confirmar' })).toContainText(
    'La seña ya está cubierta',
  );
});

test('un contacto en cualquier etapa previa no aparece en Activos', async ({ page }) => {
  const etapas = ['contacto', 'relevamiento', 'a_presupuestar', 'presupuesto_enviado'];
  for (const estado of etapas) {
    await contactoPorRpc(sesion, { titulo: `Trabajo en ${estado}`, estado, sena: 5_000_000 });
  }

  await abrir(page, '/proyectos');
  await expect(page.getByRole('heading', { level: 2 })).toHaveText(
    'Todavía no hay proyectos activos',
  );
  await expect(page.getByRole('tab', { name: /Activos\s*0/ })).toBeVisible();
  await expect(page.getByRole('tab', { name: /Seguimiento\s*4/ })).toBeVisible();
  for (const estado of etapas) {
    await expect(page.getByRole('link', { name: `Trabajo en ${estado}`, exact: true })).toHaveCount(
      0,
    );
  }

  await page.getByRole('tab', { name: /Seguimiento/ }).click();
  await expect(tarjetas(page)).toHaveCount(4);
});

test('hoy los gastos de un contacto salen de la caja al cargarse, y aprobarlo no los vuelve a contar', async ({
  page,
}) => {
  const { id, titulo } = await contactoPorRpc(sesion, {
    titulo: 'Vestidor con nafta',
    estado: 'a_presupuestar',
    sena: 20_000_000,
    gasto: 3_000_000,
  });

  const sinAprobar = await saldosEnInicio(page);
  expect(sinAprobar.maun).toBe(170_000);

  await abrir(page, `/proyectos/${id}`);
  await expect(page.getByRole('region', { name: 'Datos del contacto' })).toContainText(
    'Gastos cargados',
  );
  await page.getByRole('button', { name: 'Ya lo aprobó' }).click();
  await page.getByLabel('Presupuesto aprobado').fill('900.000');
  await page.getByLabel('Seña que cobrás ahora').fill('');
  await page.getByRole('button', { name: 'Pasar a Proyectos' }).click();
  await expect(page).toHaveURL(new RegExp(`/proyectos/${id}$`), { timeout: 30_000 });
  await esperarEstado(titulo, 'en_curso');

  const aprobado = await saldosEnInicio(page);
  expect(aprobado.maun).toBe(170_000);
});

test('perder un contacto con seña liquida la seña: diezmo sí, sueldo no, y pasa al historial', async ({
  page,
}) => {
  const { id, titulo } = await contactoPorRpc(sesion, {
    titulo: 'Cocina que no salió',
    estado: 'presupuesto_enviado',
    sena: 20_000_000,
  });

  await abrir(page, `/proyectos/${id}`);
  await expect(page.getByRole('region', { name: 'Si no sale' })).toContainText('$ 200.000');
  await page.getByRole('button', { name: 'Dar por perdido' }).click();
  await expect(page).toHaveURL(new RegExp(`/proyectos/${id}/cerrar$`));
  await expect(page.getByRole('region', { name: 'Qué pasa con la seña' })).toContainText(
    'dejan de ser un anticipo',
  );
  await page.getByRole('button', { name: /^Dar por perdido y liquidar/ }).click();

  await esperarEstado(titulo, 'perdido');
  const congelada = await distribucionDe(sesion, id);
  expect(congelada?.dist_cobrado_centavos).toBe(20_000_000);
  expect(congelada?.dist_diezmo_centavos).toBe(2_000_000);
  expect(congelada?.dist_sueldo_centavos).toBe(0);

  await page.getByRole('link', { name: 'Proyectos', exact: true }).first().click();
  await page.getByRole('tab', { name: /Seguimiento/ }).click();
  await expect(page.getByRole('link', { name: titulo, exact: true })).toHaveCount(0);
  await page.getByRole('tab', { name: /Historial/ }).click();
  await expect(page.getByRole('link', { name: titulo, exact: true })).toBeVisible();
});

test('la lista va primero con lo que hace más que espera, y tocar un contacto lo manda atrás', async ({
  page,
}) => {
  await contactoPorRpc(sesion, { titulo: 'Primero en llegar', estado: 'a_presupuestar' });
  await contactoPorRpc(sesion, { titulo: 'Segundo en llegar' });
  await contactoPorRpc(sesion, {
    titulo: 'Visita agendada',
    estado: 'relevamiento',
    visita: fechaLocal(3),
  });

  await abrir(page, '/seguimiento');
  await expect(tarjetas(page)).toHaveCount(3);
  await expect(tarjetas(page).nth(0)).toContainText('Primero en llegar');
  await expect(tarjetas(page).nth(0)).toContainText('A presupuestar desde hoy');
  await expect(tarjetas(page).nth(1)).toContainText('Segundo en llegar');
  await expect(tarjetas(page).nth(1)).toContainText('Contacto desde hoy, sin visita agendada');
  await expect(tarjetas(page).nth(2)).toContainText('Visita agendada');
  await expect(tarjetas(page).nth(2)).toContainText('Visita en 3 días');

  await page.getByRole('link', { name: 'Primero en llegar', exact: true }).click();
  await page.getByRole('radio', { name: 'Presupuesto enviado' }).click();
  await expect(page.getByRole('region', { name: 'Qué falta' })).toContainText(
    'Presupuesto enviado hoy',
  );
  await page.getByRole('link', { name: 'Seguimiento', exact: true }).first().click();

  await expect(tarjetas(page).nth(0)).toContainText('Segundo en llegar');
  await expect(tarjetas(page).nth(1)).toContainText('Primero en llegar');
});

test('toda la tarjeta lleva al trabajo, el nombre del cliente a su ficha, y con el teclado se llega a los dos por separado', async ({
  page,
}) => {
  const { id } = await contactoPorRpc(sesion, {
    titulo: 'Rack de living',
    estado: 'a_presupuestar',
    telefono: '11 5555-2222',
    sena: 5_000_000,
  });

  await abrir(page, '/seguimiento');
  await tarjetas(page).first().getByText('Falta presupuestar').click({ force: true });
  await expect(page).toHaveURL(new RegExp(`/proyectos/${id}$`));

  await page.goBack();
  const cliente = tarjetas(page)
    .first()
    .getByRole('link', { name: 'Cliente de Rack de living', exact: true });
  await cliente.click();
  await expect(page).toHaveURL(/\/clientes\/[^/]+$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Cliente de Rack de living');

  await page.goBack();
  await cliente.focus();
  await page.keyboard.press('Tab');
  await expect(
    tarjetas(page).first().getByRole('link', { name: 'Rack de living', exact: true }),
  ).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(
    tarjetas(page)
      .first()
      .getByRole('link', { name: /^Llamar a/ }),
  ).toBeFocused();
});

test('pasados nueve días, la tarjeta dice hace cuánto y se marca como fría', async ({ page }) => {
  await contactoPorRpc(sesion, {
    titulo: 'Presupuesto sin respuesta',
    estado: 'presupuesto_enviado',
  });

  await abrir(page, '/seguimiento');
  await expect(tarjetas(page).first()).toContainText('Presupuesto enviado hoy');
  await expect(tarjetas(page).first()).not.toHaveClass(/border-atencion/);

  await page.clock.setFixedTime(new Date(Date.now() + 9 * UN_DIA_MS));
  await page.getByRole('tab', { name: /Activos/ }).click();
  await page.getByRole('tab', { name: /Seguimiento/ }).click();

  await expect(tarjetas(page).first()).toContainText(
    'Presupuesto enviado hace 9 días, sin respuesta',
  );
  await expect(tarjetas(page).first()).toHaveClass(/border-atencion/);
});

test('en modo avión el contacto con su seña queda entero, sobrevive a cerrar la app y se confirma al volver la señal', async ({
  page,
  context,
}) => {
  await crearCliente(sesion, 'Nora Paz', { telefono: '11 4444-5555' });

  await abrir(page, '/seguimiento');
  await expect(page.getByRole('button', { name: 'Cargar el primer contacto' })).toBeVisible();
  await listoParaCortar(page);
  await context.setOffline(true);

  await page.getByRole('button', { name: 'Cargar contacto', exact: true }).click();
  const alta = page.getByRole('dialog', { name: 'Cargar contacto' });
  await alta.getByRole('combobox', { name: 'Cliente' }).fill('Nora');
  await alta
    .getByRole('option', { name: /Nora Paz/ })
    .first()
    .click();
  await alta.getByLabel('Qué pide').fill('Biblioteca sin señal');
  await alta.getByLabel('Visita', { exact: true }).fill(fechaLocal(-1));
  await alta.getByLabel('Seña cobrada').fill('80.000');
  await alta.getByRole('button', { name: 'Guardar contacto' }).click();

  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Biblioteca sin señal');
  await expect(page.getByRole('region', { name: 'Qué falta' })).toContainText('Falta presupuestar');

  await page.getByRole('button', { name: 'Mandé el presupuesto' }).click();
  await page.getByRole('button', { name: 'Marcar como enviado' }).click();
  await expect(page.getByRole('region', { name: 'Qué falta' })).toContainText(
    'Falta llamar para saber',
  );
  await page.getByRole('radio', { name: 'A presupuestar' }).click();
  await expect(page.getByRole('radio', { name: 'A presupuestar' })).toHaveAttribute(
    'aria-checked',
    'true',
  );
  await expect(indicadorDeSync(page)).toContainText('Sin conexión');
  expect(await leerProyecto(sesion, 'Biblioteca sin señal')).toBeUndefined();

  await page.close();
  const reabierta = await context.newPage();
  await reabierta.goto('/seguimiento');
  const tarjeta = tarjetas(reabierta).first();
  await expect(tarjeta).toContainText('Biblioteca sin señal', { timeout: 30_000 });
  await expect(tarjeta).toContainText('A presupuestar');
  await expect(tarjeta).toContainText('$ 80.000');
  await expect(indicadorDeSync(reabierta)).toContainText('Sin conexión');
  expect(await leerProyecto(sesion, 'Biblioteca sin señal')).toBeUndefined();

  await context.setOffline(false);
  await esperarEstado('Biblioteca sin señal', 'a_presupuestar');
  const guardado = await leerProyecto(sesion, 'Biblioteca sin señal');
  const pagos = await pagosDe(sesion, guardado?.id ?? '');
  expect(pagos).toHaveLength(1);
  expect(pagos[0]?.monto_centavos).toBe(8_000_000);

  await reabierta.reload();
  await expect(tarjetas(reabierta).first()).toContainText('$ 80.000', { timeout: 30_000 });
  await expect(reabierta.getByText('El servidor lo rechazó')).toBeHidden();
});

test('llamar y escribir por WhatsApp salen de la tarjeta y de la ficha, en el celular', async ({
  page,
  isMobile,
}) => {
  test.skip(!isMobile, 'es el caso del celular camino a la visita');

  const { id } = await contactoPorRpc(sesion, {
    titulo: 'Mesa de comedor',
    estado: 'relevamiento',
    visita: fechaLocal(0),
    telefono: '011 15-4444-5555',
  });
  await contactoPorRpc(sesion, { titulo: 'Sin teléfono todavía' });

  await abrir(page, '/seguimiento');
  const conTelefono = tarjetas(page).filter({ hasText: 'Mesa de comedor' });
  const llamar = conTelefono.getByRole('link', { name: /^Llamar a/ });
  await expect(llamar).toHaveAttribute('href', 'tel:0111544445555');
  await expect(conTelefono.getByRole('link', { name: /por WhatsApp$/ })).toHaveAttribute(
    'href',
    'https://wa.me/5491144445555',
  );
  const caja = await llamar.boundingBox();
  expect(caja?.height ?? 0).toBeGreaterThanOrEqual(44);

  const sinTelefono = tarjetas(page).filter({ hasText: 'Sin teléfono todavía' });
  await expect(sinTelefono.getByRole('button', { name: /no tiene teléfono cargado/ })).toHaveCount(
    2,
  );
  await expect(sinTelefono.getByRole('button', { name: /^Llamar a/ })).toBeDisabled();

  await abrir(page, `/proyectos/${id}`);
  const acciones = page.getByRole('region', { name: /^Contactar a/ });
  await expect(acciones.getByRole('link', { name: /^Llamar a/ })).toHaveAttribute(
    'href',
    'tel:0111544445555',
  );
  const whatsapp = acciones.getByRole('link', { name: /por WhatsApp$/ });
  await expect(whatsapp).toHaveAttribute('href', 'https://wa.me/5491144445555');
  await expect(whatsapp).toHaveAttribute('target', '_blank');
  await expect(page.getByRole('region', { name: 'Qué falta' })).toContainText('Ir a relevar hoy');
});

test('la lista vacía, con datos y sin resultados dicen cosas distintas', async ({ page }) => {
  await crearCliente(sesion, 'Julia Ferro');

  await abrir(page, '/seguimiento');
  await expect(page.getByRole('heading', { level: 2 })).toHaveText(
    'Nadie en seguimiento por ahora',
  );

  await page.getByRole('button', { name: 'Cargar el primer contacto' }).click();
  const alta = page.getByRole('dialog', { name: 'Cargar contacto' });
  await alta.getByRole('button', { name: 'Guardar contacto' }).click();
  await expect(alta.getByText('Elegí un cliente, o escribí su nombre para crearlo.')).toBeVisible();
  await expect(alta.getByText('Contá qué pide, aunque sea en dos palabras.')).toBeVisible();

  await alta.getByRole('combobox', { name: 'Cliente' }).fill('Julia');
  await alta
    .getByRole('option', { name: /Julia Ferro/ })
    .first()
    .click();
  await alta.getByLabel('Qué pide').fill('Alacena de cocina');
  await alta.getByRole('button', { name: 'Guardar contacto' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Alacena de cocina');

  await page.getByRole('link', { name: 'Seguimiento', exact: true }).first().click();
  await expect(tarjetas(page)).toHaveCount(1);

  await page.getByRole('searchbox', { name: 'Buscar contacto' }).fill('zzz');
  await expect(page.getByText('Ningún contacto coincide con «zzz».')).toBeVisible();
  await page.getByRole('button', { name: 'Limpiar la búsqueda' }).click();
  await expect(tarjetas(page)).toHaveCount(1);

  await page.getByRole('button', { name: 'Presupuesto enviado', exact: true }).click();
  await expect(page.getByText('Ningún contacto está en esa etapa.')).toBeVisible();
  await page.getByRole('button', { name: 'Limpiar la búsqueda' }).click();
  await expect(tarjetas(page)).toHaveCount(1);
});

test('«Ya fui a relevar» pide el día, y corregirlo después corre el vencimiento mientras no se lo ponga a mano', async ({
  page,
}) => {
  const { id, titulo } = await contactoPorRpc(sesion, {
    titulo: 'Cocina en L',
    estado: 'relevamiento',
    visita: fechaLocal(2),
    sena: 3_000_000,
  });

  await abrir(page, `/proyectos/${id}`);
  const panel = page.getByRole('region', { name: 'Qué falta' });
  await panel.getByRole('button', { name: 'Ya fui a relevar' }).click();
  const dia = panel.getByLabel('Qué día fuiste', { exact: true });
  await expect(dia).toBeFocused();
  await expect(dia).toHaveValue(fechaLocal(0));
  await expect(panel.getByLabel('Cuánto te pagó la visita')).toHaveCount(0);

  await dia.fill(fechaLocal(-3));
  await expect(panel.getByLabel('Entregar el presupuesto antes del')).toHaveValue(
    unaSemanaDeTrabajoDesde(fechaLocal(-3)),
  );
  await panel.getByRole('button', { name: 'Anotar el relevamiento' }).click();
  await expect(panel).toContainText('Falta presupuestar');

  await expect
    .poll(async () => (await leerContacto(sesion, titulo))?.estado, CARGA)
    .toBe('a_presupuestar');
  expect(await leerContacto(sesion, titulo)).toMatchObject({
    fecha_visita: fechaLocal(-3),
    vencimiento_presupuesto: unaSemanaDeTrabajoDesde(fechaLocal(-3)),
  });

  const datos = page.getByRole('region', { name: 'Datos del contacto' });
  await expect(datos).toContainText('Relevamiento');
  await page.getByRole('button', { name: 'Cambiar el día del relevamiento' }).click();
  const hoja = page.getByRole('dialog', { name: 'Editar el contacto' });
  const diaEnLaHoja = hoja.getByLabel('Día que fuiste a relevar');
  await expect(diaEnLaHoja).toBeFocused();
  await diaEnLaHoja.fill(fechaLocal(-1));
  await expect(hoja.getByLabel('Entregar el presupuesto antes del')).toHaveValue(
    unaSemanaDeTrabajoDesde(fechaLocal(-1)),
  );
  await hoja.getByRole('button', { name: 'Guardar los cambios' }).click();
  await expect(hoja).toBeHidden();
  await expect
    .poll(async () => (await leerContacto(sesion, titulo))?.fecha_visita, CARGA)
    .toBe(fechaLocal(-1));
  expect((await leerContacto(sesion, titulo))?.vencimiento_presupuesto).toBe(
    unaSemanaDeTrabajoDesde(fechaLocal(-1)),
  );

  await page.getByRole('button', { name: 'Cambiar el día del relevamiento' }).click();
  await hoja.getByLabel('Entregar el presupuesto antes del').fill(fechaLocal(20));
  await hoja.getByLabel('Día que fuiste a relevar').fill(fechaLocal(-2));
  await expect(hoja.getByLabel('Entregar el presupuesto antes del')).toHaveValue(fechaLocal(20));
  await hoja.getByRole('button', { name: 'Guardar los cambios' }).click();
  await expect(hoja).toBeHidden();
  await expect
    .poll(async () => (await leerContacto(sesion, titulo))?.vencimiento_presupuesto, CARGA)
    .toBe(fechaLocal(20));
  expect((await leerContacto(sesion, titulo))?.fecha_visita).toBe(fechaLocal(-2));
});

test('el camino con estimativo, de punta a punta: consulta, estimativo, visita cobrada, tareas, presupuesto y aprobación', async ({
  page,
}) => {
  const { id, titulo } = await contactoPorRpc(sesion, { titulo: 'Biblioteca por WhatsApp' });

  await abrir(page, `/proyectos/${id}`);
  const panel = page.getByRole('region', { name: 'Qué falta' });
  await panel.getByRole('button', { name: 'Mandé un estimativo' }).click();
  await expect(panel).toContainText('Si avanza, falta agendar la visita');
  await expect(panel.getByRole('radio', { name: 'Estimativo enviado' })).toHaveAttribute(
    'aria-checked',
    'true',
  );
  await esperarEstado(titulo, 'presupuesto_estimativo');

  await panel.getByRole('button', { name: 'Agendar la visita' }).click();
  const hoja = page.getByRole('dialog', { name: 'Editar el contacto' });
  const visita = hoja.getByLabel('Visita', { exact: true });
  await expect(visita).toBeFocused();
  await visita.fill(fechaLocal(0));
  await hoja.getByRole('button', { name: 'Guardar los cambios' }).click();
  await expect(hoja).toBeHidden();
  await expect(panel).toContainText('Ir a relevar hoy');
  await esperarEstado(titulo, 'relevamiento');

  await panel.getByRole('button', { name: 'Ya fui a relevar' }).click();
  await panel.getByLabel('Cuánto te pagó la visita').fill('40.000');
  await panel.getByRole('button', { name: 'Anotar el relevamiento' }).click();
  await expect(panel).toContainText('Falta presupuestar');
  await esperarEstado(titulo, 'a_presupuestar');
  await expect.poll(async () => (await pagosDe(sesion, id)).length, CARGA).toBe(1);

  const tareas = panel.getByRole('group', { name: /^Para el presupuesto/ });
  for (const tarea of ['Diseñar', 'Despiezar', 'Cotizar', 'Armar el PDF']) {
    const casilla = tareas.getByRole('checkbox', { name: new RegExp(`^${tarea}`) });
    await casilla.click();
    await expect(casilla).toBeChecked();
  }
  await expect(panel).toContainText('Ya está armado: falta mandar el presupuesto');
  await expect.poll(() => tareasEnLaBase(titulo), CARGA).toEqual([true, true, true, true]);

  await panel.getByRole('button', { name: 'Mandé el presupuesto' }).click();
  await panel.getByLabel('Cuánto presupuestaste').fill('950.000');
  await panel.getByRole('button', { name: 'Marcar como enviado' }).click();
  await expect(panel).toContainText('Falta llamar para saber');
  await esperarEstado(titulo, 'presupuesto_enviado');

  await panel.getByRole('button', { name: 'Lo aprobó: pasar a Proyectos' }).click();
  await expect(page.getByLabel('Presupuesto aprobado')).toHaveValue('950.000');
  await page.getByLabel('Seña que cobrás ahora').fill('');
  // Con Enter y no con un toque: en el celular el formulario del pasaje es largo y el botón puede
  // quedar pegado al borde de abajo, debajo de la barra que flota ahí (ADR 0025). El toque de
  // Playwright cae en la barra y el click nunca llega al botón; el camino del teclado no depende
  // de dónde quedó parada la pantalla.
  await page.getByRole('button', { name: 'Pasar a Proyectos' }).press('Enter');
  await esperarEstado(titulo, 'en_curso');
});

test('sin estimativo: relevar sin cobrar sugiere el estimativo, y aun así se puede mandar el presupuesto completo', async ({
  page,
}) => {
  const { id, titulo } = await contactoPorRpc(sesion, {
    titulo: 'Rack sin seña',
    estado: 'relevamiento',
    visita: fechaLocal(-1),
  });

  await abrir(page, `/proyectos/${id}`);
  const panel = page.getByRole('region', { name: 'Qué falta' });
  await panel.getByRole('button', { name: 'Ya fui a relevar' }).click();
  await expect(panel.getByLabel('Qué día fuiste', { exact: true })).toHaveValue(fechaLocal(-1));
  await expect(panel.getByLabel('Cuánto te pagó la visita')).toBeVisible();
  await panel.getByRole('button', { name: 'Anotar el relevamiento' }).click();

  await expect(panel).toContainText('Falta el estimativo: la visita no está cobrada');
  await expect(panel.getByRole('button', { name: 'Mandé el estimativo' })).toBeVisible();
  await esperarEstado(titulo, 'a_presupuestar');

  await page.getByRole('link', { name: 'Seguimiento', exact: true }).first().click();
  await expect(tarjetas(page).first()).toContainText(
    'Falta el estimativo: la visita no está cobrada',
  );
  await page.getByRole('link', { name: titulo, exact: true }).click();

  await panel.getByRole('button', { name: 'Mandé el presupuesto' }).click();
  await panel.getByRole('button', { name: 'Marcar como enviado' }).click();
  await expect(panel).toContainText('Falta llamar para saber');
  await esperarEstado(titulo, 'presupuesto_enviado');
  expect(await pagosDe(sesion, id)).toHaveLength(0);
});

test('las tareas de presupuestar se tildan y se destildan, y con las cuatro la app sugiere mandarlo sin cambiar el estado', async ({
  page,
}) => {
  const { id, titulo } = await contactoPorRpc(sesion, {
    titulo: 'Vestidor con tareas',
    estado: 'a_presupuestar',
    sena: 5_000_000,
  });

  await abrir(page, `/proyectos/${id}`);
  const panel = page.getByRole('region', { name: 'Qué falta' });
  const tareas = panel.getByRole('group', { name: /^Para el presupuesto/ });
  const tarea = (nombre: string) =>
    tareas.getByRole('checkbox', { name: new RegExp(`^${nombre}`) });
  const tildar = async (nombre: string, hecha: boolean) => {
    await tarea(nombre).click();
    await expect(tarea(nombre)).toBeChecked({ checked: hecha });
  };
  await expect(tareas).toContainText('0 de 4');

  await tildar('Diseñar', true);
  await tildar('Despiezar', true);
  await expect(panel).toContainText('Falta presupuestar: 2 de 4 tareas hechas');
  await expect.poll(() => tareasEnLaBase(titulo), CARGA).toEqual([true, true, false, false]);

  await tildar('Despiezar', false);
  await expect(panel).toContainText('Falta presupuestar: 1 de 4 tareas hechas');
  await expect.poll(() => tareasEnLaBase(titulo), CARGA).toEqual([true, false, false, false]);

  await tildar('Despiezar', true);
  await tildar('Cotizar', true);
  await tildar('Armar el PDF', true);
  await expect(panel).toContainText('Ya está armado: falta mandar el presupuesto');
  await expect(panel.getByRole('button').first()).toHaveText('Mandé el presupuesto');
  await expect.poll(() => tareasEnLaBase(titulo), CARGA).toEqual([true, true, true, true]);
  expect((await leerContacto(sesion, titulo))?.estado).toBe('a_presupuestar');
});

test('seguimiento y la ficha del contacto se recorren con el teclado', async ({ page }) => {
  await contactoPorRpc(sesion, {
    titulo: 'Escritorio flotante',
    estado: 'a_presupuestar',
    telefono: '11 5555-0000',
  });

  await abrir(page, '/seguimiento');
  await expect(tarjetas(page)).toHaveCount(1);
  const enLaLista = await recorrerConTab(page, 60);
  expect(enLaLista.some((foco) => foco.includes('Cargar contacto'))).toBe(true);
  expect(enLaLista.some((foco) => foco.includes('Buscar contacto'))).toBe(true);
  expect(enLaLista.some((foco) => foco.includes('Todos'))).toBe(true);
  expect(enLaLista.some((foco) => foco.includes('Escritorio flotante'))).toBe(true);
  expect(enLaLista.some((foco) => foco.includes('Llamar a'))).toBe(true);
  expect(enLaLista.some((foco) => foco.includes('por WhatsApp'))).toBe(true);

  await page.getByRole('link', { name: 'Escritorio flotante', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Escritorio flotante');

  const enLaFicha = await recorrerConTab(page, 60);
  expect(enLaFicha.some((foco) => foco.includes('Mandé el presupuesto'))).toBe(true);
  expect(enLaFicha.some((foco) => foco.includes('Ya lo aprobó'))).toBe(true);
  expect(enLaFicha.some((foco) => foco.includes('Presupuesto enviado'))).toBe(true);
  expect(enLaFicha.some((foco) => foco.includes('Notas'))).toBe(true);
  expect(enLaFicha.some((foco) => foco.includes('Dar por perdido'))).toBe(true);

  await page.getByRole('button', { name: 'Editar', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog', { name: 'Editar el contacto' })).toBeVisible();
  await expect(page.getByLabel('Teléfono')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: 'Editar el contacto' })).toBeHidden();

  await page.getByRole('link', { name: 'Seguimiento', exact: true }).first().click();
  await page.getByRole('button', { name: 'Cargar contacto', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('combobox', { name: 'Cliente' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page).toHaveURL(/\/seguimiento$/);
});
