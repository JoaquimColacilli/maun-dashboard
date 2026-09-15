import { expect, test, type Page } from '@playwright/test';

import { indicadorDeSync, listoParaCortar } from '../apoyo/pantalla';
import {
  ajustarTaller,
  contactoPorRpc,
  crearCliente,
  guardarProyectoPorRpc,
  iniciarSesionDePrueba,
  leerProyecto,
  vaciarTaller,
  type SesionDePrueba,
} from '../apoyo/taller';

const CARGA = { timeout: 30_000 };

let sesion: SesionDePrueba;

test.beforeEach(async () => {
  sesion = await iniciarSesionDePrueba();
  await vaciarTaller(sesion);
});

function hoyLocal(): string {
  const dia = new Date();
  const mes = String(dia.getMonth() + 1).padStart(2, '0');
  const numero = String(dia.getDate()).padStart(2, '0');
  return `${String(dia.getFullYear())}-${mes}-${numero}`;
}

async function obra(
  titulo: string,
  estado: 'en_curso' | 'entregado',
  cobrado = 0,
  presupuesto = 60_000_000,
): Promise<string> {
  const clienteId = await crearCliente(sesion, `Cliente de ${titulo}`);
  const id = crypto.randomUUID();
  await guardarProyectoPorRpc(sesion, {
    proyecto: {
      id,
      version: null,
      cliente_id: clienteId,
      titulo,
      estado,
      presupuesto_centavos: presupuesto,
      comprobante: 'sin_comprobante',
    },
    pagos:
      cobrado === 0
        ? []
        : [
            {
              id: crypto.randomUUID(),
              fecha: hoyLocal(),
              concepto: 'Seña',
              monto_centavos: cobrado,
            },
          ],
    gastos: [],
  });
  return id;
}

function queFalta(page: Page) {
  return page.getByRole('region', { name: 'Qué falta' });
}

async function accionesOfrecidas(page: Page): Promise<string[]> {
  const textos = await queFalta(page).getByRole('button').allInnerTexts();
  return textos.map((texto) => texto.trim());
}

async function estadoEnLaBase(titulo: string): Promise<string | undefined> {
  return (await leerProyecto(sesion, titulo))?.estado;
}

test('en la ficha de una obra las acciones son las transiciones válidas, y ninguna cobra ni da por perdido', async ({
  page,
}, testInfo) => {
  const titulo = 'Placard del pasillo';
  const id = await obra(titulo, 'en_curso', 10_000_000);

  await page.goto(`/proyectos/${id}`);
  await expect(queFalta(page)).toContainText('Falta entregarlo', CARGA);

  expect(await accionesOfrecidas(page)).toEqual(['Ya lo entregué', 'Volvió a presupuesto']);
  console.log(
    `[${testInfo.project.name}] en_curso ofrece: ${(await accionesOfrecidas(page)).join(' · ')}`,
  );
  await expect(queFalta(page).getByRole('button', { name: /cobr|perdid|repart/i })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Dar por perdido' })).toBeVisible();

  await queFalta(page).getByRole('button', { name: 'Ya lo entregué' }).click();
  await expect(queFalta(page)).toContainText(/Falta cobrar \$\s?500\.000/);
  expect(await accionesOfrecidas(page)).toEqual(['Volvió al taller']);
  console.log(
    `[${testInfo.project.name}] entregado ofrece: ${(await accionesOfrecidas(page)).join(' · ')}`,
  );
  await expect(queFalta(page).getByRole('button', { name: /cobr|perdid|repart/i })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /^Cobrar el saldo/ })).toBeVisible();
  await expect.poll(() => estadoEnLaBase(titulo), CARGA).toBe('entregado');
  expect((await leerProyecto(sesion, titulo))?.fecha_entrega).toBe(hoyLocal());

  await queFalta(page).getByRole('button', { name: 'Volvió al taller' }).click();
  await expect(queFalta(page)).toContainText('Falta entregarlo');
  await expect.poll(() => estadoEnLaBase(titulo), CARGA).toBe('en_curso');
  expect((await leerProyecto(sesion, titulo))?.fecha_entrega).toBeNull();

  await queFalta(page).getByRole('button', { name: 'Volvió a presupuesto' }).click();
  await expect(queFalta(page)).toContainText('Falta llamar para saber');
  await expect.poll(() => estadoEnLaBase(titulo), CARGA).toBe('presupuesto_enviado');
});

