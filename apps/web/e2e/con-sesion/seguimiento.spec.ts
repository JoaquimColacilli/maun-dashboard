import { expect, test, type Page } from '@playwright/test';

import { listoParaCortar, saldosEnInicio } from '../apoyo/pantalla';
import {
  contactoPorRpc,
  crearCliente,
  distribucionDe,
  iniciarSesionDePrueba,
  leerProyecto,
  pagosDe,
  vaciarTaller,
  type SesionDePrueba,
} from '../apoyo/taller';

const UN_DIA_MS = 86_400_000;

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
  await expect(page.getByText('Seña ya cobrada')).toBeVisible();
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
  await expect(page.getByRole('status').first()).toContainText('Sin conexión');
  expect(await leerProyecto(sesion, 'Biblioteca sin señal')).toBeUndefined();

  await page.close();
  const reabierta = await context.newPage();
  await reabierta.goto('/seguimiento');
  const tarjeta = tarjetas(reabierta).first();
  await expect(tarjeta).toContainText('Biblioteca sin señal', { timeout: 30_000 });
  await expect(tarjeta).toContainText('A presupuestar');
  await expect(tarjeta).toContainText('$ 80.000');
  await expect(reabierta.getByRole('status').first()).toContainText('Sin conexión');
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
