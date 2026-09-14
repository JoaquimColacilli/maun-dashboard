import { expect, test, type Page } from '@playwright/test';

import { entornoDePrueba } from '../apoyo/entorno';
import { indicadorDeSync, listoParaCortar } from '../apoyo/pantalla';
import { contarClientes, iniciarSesionDePrueba, vaciarTaller } from '../apoyo/taller';
import {
  activarBloqueoEnElDispositivo,
  alFrente,
  aSegundoPlano,
  CLAVE_DEL_BLOQUEO,
  contarPedidosDeHuella,
  credencialesDelTelefono,
  huellaQueVerifica,
  marcaDeBloqueo,
  pedidosDeHuella,
  registrarHuellaEnElTelefono,
  simularRegistroEnSupabase,
  telefonoConHuella,
  usuarioDeLaSesion,
  visibilidadControlable,
  type TelefonoVirtual,
} from '../apoyo/huella';

const CARGA_DEL_TALLER = { timeout: 30_000 };
const MAS_QUE_UNA_RECARGA = '00:30';

function ajustes(page: Page) {
  return page.getByRole('heading', { level: 1, name: 'Ajustes' });
}

function pantallaDeBloqueo(page: Page) {
  return page.getByRole('heading', { level: 1, name: /^Hola/ });
}

async function aLaVista(page: Page, nombre: string, rol: 'campo' | 'boton'): Promise<boolean> {
  const elemento =
    rol === 'campo'
      ? page.getByLabel(nombre, { exact: true })
      : page.getByRole('button', { name: nombre, exact: true });
  const caja = await elemento.boundingBox();
  const alto = await page.evaluate(() => window.visualViewport?.height ?? window.innerHeight);
  return caja !== null && caja.y >= 0 && caja.y + caja.height <= alto + 0.5;
}

async function bloquearYReabrir(page: Page, verifica: boolean): Promise<TelefonoVirtual> {
  await contarPedidosDeHuella(page);
  const telefono = await telefonoConHuella(page, verifica);
  await page.goto('/ajustes');
  await expect(ajustes(page)).toBeVisible(CARGA_DEL_TALLER);
  await registrarHuellaEnElTelefono(telefono, await usuarioDeLaSesion(page));
  await activarBloqueoEnElDispositivo(page);
  await page.reload();
  return telefono;
}

