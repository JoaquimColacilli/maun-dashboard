import { expect, test, type Locator, type Page } from '@playwright/test';

import {
  contactoPorRpc,
  crearAnotacionPorRest,
  crearCliente,
  guardarProyectoPorRpc,
  iniciarSesionDePrueba,
  vaciarTaller,
  type SesionDePrueba,
} from '../apoyo/taller';

const CARGA = { timeout: 30_000 };
const UN_DIA_MS = 86_400_000;
const DIAS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
const MESES = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
];

function fechaLocal(desplazamientoEnDias = 0): string {
  const dia = new Date(Date.now() + desplazamientoEnDias * UN_DIA_MS);
  return `${String(dia.getFullYear())}-${String(dia.getMonth() + 1).padStart(2, '0')}-${String(dia.getDate()).padStart(2, '0')}`;
}

function diaEnPalabras(fecha: string): string {
  const dia = new Date(`${fecha}T12:00:00`);
  return `${DIAS[dia.getDay()] ?? ''} ${String(dia.getDate())} de ${MESES[dia.getMonth()] ?? ''}`;
}

let sesion: SesionDePrueba;

test.beforeEach(async () => {
  sesion = await iniciarSesionDePrueba();
  await vaciarTaller(sesion);
});

async function obraDe(clienteId: string, titulo: string, entrega: string): Promise<string> {
  const id = crypto.randomUUID();
  await guardarProyectoPorRpc(sesion, {
    proyecto: {
      id,
      version: null,
      cliente_id: clienteId,
      titulo,
      estado: 'en_curso',
      presupuesto_centavos: 80_000_000,
      comprobante: 'sin_comprobante',
      fecha_inicio: fechaLocal(),
      entrega_estimada: entrega,
    },
    pagos: [],
    gastos: [],
  });
  return id;
}

async function abrirElDiaDeHoy(page: Page, isMobile: boolean, cosas: string): Promise<Locator> {
  const hoy = diaEnPalabras(fechaLocal());
  if (isMobile) {
    await page.getByRole('button', { name: `Ver el ${hoy}` }).click();
    return page.getByRole('dialog', { name: hoy });
  }
  await page.getByRole('button', { name: `${hoy}, hoy: ${cosas}` }).click();
  return page.getByRole('complementary', { name: `El ${hoy}` });
}

test('la ficha del cliente lleva a cada trabajo de su historial, se toque el título o la fila', async ({
  page,
}) => {
  const contacto = await contactoPorRpc(sesion, {
    titulo: 'Rack del living',
    estado: 'a_presupuestar',
  });
  const obraId = await obraDe(contacto.clienteId, 'Mesa de comedor', fechaLocal(10));

  await page.goto(`/clientes/${contacto.clienteId}`);
  const historial = page.getByRole('region', { name: 'Historial' });
  await expect(historial.getByRole('listitem')).toHaveCount(2, CARGA);

  await historial.getByRole('link', { name: 'Mesa de comedor', exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/proyectos/${obraId}$`));
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Mesa de comedor');

  await page.goBack();
  await historial
    .getByRole('listitem')
    .filter({ hasText: 'Rack del living' })
    .getByText('Seguimiento')
    .click({ force: true });
  await expect(page).toHaveURL(new RegExp(`/proyectos/${contacto.id}$`));
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Rack del living');

  await page.getByRole('link', { name: 'Cliente de Rack del living', exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/clientes/${contacto.clienteId}$`));
});

test('en Inicio, la entrega más próxima lleva a su obra y no a la lista', async ({ page }) => {
  const clienteId = await crearCliente(sesion, 'Cliente de la mesada');
  const obraId = await obraDe(clienteId, 'Mesada de cocina', fechaLocal(4));

  await page.goto('/');
  const acceso = page.getByRole('button', { name: /Entrega más próxima/ });
  await expect(acceso).toContainText('Mesada de cocina', CARGA);
  await acceso.click();
  await expect(page).toHaveURL(new RegExp(`/proyectos/${obraId}$`));
});

test('en el celular, «Hoy en la agenda» lleva a la obra que se entrega hoy', async ({
  page,
  isMobile,
}) => {
  test.skip(!isMobile, '«Hoy en la agenda» vive en el Inicio del celular');
  const clienteId = await crearCliente(sesion, 'Cliente del vestidor');
  const obraId = await obraDe(clienteId, 'Vestidor en L', fechaLocal());

  await page.goto('/');
  const hoy = page.getByRole('region', { name: 'Hoy en la agenda' });
  await hoy.getByRole('link', { name: /Vestidor en L/ }).click(CARGA);
  await expect(page).toHaveURL(new RegExp(`/proyectos/${obraId}$`));
});

test('en el día de la agenda, el cliente de una visita lleva a su ficha y el trabajo de una anotación, al trabajo', async ({
  page,
  isMobile,
}) => {
  const contacto = await contactoPorRpc(sesion, {
    titulo: 'Biblioteca empotrada',
    estado: 'relevamiento',
    visita: fechaLocal(),
  });
  await crearAnotacionPorRest(sesion, {
    fecha: fechaLocal(),
    texto: 'Comprar las guías',
    categoria: 'materiales',
    proyecto_id: contacto.id,
  });

  await page.goto('/agenda');
  await expect(page.getByRole('heading', { level: 1, name: 'Agenda' })).toBeVisible(CARGA);
  const dia = await abrirElDiaDeHoy(page, isMobile, '2 cosas');
  await dia.getByRole('link', { name: 'Cliente de Biblioteca empotrada', exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/clientes/${contacto.clienteId}$`));

  await page.goBack();
  await expect(page.getByRole('heading', { level: 1, name: 'Agenda' })).toBeVisible(CARGA);
  const otraVez = await abrirElDiaDeHoy(page, isMobile, '2 cosas');
  await otraVez.getByRole('link', { name: 'Biblioteca empotrada', exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/proyectos/${contacto.id}$`));
});