test('en la ficha de un contacto cada etapa ofrece sus pasos, sacados de la misma máquina', async ({
  page,
}, testInfo) => {
  const esperado: Record<string, string[]> = {
    contacto: ['Agendar la visita', 'Mandé un estimativo', 'Ya lo aprobó'],
    presupuesto_estimativo: ['Agendar la visita', 'Ya lo aprobó'],
    relevamiento: ['Ya fui a relevar', 'Ya lo aprobó'],
    a_presupuestar: ['Mandé el estimativo', 'Mandé el presupuesto', 'Ya lo aprobó'],
    presupuesto_enviado: ['Lo aprobó: pasar a Proyectos'],
  };
  const ids = new Map<string, string>();
  for (const estado of Object.keys(esperado)) {
    const { id } = await contactoPorRpc(sesion, { titulo: `Contacto en ${estado}`, estado });
    ids.set(estado, id);
  }

  for (const [estado, acciones] of Object.entries(esperado)) {
    await page.goto(`/proyectos/${ids.get(estado) ?? ''}`);
    await expect(queFalta(page)).toBeVisible(CARGA);
    expect(await accionesOfrecidas(page)).toEqual(acciones);
    const etapas = (await queFalta(page).getByRole('radio').allInnerTexts()).map((t) => t.trim());
    expect(etapas).toEqual([
      'Contacto',
      'Estimativo enviado',
      'Relevamiento',
      'A presupuestar',
      'Presupuesto enviado',
    ]);
    console.log(
      `[${testInfo.project.name}] ${estado} ofrece: ${acciones.join(' · ')} | etapa: ${etapas.join(' · ')}`,
    );
  }
});

test('un proyecto cobrado no ofrece cambios de estado: se reabre por su propio camino', async ({
  page,
}) => {
  await ajustarTaller(sesion, {
    sueldo_mensual_centavos: 50_000_000,
    costos_fijos_centavos: 25_000_000,
  });
  const id = await obra('Mesa ratona', 'entregado', 30_000_000, 30_000_000);

  await page.goto(`/proyectos/${id}`);
  await expect(queFalta(page)).toBeVisible(CARGA);
  await page.getByRole('button', { name: /^Cobrar/ }).click();
  await page.getByRole('button', { name: /^Cobrar y repartir/ }).click();
  await expect(page).toHaveURL(new RegExp(`/proyectos/${id}$`), CARGA);

  await expect(page.getByRole('button', { name: 'Reabrir el cobro' })).toBeVisible();
  await expect(queFalta(page)).toHaveCount(0);
});

test('sin señal el cambio de estado queda en la cola y llega a la base cuando vuelve', async ({
  page,
  context,
}) => {
  const titulo = 'Mesa sin señal';
  const id = await obra(titulo, 'en_curso');

  await page.goto(`/proyectos/${id}`);
  await expect(queFalta(page)).toContainText('Falta entregarlo', CARGA);
  await listoParaCortar(page);

  await context.setOffline(true);
  await queFalta(page).getByRole('button', { name: 'Ya lo entregué' }).click();
  await expect(queFalta(page)).toContainText(/Falta cobrar \$\s?600\.000/);
  await expect(indicadorDeSync(page)).toContainText('1 cambio');
  expect(await estadoEnLaBase(titulo)).toBe('en_curso');

  await context.setOffline(false);
  await expect(indicadorDeSync(page)).toBeHidden({ timeout: 20_000 });
  await expect.poll(() => estadoEnLaBase(titulo), CARGA).toBe('entregado');
});
