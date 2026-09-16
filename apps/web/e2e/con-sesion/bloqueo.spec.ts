import { expect, test, type Page } from '@playwright/test';

import { entornoDePrueba } from '../apoyo/entorno';
import { indicadorDeSync, listoParaCortar } from '../apoyo/pantalla';
import { contarClientes, iniciarSesionDePrueba, vaciarTaller } from '../apoyo/taller';
import {
  activarBloqueoEnElDispositivo,
  alFrente,
  aSegundoPlano,
  bajadasDelBloqueo,
  CLAVE_DEL_BLOQUEO,
  contarPedidosDeHuella,
  credencialesDelTelefono,
  disenosDelBloqueo,
  huellaQueVerifica,
  marcaDeBloqueo,
  pedidosCondicionales,
  pedidosDeHuella,
  presenciaAutomatica,
  registrarHuellaEnElTelefono,
  registrarLaPantallaDeBloqueo,
  registrarRutas,
  rutasVistas,
  sesionVencidaConRefrescoControlado,
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

type AlcanceDelServiceWorker = typeof globalThis & {
  clients: {
    matchAll: (
      opciones: object,
    ) => Promise<
      { url: string; postMessage: (mensaje: unknown, transferir: Transferable[]) => void }[]
    >;
  };
};

async function serviceWorkerDeLaApp(page: Page) {
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => undefined));
  const origen = new URL(page.url()).origin;
  const trabajador = page
    .context()
    .serviceWorkers()
    .find((sw) => sw.url().startsWith(origen));
  if (trabajador === undefined) throw new Error('la app no tiene service worker');
  return trabajador;
}

async function tocarUnAviso(ruta: string): Promise<number> {
  const alcance = self as unknown as AlcanceDelServiceWorker;
  const ventanas = await alcance.clients.matchAll({ type: 'window', includeUncontrolled: true });
  const respuestas = await Promise.all(
    ventanas.map(
      (ventana) =>
        new Promise<boolean>((resolver) => {
          const canal = new MessageChannel();
          const reloj = setTimeout(() => {
            resolver(false);
          }, 2000);
          canal.port1.onmessage = () => {
            clearTimeout(reloj);
            resolver(true);
          };
          ventana.postMessage(
            {
              type: 'MAUN_VUELTA_POR_UN_AVISO',
              url: new URL(ruta, alcance.location.origin).href,
            },
            [canal.port2],
          );
        }),
    ),
  );
  return respuestas.filter(Boolean).length;
}

async function ventanasAbiertas(): Promise<number> {
  const alcance = self as unknown as AlcanceDelServiceWorker;
  return (await alcance.clients.matchAll({ type: 'window', includeUncontrolled: true })).length;
}

type ConValidaciones = typeof globalThis & { validacionesDeLaSesion: number };

async function retenerLaValidacionDeLaSesion(page: Page): Promise<() => void> {
  let soltar: () => void = () => undefined;
  const retenida = new Promise<void>((resolver) => {
    soltar = resolver;
  });
  await page.route('**/auth/v1/.well-known/jwks.json', async (ruta) => {
    await retenida;
    await ruta.continue().catch(() => undefined);
  });
  await page.addInitScript(() => {
    const alcance = globalThis as ConValidaciones;
    const subtle = crypto.subtle;
    const verificar = subtle.verify.bind(subtle);
    alcance.validacionesDeLaSesion = 0;
    subtle.verify = (...argumentos) =>
      verificar(...argumentos).finally(() => {
        alcance.validacionesDeLaSesion += 1;
      });
  });
  return soltar;
}

async function validacionesDeLaSesion(page: Page): Promise<number> {
  return page.evaluate(() => (globalThis as ConValidaciones).validacionesDeLaSesion);
}

