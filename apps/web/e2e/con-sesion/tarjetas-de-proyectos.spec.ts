import { expect, test, type Locator } from '@playwright/test';

import {
  contactoPorRpc,
  crearCliente,
  guardarProyectoPorRpc,
  iniciarSesionDePrueba,
  vaciarTaller,
} from '../apoyo/taller';

async function estiloDeLaTarjeta(tarjeta: Locator) {
  return tarjeta.evaluate((elemento) => {
    const estilo = getComputedStyle(elemento);
    return {
      etiqueta: elemento.tagName,
      borde: `${estilo.borderTopWidth} ${estilo.borderRightWidth} ${estilo.borderBottomWidth} ${estilo.borderLeftWidth}`,
      radio: estilo.borderTopLeftRadius,
      relleno: `${estilo.paddingTop} ${estilo.paddingLeft}`,
      enlaceEstirado: elemento.querySelector('a[data-tarjeta]') !== null,
    };
  });
}

test('en el celular, las tarjetas de Activos y las de Seguimiento son la misma, con su borde', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'celular', 'en escritorio Activos es una tabla');
  const sesion = await iniciarSesionDePrueba();
  await vaciarTaller(sesion);
  await contactoPorRpc(sesion, { titulo: 'Biblioteca', estado: 'a_presupuestar' });
  const clienteId = await crearCliente(sesion, 'Claudio');
  await guardarProyectoPorRpc(sesion, {
    proyecto: {
      id: crypto.randomUUID(),
      version: null,
      cliente_id: clienteId,
      titulo: 'Placard',
      estado: 'en_curso',
      presupuesto_centavos: 50_000_000,
      comprobante: 'sin_comprobante',
    },
    pagos: [],
    gastos: [],
  });

  await page.goto('/proyectos');
  const activa = page.getByRole('list', { name: 'Proyectos' }).getByRole('listitem').first();
  await expect(activa).toBeVisible({ timeout: 30_000 });
  const deActivos = await estiloDeLaTarjeta(activa);

  await page.getByRole('tab', { name: /Seguimiento/ }).click();
  const contacto = page.getByRole('list', { name: 'Contactos' }).getByRole('listitem').first();
  await expect(contacto).toBeVisible();
  const deSeguimiento = await estiloDeLaTarjeta(contacto);

  expect(deActivos).toEqual(deSeguimiento);
  expect(deActivos.borde).toBe('1px 1px 1px 1px');
  expect(deActivos.enlaceEstirado).toBe(true);
});