test.describe('el bloqueo con huella, en el celular', () => {
  test.skip(({ isMobile }) => !isMobile, 'el bloqueo es solo del celular');

  test('al abrir, la huella se pide sola, una sola vez, y el taller se abre sin tocar nada', async ({
    page,
  }) => {
    await bloquearYReabrir(page, true);

    await expect(ajustes(page)).toBeVisible(CARGA_DEL_TALLER);
    expect(await pedidosDeHuella(page)).toBe(1);
    expect(await marcaDeBloqueo(page)).toMatchObject({ credencial: expect.any(String) });
  });

  test('si la huella no se confirma pasa a la contraseña sin mostrar el taller, y el botón la vuelve a pedir', async ({
    page,
  }) => {
    const telefono = await bloquearYReabrir(page, false);

    await expect(pantallaDeBloqueo(page)).toBeVisible(CARGA_DEL_TALLER);
    await expect(page.getByLabel('Contraseña', { exact: true })).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Principal' })).toHaveCount(0);
    await expect(ajustes(page)).toHaveCount(0);
    expect(await pedidosDeHuella(page)).toBe(1);

    await huellaQueVerifica(telefono, true);
    await page.getByRole('button', { name: 'Probar con la huella' }).click();

    await expect(ajustes(page)).toBeVisible(CARGA_DEL_TALLER);
    expect(await pedidosDeHuella(page)).toBe(2);
  });

  test('con la huella cancelada se entra con la contraseña, por el camino de siempre', async ({
    page,
  }) => {
    await bloquearYReabrir(page, false);
    await expect(page.getByLabel('Contraseña', { exact: true })).toBeVisible(CARGA_DEL_TALLER);

    await page.getByLabel('Contraseña', { exact: true }).fill(entornoDePrueba().password);
    await page.getByRole('button', { name: 'Entrar', exact: true }).click();

    await expect(ajustes(page)).toBeVisible(CARGA_DEL_TALLER);
  });

  test('sin señal no ofrece una contraseña que va a fallar: dice que solo entra con la huella', async ({
    page,
    context,
  }) => {
    await bloquearYReabrir(page, false);
    await expect(page.getByLabel('Contraseña', { exact: true })).toBeVisible(CARGA_DEL_TALLER);

    await context.setOffline(true);
    await expect(page.getByRole('alert')).toContainText(
      'Sin señal solo podés entrar con la huella.',
    );
    await expect(page.getByLabel('Contraseña', { exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Probar con la huella' })).toBeVisible();
    await context.setOffline(false);
  });

  test('«Entrar con otra cuenta» con la cola vacía cierra la sesión y lleva al acceso', async ({
    page,
  }) => {
    await page.route('**/auth/v1/logout**', (ruta) => ruta.fulfill({ status: 204 }));
    await bloquearYReabrir(page, false);
    await expect(page.getByLabel('Contraseña', { exact: true })).toBeVisible(CARGA_DEL_TALLER);

    await page.getByRole('button', { name: 'Entrar con otra cuenta' }).click();

    await expect(page).toHaveURL(/\/acceso$/, CARGA_DEL_TALLER);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Entrá al taller');
    expect(await marcaDeBloqueo(page)).toBeNull();
  });

  test('«Entrar con otra cuenta» con cambios sin sincronizar dice cuántos se pierden antes de cerrar, también sin señal', async ({
    page,
    context,
  }) => {
    const sesion = await iniciarSesionDePrueba();
    await vaciarTaller(sesion);
    await page.route('**/auth/v1/logout**', (ruta) => ruta.fulfill({ status: 204 }));
    const telefono = await telefonoConHuella(page, false);
    await page.goto('/clientes');
    await expect(page.getByRole('button', { name: 'Cargá tu primer cliente' })).toBeVisible(
      CARGA_DEL_TALLER,
    );
    await registrarHuellaEnElTelefono(telefono, await usuarioDeLaSesion(page));
    await listoParaCortar(page);

    await context.setOffline(true);
    await page.getByRole('button', { name: 'Cargá tu primer cliente' }).click();
    await page.getByLabel('Nombre', { exact: true }).fill('Perdido al salir');
    await page.getByRole('button', { name: 'Guardar cliente' }).click();
    await expect(
      page.getByText('Cliente anotado sin señal: se guarda solo cuando vuelva.'),
    ).toBeVisible();
    await expect(indicadorDeSync(page)).toContainText('1 cambio');

    await activarBloqueoEnElDispositivo(page);
    await page.reload();

    await expect(pantallaDeBloqueo(page)).toBeVisible(CARGA_DEL_TALLER);
    await page.evaluate(() => {
      window.dispatchEvent(new Event('offline'));
    });
    await expect(
      page.getByRole('alert').filter({ hasText: 'Sin señal solo podés entrar con la huella.' }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Entrar con otra cuenta' }).click();

    const aviso = page.getByRole('alert').filter({ hasText: 'sin sincronizar' });
    await expect(aviso).toContainText('Hay 1 cambio de este teléfono sin sincronizar.');
    console.log(`aviso antes de salir: ${(await aviso.innerText()).replaceAll('\n', ' / ')}`);
    await expect(pantallaDeBloqueo(page)).toBeVisible();

    await page.getByRole('button', { name: 'No, volver' }).click();
    await expect(aviso).toHaveCount(0);
    await expect(pantallaDeBloqueo(page)).toBeVisible();

    await page.getByRole('button', { name: 'Entrar con otra cuenta' }).click();
    await page.getByRole('button', { name: 'Borrar el cambio y salir' }).click();

    await expect(page).toHaveURL(/\/acceso$/, CARGA_DEL_TALLER);
    expect(await marcaDeBloqueo(page)).toBeNull();
    await context.setOffline(false);
    expect(await contarClientes(sesion, 'Perdido al salir')).toBe(0);
  });

  test('con el teclado abierto, la contraseña y el botón de entrar quedan a la vista', async ({
    page,
  }) => {
    await bloquearYReabrir(page, false);
    const campo = page.getByLabel('Contraseña', { exact: true });
    await expect(campo).toBeVisible(CARGA_DEL_TALLER);

    await campo.focus();
    await page.setViewportSize({ width: 390, height: 460 });

    await expect.poll(() => aLaVista(page, 'Contraseña', 'campo')).toBe(true);
    await expect.poll(() => aLaVista(page, 'Entrar', 'boton')).toBe(true);
  });

  test('recargar estando adentro no vuelve a pedir la huella, tampoco después de un rato largo', async ({
    page,
  }) => {
    await visibilidadControlable(page);
    await bloquearYReabrir(page, true);
    await expect(ajustes(page)).toBeVisible(CARGA_DEL_TALLER);
    expect(await pedidosDeHuella(page)).toBe(1);

    await page.reload();
    await expect(ajustes(page)).toBeVisible(CARGA_DEL_TALLER);
    expect(await pedidosDeHuella(page)).toBe(0);

    await page.evaluate((clave) => {
      const marca = JSON.parse(localStorage.getItem(clave) ?? 'null') as Record<
        string,
        unknown
      > | null;
      if (!marca) throw new Error('No hay marca de bloqueo.');
      const haceDiezMinutos = Date.now() - 10 * 60_000;
      localStorage.setItem(
        clave,
        JSON.stringify({ ...marca, desbloqueadaEn: haceDiezMinutos, salioEn: null }),
      );
    }, CLAVE_DEL_BLOQUEO);
    await page.reload();
    await expect(ajustes(page)).toBeVisible(CARGA_DEL_TALLER);
    await expect(pantallaDeBloqueo(page)).toHaveCount(0);
    expect(await pedidosDeHuella(page)).toBe(0);
  });

  test('cerrar la app y abrirla pide la huella, aunque sea enseguida', async ({
    page,
    context,
  }) => {
    await visibilidadControlable(page);
    await bloquearYReabrir(page, true);
    await expect(ajustes(page)).toBeVisible(CARGA_DEL_TALLER);
    await aSegundoPlano(page);
    await page.close();

    const deNuevo = await context.newPage();
    await contarPedidosDeHuella(deNuevo);
    await deNuevo.goto('/ajustes');
    await expect(pantallaDeBloqueo(deNuevo)).toBeVisible(CARGA_DEL_TALLER);
    await expect(deNuevo.getByRole('navigation', { name: 'Principal' })).toHaveCount(0);
    expect(await pedidosDeHuella(deNuevo)).toBe(1);
  });

  test('volver de segundo plano pide la huella enseguida, y lo que se estaba cargando sigue ahí', async ({
    page,
  }) => {
    await visibilidadControlable(page);
    const telefono = await bloquearYReabrir(page, true);
    await expect(ajustes(page)).toBeVisible(CARGA_DEL_TALLER);

    await page.getByRole('button', { name: 'Cargar algo nuevo' }).click();
    await page.getByRole('menuitem', { name: 'Movimiento' }).click();
    const hoja = page.getByRole('dialog', { name: 'Cargar un movimiento' });
    await expect(hoja).toBeVisible();
    await hoja.getByLabel('Qué fue').fill('Tornillos para la mesada');

    await huellaQueVerifica(telefono, false);
    await aSegundoPlano(page);
    await alFrente(page);
    await expect(pantallaDeBloqueo(page)).toBeVisible();
    await expect(page.getByLabel('Contraseña', { exact: true })).toBeVisible();
    expect(await pedidosDeHuella(page)).toBe(2);

    await huellaQueVerifica(telefono, true);
    await page.getByRole('button', { name: 'Probar con la huella' }).click();
    await expect(pantallaDeBloqueo(page)).toHaveCount(0);
    await expect(hoja.getByLabel('Qué fue')).toHaveValue('Tornillos para la mesada');
  });

  test('desde Ajustes se registra la passkey, y después de salir de la app la próxima apertura pide la huella', async ({
    page,
  }) => {
    await page.clock.install();
    await visibilidadControlable(page);
    await contarPedidosDeHuella(page);
    const telefono = await telefonoConHuella(page);
    const verificados = await simularRegistroEnSupabase(page);
    await page.goto('/ajustes');
    await expect(ajustes(page)).toBeVisible(CARGA_DEL_TALLER);

    await page.getByRole('button', { name: 'Pedir la huella al abrir' }).click();

    await expect(page.getByText('Este teléfono tiene el bloqueo con huella')).toBeVisible();
    expect(verificados()).toBe(1);
    expect(await credencialesDelTelefono(telefono)).toBe(1);
    expect(await marcaDeBloqueo(page)).toMatchObject({ credencial: null });
    await expect(ajustes(page)).toBeVisible();

    await aSegundoPlano(page);
    await page.clock.fastForward(MAS_QUE_UNA_RECARGA);
    await page.reload();
    await expect(ajustes(page)).toBeVisible(CARGA_DEL_TALLER);
    expect(await pedidosDeHuella(page)).toBe(1);

    await page.getByRole('button', { name: 'Dejar de pedir la huella' }).click();
    expect(await marcaDeBloqueo(page)).toBeNull();
  });
});

test.describe('la oferta después de entrar con la contraseña, en el celular', () => {
  test.use({ storageState: { cookies: [], origins: [] } });
  test.skip(({ isMobile }) => !isMobile, 'la oferta es solo del celular');

  test('pregunta una vez si quiere entrar con la huella, y si acepta queda activada', async ({
    page,
  }) => {
    const telefono = await telefonoConHuella(page);
    const verificados = await simularRegistroEnSupabase(page);
    const entorno = entornoDePrueba();

    await page.goto('/acceso');
    await page.getByLabel('Email').fill(entorno.email);
    await page.getByLabel('Contraseña', { exact: true }).fill(entorno.password);
    await page.getByRole('button', { name: 'Entrar', exact: true }).click();

    const oferta = page.getByRole('dialog', {
      name: '¿Querés entrar con la huella la próxima vez?',
    });
    await expect(oferta).toBeVisible(CARGA_DEL_TALLER);
    await oferta.getByRole('button', { name: 'Sí, usar la huella' }).click();

    await expect(oferta).toBeHidden();
    expect(verificados()).toBe(1);
    expect(await credencialesDelTelefono(telefono)).toBe(1);
    expect(await marcaDeBloqueo(page)).toMatchObject({ credencial: null });

    await page.reload();
    await expect(page.getByRole('heading', { level: 1, name: 'Inicio' })).toBeVisible(
      CARGA_DEL_TALLER,
    );
    await expect(oferta).toHaveCount(0);
  });
});

test.describe('en escritorio', () => {
  test.skip(({ isMobile }) => isMobile, 'esto es de la PC');

  test('no hay bloqueo aunque este navegador tenga la marca', async ({ page }) => {
    await contarPedidosDeHuella(page);
    await page.goto('/ajustes');
    await expect(ajustes(page)).toBeVisible(CARGA_DEL_TALLER);
    await activarBloqueoEnElDispositivo(page);

    await page.reload();

    await expect(ajustes(page)).toBeVisible(CARGA_DEL_TALLER);
    await expect(pantallaDeBloqueo(page)).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Entrar con la huella' })).toHaveCount(0);
    expect(await pedidosDeHuella(page)).toBe(0);
  });

  test('al cerrar sesión se borra la marca de bloqueo, como todo lo demás', async ({ page }) => {
    await page.route('**/auth/v1/logout**', (ruta) => ruta.fulfill({ status: 204 }));
    await page.goto('/ajustes');
    await expect(ajustes(page)).toBeVisible(CARGA_DEL_TALLER);
    await activarBloqueoEnElDispositivo(page);
    expect(await marcaDeBloqueo(page)).not.toBeNull();

    await page.getByRole('button', { name: 'Cerrar sesión' }).click();

    await expect(page).toHaveURL(/\/acceso$/, CARGA_DEL_TALLER);
    expect(await marcaDeBloqueo(page)).toBeNull();
  });
});