async function dejarQueLaPantallaReaccione(page: Page): Promise<void> {
  await page.evaluate(
    () =>
      new Promise<void>((listo) => {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            setTimeout(listo, 0);
          });
        });
      }),
  );
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

  test('«Entrar con otra cuenta» con la cola vacía cierra la sesión y lleva al acceso, aunque la validación de la sesión conteste después del cierre', async ({
    page,
  }) => {
    const soltarLaValidacion = await retenerLaValidacionDeLaSesion(page);
    await page.route('**/auth/v1/logout**', (ruta) => ruta.fulfill({ status: 204 }));
    await bloquearYReabrir(page, false);
    await expect(page.getByLabel('Contraseña', { exact: true })).toBeVisible(CARGA_DEL_TALLER);
    expect(await validacionesDeLaSesion(page)).toBe(0);

    await page.getByRole('button', { name: 'Entrar con otra cuenta' }).click();
    await expect(page).toHaveURL(/\/acceso$/, CARGA_DEL_TALLER);

    soltarLaValidacion();
    await expect.poll(() => validacionesDeLaSesion(page), CARGA_DEL_TALLER).toBe(1);
    await dejarQueLaPantallaReaccione(page);

    await expect(page).toHaveURL(/\/acceso$/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Entrá al taller');
    await expect(page.getByText('No pudimos leer tus datos')).toHaveCount(0);
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

  test('una ceremonia colgada no hace titilar la pantalla: tocar la huella la reemplaza en silencio y se puede reintentar', async ({
    page,
  }) => {
    await registrarLaPantallaDeBloqueo(page);
    await contarPedidosDeHuella(page);
    const telefono = await telefonoConHuella(page, true);
    await page.goto('/ajustes');
    await expect(ajustes(page)).toBeVisible(CARGA_DEL_TALLER);
    await registrarHuellaEnElTelefono(telefono, await usuarioDeLaSesion(page));
    await activarBloqueoEnElDispositivo(page);
    await presenciaAutomatica(telefono, false);
    await page.reload();

    await expect(pantallaDeBloqueo(page)).toBeVisible(CARGA_DEL_TALLER);
    await expect.poll(() => pedidosDeHuella(page)).toBe(1);

    await page.getByRole('button', { name: 'Usar la huella' }).click();
    await expect.poll(() => pedidosDeHuella(page)).toBe(2);
    await page.waitForTimeout(1500);
    console.log(
      `colgada y reemplazada: diseños ${JSON.stringify(await disenosDelBloqueo(page))}, bajadas ${JSON.stringify(await bajadasDelBloqueo(page))}`,
    );
    expect(await disenosDelBloqueo(page)).toEqual(['huella']);
    expect((await bajadasDelBloqueo(page)).join(' ')).not.toMatch(/no se confirmó/);

    await presenciaAutomatica(telefono, true);
    await page.getByRole('button', { name: 'Usar la huella' }).click();
    await expect(ajustes(page)).toBeVisible(CARGA_DEL_TALLER);
    expect((await bajadasDelBloqueo(page)).join(' ')).not.toMatch(/no se confirmó/);
  });

  test('si otra ceremonia ocupa el sensor, reintentar no titila entre la huella y la contraseña, y cuando se libera entra', async ({
    page,
  }) => {
    await registrarLaPantallaDeBloqueo(page);
    const telefono = await bloquearYReabrir(page, false);
    await expect(page.getByLabel('Contraseña', { exact: true })).toBeVisible(CARGA_DEL_TALLER);

    await presenciaAutomatica(telefono, false);
    await page.evaluate(() => {
      const control = new AbortController();
      (window as unknown as { ocupada: AbortController }).ocupada = control;
      void navigator.credentials
        .get({
          publicKey: {
            challenge: crypto.getRandomValues(new Uint8Array(32)),
            userVerification: 'required',
            timeout: 120_000,
          },
          signal: control.signal,
        })
        .catch(() => undefined);
    });

    await huellaQueVerifica(telefono, true);
    for (let toque = 0; toque < 3; toque += 1) {
      await page.getByRole('button', { name: /Probar con la huella|Esperando la huella/ }).click();
      await page.waitForTimeout(700);
    }
    console.log(
      `sensor ocupado: diseños ${JSON.stringify(await disenosDelBloqueo(page))}, bajadas ${JSON.stringify(await bajadasDelBloqueo(page))}`,
    );
    expect(await disenosDelBloqueo(page)).toEqual(['huella', 'formulario']);
    await expect(page.getByLabel('Contraseña', { exact: true })).toBeVisible();

    await page.evaluate(() => {
      (window as unknown as { ocupada: AbortController }).ocupada.abort();
    });
    await presenciaAutomatica(telefono, true);
    await page.getByRole('button', { name: /Probar con la huella|Esperando la huella/ }).click();
    await expect(ajustes(page)).toBeVisible(CARGA_DEL_TALLER);
  });

  test('con la sesión vencida y mala señal el acceso no se monta antes del bloqueo: ninguna mediación condicional compite con la huella', async ({
    page,
  }) => {
    await contarPedidosDeHuella(page);
    await registrarRutas(page);
    await page.addInitScript(() => {
      PublicKeyCredential.isConditionalMediationAvailable = () => Promise.resolve(true);
    });
    await page.route('**/auth/v1/passkeys/authentication/options', (ruta) =>
      ruta.fulfill({
        json: {
          challenge_id: 'desafio-e2e',
          expires_at: Math.floor(Date.now() / 1000) + 300,
          options: {
            challenge: 'ZGVzYWZpby1kZS1wcnVlYmEtZTJlLTAxMjM0NTY3',
            rpId: 'localhost',
            allowCredentials: [],
            userVerification: 'preferred',
            timeout: 300000,
          },
        },
      }),
    );
    const telefono = await telefonoConHuella(page, false);
    await page.goto('/ajustes');
    await expect(ajustes(page)).toBeVisible(CARGA_DEL_TALLER);
    await registrarHuellaEnElTelefono(telefono, await usuarioDeLaSesion(page));
    await activarBloqueoEnElDispositivo(page);
    const refresco = await sesionVencidaConRefrescoControlado(page);

    await page.reload();
    await expect(pantallaDeBloqueo(page)).toBeVisible(CARGA_DEL_TALLER);
    await expect(page.getByLabel('Contraseña', { exact: true })).toBeVisible(CARGA_DEL_TALLER);
    console.log(
      `sesión vencida al abrir: rutas ${JSON.stringify(await rutasVistas(page))}, condicionales ${String(await pedidosCondicionales(page))}, huellas ${String(await pedidosDeHuella(page))}`,
    );
    expect(await rutasVistas(page)).not.toContain('/acceso');
    expect(await pedidosCondicionales(page)).toBe(0);
    expect(await pedidosDeHuella(page)).toBe(1);

    refresco.devolverLaSesion();
    await huellaQueVerifica(telefono, true);
    await page.getByRole('button', { name: 'Probar con la huella' }).click();
    await expect(ajustes(page)).toBeVisible(CARGA_DEL_TALLER);
    expect(await pedidosCondicionales(page)).toBe(0);
  });

  test('si al desbloquear la sesión ya no sirve, va al acceso con un mensaje y no vuelve a pedir la huella', async ({
    page,
  }) => {
    const telefono = await telefonoConHuella(page, false);
    await page.goto('/ajustes');
    await expect(ajustes(page)).toBeVisible(CARGA_DEL_TALLER);
    await registrarHuellaEnElTelefono(telefono, await usuarioDeLaSesion(page));
    await activarBloqueoEnElDispositivo(page);
    const refresco = await sesionVencidaConRefrescoControlado(page);

    await page.reload();
    await expect(page.getByLabel('Contraseña', { exact: true })).toBeVisible(CARGA_DEL_TALLER);
    refresco.rechazar();
    await huellaQueVerifica(telefono, true);
    await page.getByRole('button', { name: 'Probar con la huella' }).click();
    await expect(ajustes(page)).toBeVisible(CARGA_DEL_TALLER);
    await page.getByRole('button', { name: 'Sincronizar ahora' }).click();

    await expect(page).toHaveURL(/\/acceso$/, CARGA_DEL_TALLER);
    const aviso = page.getByRole('alert').filter({ hasText: 'se cerró' });
    await expect(aviso).toBeVisible();
    console.log(`sesión que ya no sirve: ${await aviso.innerText()}`);
    expect(await marcaDeBloqueo(page)).toBeNull();

    await page.reload();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Entrá al taller');
    await expect(pantallaDeBloqueo(page)).toHaveCount(0);
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

  test('tocar un aviso con la app abierta atrás la trae a la agenda sin pedir la huella, y la vuelta siguiente la pide', async ({
    page,
    context,
  }) => {
    await visibilidadControlable(page);
    const telefono = await bloquearYReabrir(page, true);
    await expect(ajustes(page)).toBeVisible(CARGA_DEL_TALLER);
    expect(await pedidosDeHuella(page)).toBe(1);
    const trabajador = await serviceWorkerDeLaApp(page);
    await huellaQueVerifica(telefono, false);

    await aSegundoPlano(page);
    expect(await trabajador.evaluate(tocarUnAviso, '/agenda')).toBe(1);
    await alFrente(page);

    await expect(page.getByRole('heading', { level: 1, name: 'Agenda' })).toBeVisible();
    await expect(pantallaDeBloqueo(page)).toHaveCount(0);
    expect(await pedidosDeHuella(page)).toBe(1);
    await expect(page.getByRole('dialog', { name: 'La app está bloqueada' })).toHaveCount(0);

    await aSegundoPlano(page);
    await alFrente(page);
    await expect(pantallaDeBloqueo(page)).toBeVisible();
    expect(await pedidosDeHuella(page)).toBe(2);
    expect(context.pages()).toHaveLength(1);
  });

  test('tocar un aviso con la app cerrada abre la agenda y pide la huella', async ({
    page,
    context,
  }) => {
    await visibilidadControlable(page);
    await bloquearYReabrir(page, true);
    await expect(ajustes(page)).toBeVisible(CARGA_DEL_TALLER);
    const trabajador = await serviceWorkerDeLaApp(page);
    await aSegundoPlano(page);
    await page.close();
    expect(await trabajador.evaluate(ventanasAbiertas)).toBe(0);

    const abierta = await context.newPage();
    await contarPedidosDeHuella(abierta);
    await abierta.goto('/agenda');
    await expect(pantallaDeBloqueo(abierta)).toBeVisible(CARGA_DEL_TALLER);
    await expect(abierta.getByRole('navigation', { name: 'Principal' })).toHaveCount(0);
    expect(await pedidosDeHuella(abierta)).toBe(1);
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
