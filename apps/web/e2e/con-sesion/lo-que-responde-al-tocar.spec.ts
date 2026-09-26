import { expect, test, type Locator, type Page, type TestInfo } from '@playwright/test';

import {
  ajustarCobroDelTaller,
  crearAnotacionPorRest,
  crearCliente,
  diaHabilDesdeHoy,
  encuestaPorRest,
  guardarProyectoPorRpc,
  hoyEnElTaller,
  iniciarSesionDePrueba,
  necesidadesDe,
  proponerPorRpc,
  trabajoListoConEnlace,
  vaciarTaller,
  type SesionDePrueba,
} from '../apoyo/taller';
import { abrirComparador, comparar } from '../transiciones/capturas';

const CARGA = { timeout: 30_000 };
const TOLERANCIA = 0.005;

let sesion: SesionDePrueba;

test.beforeEach(async () => {
  sesion = await iniciarSesionDePrueba();
  await vaciarTaller(sesion);
});

test.afterEach(async () => {
  await ajustarCobroDelTaller(sesion, { alias: '', cbu: '', titular: '', cuit: '' });
});

interface Animacion {
  tipo: string;
  nombre: string;
  duracion: number;
  retraso: number;
  donde: string;
}

async function animaciones(page: Page): Promise<Animacion[]> {
  return page.evaluate(() =>
    document.getAnimations().map((animacion) => {
      const efecto = animacion.effect;
      const objetivo = efecto instanceof KeyframeEffect ? efecto.target : null;
      const timing = efecto?.getComputedTiming();
      return {
        tipo: animacion.constructor.name,
        nombre:
          animacion instanceof CSSAnimation
            ? animacion.animationName
            : animacion instanceof CSSTransition
              ? animacion.transitionProperty
              : '',
        duracion: Number(timing?.duration ?? 0),
        retraso: efecto?.getTiming().delay ?? 0,
        donde:
          objetivo instanceof Element
            ? `${objetivo.tagName.toLowerCase()}.${(objetivo.getAttribute('class') ?? '').slice(0, 60)}`
            : '',
      };
    }),
  );
}

async function tildarYVer(casilla: Locator): Promise<string[]> {
  return casilla.evaluate(async (control: HTMLElement) => {
    const renglon = control.closest('li');
    if (renglon === null) throw new Error('la casilla no está en un renglón');
    control.click();
    for (let cuadro = 0; cuadro < 90; cuadro += 1) {
      if (renglon.isConnected && renglon.querySelector('svg.tilde[data-dibujar]') !== null) break;
      const otro = document.querySelector('svg.tilde[data-dibujar]')?.closest('li');
      if (otro) break;
      await new Promise(requestAnimationFrame);
    }
    const donde = document.querySelector('svg.tilde[data-dibujar]')?.closest('li') ?? renglon;
    return donde
      .getAnimations({ subtree: true })
      .map((animacion) => (animacion instanceof CSSAnimation ? animacion.animationName : ''))
      .filter((nombre) => nombre !== '');
  });
}

async function hastaQueQuede(page: Page): Promise<void> {
  await expect
    .poll(
      async () =>
        (await animaciones(page)).filter((animacion) => animacion.duracion !== Infinity).length,
      CARGA,
    )
    .toBe(0);
  await page.evaluate(
    () => new Promise((listo) => requestAnimationFrame(() => requestAnimationFrame(listo))),
  );
}

async function igualA(
  page: Page,
  nombre: string,
  una: Buffer,
  otra: Buffer,
  testInfo: TestInfo,
): Promise<void> {
  const comparador = await abrirComparador(page.context());
  const { proporcion } = await comparar(comparador, una, otra);
  await comparador.close();
  await testInfo.attach(`${nombre}-al-terminar.png`, { body: una, contentType: 'image/png' });
  await testInfo.attach(`${nombre}-quieta.png`, { body: otra, contentType: 'image/png' });
  console.log(`${testInfo.project.name}, ${nombre}: ${(proporcion * 100).toFixed(2)} % distinto`);
  expect(proporcion, `${nombre}: al terminar no es la pantalla quieta`).toBeLessThanOrEqual(
    TOLERANCIA,
  );
}

async function arbol(donde: Locator, paso: string, testInfo: TestInfo): Promise<void> {
  console.log(`\n=== ${testInfo.project.name}, ${paso} ===\n${await donde.ariaSnapshot()}`);
}

async function cualTieneElFoco(page: Page): Promise<string> {
  return page.evaluate(() => {
    const activo = document.activeElement;
    if (!(activo instanceof HTMLElement)) return '';
    const rol = activo.getAttribute('role') ?? activo.tagName.toLowerCase();
    const nombre = activo.getAttribute('aria-label') ?? activo.textContent.trim();
    return `${rol} «${nombre}»`;
  });
}

function barra(page: Page): Locator {
  return page.getByRole('navigation', { name: 'Principal' });
}

test('el apretón hunde el control mientras el dedo está encima y al soltar vuelve sin transición', async ({
  page,
}, testInfo) => {
  await page.goto('/agenda/anotar');
  const hoja = page.getByRole('dialog', { name: 'Anotar algo' });
  await expect(hoja).toBeVisible(CARGA);
  const chip = hoja.getByRole('button', { name: 'Hoy', exact: true });
  await expect(chip).toHaveAttribute('aria-pressed', 'true');
  await hastaQueQuede(page);
  const antes = await chip.screenshot();

  const caja = await chip.boundingBox();
  if (caja === null) throw new Error('el chip no tiene caja');
  await page.mouse.move(caja.x + caja.width / 2, caja.y + caja.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(300);
  expect(await chip.evaluate((elemento) => getComputedStyle(elemento).scale)).toBe('0.97');

  await page.mouse.up();
  const alSoltar = await chip.evaluate((elemento) => ({
    escala: getComputedStyle(elemento).scale,
    transiciones: elemento
      .getAnimations()
      .filter((animacion): animacion is CSSTransition => animacion instanceof CSSTransition)
      .map((animacion) => animacion.transitionProperty),
  }));
  expect(alSoltar.escala).toBe('none');
  expect(alSoltar.transiciones).not.toContain('scale');
  await page.mouse.move(0, 0);
  await hastaQueQuede(page);
  await igualA(page, 'apreton', await chip.screenshot(), antes, testInfo);

  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.mouse.move(caja.x + caja.width / 2, caja.y + caja.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(150);
  expect(await chip.evaluate((elemento) => getComputedStyle(elemento).scale)).toBe('none');
  await page.mouse.up();
});

test('el interruptor viaja estirándose, termina donde lo deja un toque sin movimiento y se usa con el teclado', async ({
  page,
}, testInfo) => {
  await page.goto('/opiniones/preguntas');
  await page.getByRole('button', { name: 'Agregar una pregunta' }).click(CARGA);
  const interruptor = page.getByRole('switch', { name: /Que tenga que contestarla/ });
  await expect(interruptor).toBeVisible(CARGA);
  await hastaQueQuede(page);
  const alPrincipio = await interruptor.getAttribute('aria-checked');

  const viaje = await interruptor.evaluate(async (boton: HTMLElement) => {
    const perilla = boton.querySelector<HTMLElement>('.perilla');
    if (perilla === null) throw new Error('sin perilla');
    const anchos: number[] = [];
    boton.click();
    const desde = performance.now();
    await new Promise<void>((listo) => {
      const paso = () => {
        anchos.push(perilla.getBoundingClientRect().width);
        if (performance.now() - desde < 450) requestAnimationFrame(paso);
        else listo();
      };
      requestAnimationFrame(paso);
    });
    return { quieta: anchos.at(-1) ?? 0, mayor: Math.max(...anchos) };
  });
  console.log(
    `${testInfo.project.name}, la perilla: ${viaje.quieta.toFixed(1)} px quieta, ${viaje.mayor.toFixed(1)} px estirada`,
  );
  expect(viaje.mayor).toBeGreaterThan(viaje.quieta * 1.2);
  expect(await interruptor.getAttribute('aria-checked')).not.toBe(alPrincipio);
  await hastaQueQuede(page);
  const alTerminar = await interruptor.screenshot();

  await page.emulateMedia({ reducedMotion: 'reduce' });
  await interruptor.click();
  await interruptor.click();
  await hastaQueQuede(page);
  await igualA(page, 'interruptor', alTerminar, await interruptor.screenshot(), testInfo);
  await page.emulateMedia({ reducedMotion: 'no-preference' });

  await interruptor.focus();
  await arbol(interruptor, 'el interruptor con el foco', testInfo);
  const antesDeLaTecla = await interruptor.getAttribute('aria-checked');
  await page.keyboard.press('Space');
  await expect(interruptor).not.toHaveAttribute('aria-checked', antesDeLaTecla ?? '');
  await expect(interruptor).toBeFocused();
  await arbol(interruptor, 'el interruptor después de la barra espaciadora', testInfo);
  await page.keyboard.press('Enter');
  await expect(interruptor).toHaveAttribute('aria-checked', antesDeLaTecla ?? '');
  await arbol(interruptor, 'el interruptor después de Enter', testInfo);
});

test('el fondo del segmentado viaja estirándose y termina debajo del elegido, con el marcado y el teclado de siempre', async ({
  page,
}, testInfo) => {
  await crearCliente(sesion, 'E2E Ana Gutiérrez');
  await page.goto('/clientes');
  const grupo = page.getByRole('radiogroup', { name: 'Ordenar por' });
  await expect(grupo).toBeVisible(CARGA);
  await hastaQueQuede(page);

  const debajo = async () =>
    grupo.evaluate((pista) => {
      const fondo = pista.querySelector('[data-fondo-del-elegido]');
      const elegido = pista.querySelector('[aria-checked="true"]');
      if (fondo === null || elegido === null) return null;
      const a = fondo.getBoundingClientRect();
      const b = elegido.getBoundingClientRect();
      return Math.max(
        Math.abs(a.left - b.left),
        Math.abs(a.right - b.right),
        Math.abs(a.top - b.top),
        Math.abs(a.bottom - b.bottom),
      );
    });
  expect(await debajo()).toBeLessThanOrEqual(1);

  const opciones = await grupo.getByRole('radio').allTextContents();
  const ultima = (opciones.at(-1) ?? '').trim();
  const primera = (opciones[0] ?? '').trim();
  const viaje = await grupo.evaluate(async (pista, nombre) => {
    const fondo = pista.querySelector('[data-fondo-del-elegido]');
    const destino = [...pista.querySelectorAll('button')].find(
      (boton) => boton.textContent.trim() === nombre,
    );
    if (fondo === null || destino === undefined) throw new Error('sin fondo o sin destino');
    const anchos: number[] = [];
    destino.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    destino.click();
    const desde = performance.now();
    await new Promise<void>((listo) => {
      const paso = () => {
        anchos.push(fondo.getBoundingClientRect().width);
        if (performance.now() - desde < 500) requestAnimationFrame(paso);
        else listo();
      };
      requestAnimationFrame(paso);
    });
    return { final: anchos.at(-1) ?? 0, mayor: Math.max(...anchos) };
  }, ultima);
  console.log(
    `${testInfo.project.name}, el fondo: ${viaje.final.toFixed(1)} px al final, ${viaje.mayor.toFixed(1)} px estirado`,
  );
  expect(viaje.mayor).toBeGreaterThan(viaje.final * 1.3);
  await hastaQueQuede(page);
  expect(await debajo()).toBeLessThanOrEqual(1);
  const alTerminar = await grupo.screenshot();

  await page.emulateMedia({ reducedMotion: 'reduce' });
  await grupo.getByRole('radio', { name: primera }).click();
  await grupo.getByRole('radio', { name: ultima }).click();
  await hastaQueQuede(page);
  await igualA(page, 'segmentado', alTerminar, await grupo.screenshot(), testInfo);
  await page.emulateMedia({ reducedMotion: 'no-preference' });

  await grupo.getByRole('radio', { name: primera }).focus();
  await arbol(grupo, 'el segmentado con el foco en la primera', testInfo);
  await page.keyboard.press('Tab');
  console.log(`${testInfo.project.name}, Tab lleva a: ${await cualTieneElFoco(page)}`);
  await page.keyboard.press('Space');
  await arbol(grupo, 'el segmentado después de la barra espaciadora', testInfo);
  await hastaQueQuede(page);
  expect(await debajo()).toBeLessThanOrEqual(1);
});

test('el menú del más crece desde el botón con las acciones escalonadas, sale hacia él y al elegir se va en el acto', async ({
  page,
  isMobile,
}, testInfo) => {
  await page.goto('/clientes');
  await expect(page.getByRole('main')).toBeVisible(CARGA);
  const mas = barra(page).getByRole('button', { name: 'Cargar algo nuevo' });
  await expect(mas).toBeVisible(CARGA);
  await page.mouse.move(0, 0);
  await hastaQueQuede(page);
  const antes = await page.screenshot();

  const alAbrir = await mas.evaluate(async (boton: HTMLElement) => {
    boton.click();
    await Promise.resolve();
    await Promise.resolve();
    const menu = document.querySelector('[role="menu"]');
    if (menu === null) throw new Error('no se abrió el menú');
    const propias = menu
      .getAnimations()
      .map((animacion) => (animacion as CSSTransition).transitionProperty);
    const escalones = [...menu.querySelectorAll('[role="menuitem"]')].map((accion) =>
      accion
        .getAnimations()
        .filter((animacion) => (animacion as CSSTransition).transitionProperty === 'opacity')
        .map((animacion) => animacion.effect?.getTiming().delay ?? 0),
    );
    return { propias, escalones, origen: getComputedStyle(menu).transformOrigin };
  });
  console.log(`${testInfo.project.name}, al abrir: ${JSON.stringify(alAbrir)}`);
  expect(alAbrir.propias).toEqual(expect.arrayContaining(['scale', 'opacity']));
  expect(alAbrir.escalones.map((retrasos) => retrasos[0])).toEqual(
    alAbrir.escalones.map((_, indice) => indice * 22),
  );
  const menu = page.getByRole('menu', { name: 'Cargar algo nuevo' });
  await hastaQueQuede(page);
  await arbol(menu, 'el menú abierto', testInfo);
  const abiertoAlTerminar = await page.screenshot();

  const alCerrar = await page.evaluate(async () => {
    const fondo = document.querySelector('button[aria-label="Cerrar el menú"]');
    if (!(fondo instanceof HTMLElement)) throw new Error('sin el fondo del menú');
    fondo.click();
    await Promise.resolve();
    await Promise.resolve();
    const saliendo = document.querySelector('[role="menu"]');
    return {
      montado: saliendo !== null,
      inerte: saliendo?.hasAttribute('inert') ?? false,
      fondoSinToques: getComputedStyle(fondo).pointerEvents === 'none',
    };
  });
  expect(alCerrar).toEqual({ montado: true, inerte: true, fondoSinToques: true });
  await expect(menu).toHaveCount(0);
  await page.mouse.move(0, 0);
  await hastaQueQuede(page);
  await igualA(page, 'menu-cerrado', await page.screenshot(), antes, testInfo);

  await page.emulateMedia({ reducedMotion: 'reduce' });
  await mas.click();
  await page.mouse.move(0, 0);
  await hastaQueQuede(page);
  await igualA(page, 'menu-abierto', abiertoAlTerminar, await page.screenshot(), testInfo);
  await page.keyboard.press('Escape');
  await expect(menu).toHaveCount(0);
  await page.emulateMedia({ reducedMotion: 'no-preference' });

  await mas.focus();
  await page.keyboard.press('Enter');
  await expect(menu).toBeVisible();
  await arbol(barra(page), 'el más con Enter', testInfo);
  await page.keyboard.press('Tab');
  console.log(`${testInfo.project.name}, Tab desde el más lleva a: ${await cualTieneElFoco(page)}`);
  await page.keyboard.press('Escape');
  await expect(menu).toHaveCount(0);
  await expect(mas).toHaveAttribute('aria-expanded', 'false');

  await mas.click();
  await hastaQueQuede(page);
  const alElegir = await page.evaluate(async () => {
    const accion = [...document.querySelectorAll('[role="menuitem"]')].find((opcion) =>
      opcion.textContent.includes('Movimiento'),
    );
    if (!(accion instanceof HTMLElement)) throw new Error('sin la acción');
    const boton = document.querySelector('button[aria-label="Cargar algo nuevo"]');
    accion.click();
    await Promise.resolve();
    await Promise.resolve();
    return {
      menus: document.querySelectorAll('[role="menu"]').length,
      fondos: document.querySelectorAll('button[aria-label="Cerrar el menú"]').length,
      giro: boton instanceof HTMLElement ? getComputedStyle(boton).rotate : null,
      giroQueSeMueve:
        boton instanceof HTMLElement
          ? boton
              .getAnimations()
              .some((animacion) => (animacion as CSSTransition).transitionProperty === 'rotate')
          : false,
    };
  });
  expect(alElegir.menus).toBe(0);
  expect(alElegir.fondos).toBe(0);
  if (isMobile) {
    expect(alElegir.giro).toBe('0deg');
    expect(alElegir.giroQueSeMueve).toBe(false);
  }
  await expect(page.getByRole('dialog', { name: 'Cargar un movimiento' })).toBeVisible(CARGA);
});

test('lo que hace falta: la tilde se dibuja y la línea corre, y al terminar es lo mismo que recién abierta', async ({
  page,
}, testInfo) => {
  const clienteId = await crearCliente(sesion, 'E2E Cliente de la mesa');
  const id = crypto.randomUUID();
  const necesidadId = crypto.randomUUID();
  await guardarProyectoPorRpc(sesion, {
    proyecto: {
      id,
      version: null,
      cliente_id: clienteId,
      titulo: 'E2E Mesa de roble',
      estado: 'a_presupuestar',
      presupuesto_centavos: null,
      comprobante: 'sin_comprobante',
    },
    pagos: [],
    gastos: [],
    necesidades: [
      {
        id: necesidadId,
        tipo: 'herraje',
        nombre: 'Tornillos para aglomerado de 4 x 40 mm, cabeza fresada, caja de doscientos',
        cantidad: 2,
        listo: false,
      },
    ],
  });
  await page.goto(`/proyectos/${id}`);
  await expect(page.getByRole('heading', { level: 1, name: 'E2E Mesa de roble' })).toBeVisible(
    CARGA,
  );
  const bloque = page
    .locator('details')
    .filter({ has: page.getByRole('heading', { name: 'Lo que hace falta' }) })
    .first();
  if ((await bloque.getAttribute('open')) === null) await bloque.locator('summary').click();
  const fila = bloque.locator(`[data-necesidad="${necesidadId}"]`);
  const casilla = fila.getByRole('checkbox');
  await expect(casilla).toBeVisible(CARGA);
  await hastaQueQuede(page);

  const alTildar = await tildarYVer(casilla);
  console.log(`${testInfo.project.name}, al tildar: ${JSON.stringify(alTildar)}`);
  expect(alTildar).toEqual(expect.arrayContaining(['maun-trazo', 'maun-tachado']));
  await expect(casilla).toBeChecked(CARGA);
  await expect
    .poll(
      async () =>
        (await necesidadesDe(sesion, id)).find((necesidad) => necesidad.id === necesidadId)?.listo,
      CARGA,
    )
    .toBe(true);
  await page.mouse.move(0, 0);
  await hastaQueQuede(page);
  const alTerminar = await fila.screenshot();

  await page.reload();
  await expect(fila).toBeVisible(CARGA);
  if ((await bloque.getAttribute('open')) === null) await bloque.locator('summary').click();
  await expect(fila.getByRole('checkbox')).toBeChecked(CARGA);
  await page.mouse.move(0, 0);
  await hastaQueQuede(page);
  expect(await fila.locator('svg.tilde').getAttribute('data-dibujar')).toBeNull();
  await igualA(page, 'lo-que-hace-falta', alTerminar, await fila.screenshot(), testInfo);

  await fila.getByRole('checkbox').click();
  await expect(fila.getByRole('checkbox')).not.toBeChecked();
  expect(await fila.locator('svg.tilde').count()).toBe(0);
  expect(await fila.locator('.tachado-que-corre').count()).toBe(0);
});

test('la agenda: lo tildado dibuja su tilde y se tacha, y al terminar es lo mismo que recién abierta', async ({
  page,
  isMobile,
}, testInfo) => {
  test.skip(!isMobile, 'en el celular la lista del día tiene las casillas a la vista');
  const texto = 'E2E Lijar la puerta del placard y dejarla lista para el laqueado';
  await crearAnotacionPorRest(sesion, { fecha: hoyEnElTaller(), texto, categoria: 'taller' });
  await page.goto('/agenda');
  const casilla = page.getByRole('checkbox', { name: texto });
  await expect(casilla).toBeVisible(CARGA);
  await hastaQueQuede(page);

  const alTildar = await tildarYVer(casilla);
  console.log(`${testInfo.project.name}, al tildar en la agenda: ${JSON.stringify(alTildar)}`);
  expect(alTildar).toEqual(expect.arrayContaining(['maun-trazo', 'maun-tachado']));
  await expect(casilla).toHaveAttribute('aria-checked', 'true');
  await expect(casilla).toBeFocused();
  await page.mouse.move(0, 0);
  await hastaQueQuede(page);
  const renglon = page.locator('li').filter({ has: casilla });
  await casilla.blur();
  const alTerminar = await renglon.screenshot();

  await page.reload();
  await expect(casilla).toHaveAttribute('aria-checked', 'true', CARGA);
  await page.mouse.move(0, 0);
  await hastaQueQuede(page);
  await igualA(page, 'agenda', alTerminar, await renglon.screenshot(), testInfo);
});

test('los avisos entran desde abajo y se van con un fundido, y el que se va queda inerte hasta irse', async ({
  page,
}, testInfo) => {
  await page.goto('/clientes');
  await page.getByRole('button', { name: 'Cargá tu primer cliente' }).click(CARGA);
  await page.getByLabel('Nombre', { exact: true }).fill('E2E Marcela Duarte');
  await page.evaluate(() => {
    const vistas: string[][] = [];
    (window as unknown as { entradasDeAvisos: string[][] }).entradasDeAvisos = vistas;
    new MutationObserver((cambios) => {
      for (const cambio of cambios) {
        for (const nodo of cambio.addedNodes) {
          if (nodo instanceof HTMLElement && nodo.classList.contains('aviso-en-pantalla')) {
            vistas.push(
              nodo
                .getAnimations()
                .map((animacion) => (animacion as CSSTransition).transitionProperty),
            );
          }
        }
      }
    }).observe(document.body, { childList: true, subtree: true });
  });
  await page.getByRole('button', { name: 'Guardar cliente' }).click();
  const aviso = page.locator('.aviso-en-pantalla').filter({ hasText: 'Cliente guardado.' });
  await expect(aviso).toBeVisible(CARGA);
  const entradas = await page.evaluate(
    () => (window as unknown as { entradasDeAvisos: string[][] }).entradasDeAvisos,
  );
  console.log(`${testInfo.project.name}, al entrar: ${JSON.stringify(entradas)}`);
  expect(entradas.flat()).toEqual(expect.arrayContaining(['opacity', 'translate']));

  const alCerrar = await aviso.evaluate(async (tarjeta) => {
    const yaSeIba = tarjeta.hasAttribute('data-saliendo');
    const fundido: string[] = [];
    tarjeta.addEventListener('transitionrun', (evento) => {
      if (evento instanceof TransitionEvent && evento.target === tarjeta) {
        fundido.push(evento.propertyName);
      }
    });
    const cerrar = tarjeta.querySelector('button[aria-label="Cerrar el aviso"]');
    if (!(cerrar instanceof HTMLElement)) throw new Error('sin el botón de cerrar');
    cerrar.click();
    await Promise.resolve();
    await Promise.resolve();
    const enElActo = {
      sigue: tarjeta.isConnected,
      inerte: tarjeta.hasAttribute('inert'),
      saliendo: tarjeta.hasAttribute('data-saliendo'),
    };
    await new Promise<void>((listo) => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          listo();
        });
      });
    });
    return { yaSeIba, ...enElActo, fundido };
  });
  console.log(`${testInfo.project.name}, al irse: ${JSON.stringify(alCerrar)}`);
  expect(alCerrar).toMatchObject({ yaSeIba: false, sigue: true, inerte: true, saliendo: true });
  expect(alCerrar.fundido).toContain('opacity');
  await expect(aviso).toHaveCount(0);
});

test('copiar dibuja la tilde de «Copiado»', async ({ page, context }, testInfo) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  const trabajo = await trabajoListoConEnlace(sesion, {
    titulo: 'E2E Placard de pasillo',
    cliente: 'E2E Julieta Ramos',
  });
  await page.goto(`/proyectos/${trabajo.id}/compartir`);
  const enlace = page.getByRole('region', { name: 'El enlace' });
  const copiar = enlace.getByRole('button', { name: 'Copiar' });
  await expect(copiar).toBeVisible(CARGA);
  const alCopiar = await copiar.evaluate(async (boton: HTMLElement) => {
    boton.click();
    for (let intento = 0; intento < 60; intento += 1) {
      const trazo = boton.querySelector('svg.tilde path');
      if (trazo !== null) {
        return trazo
          .getAnimations()
          .map((animacion) => (animacion instanceof CSSAnimation ? animacion.animationName : ''));
      }
      await new Promise(requestAnimationFrame);
    }
    return null;
  });
  console.log(`${testInfo.project.name}, al copiar: ${JSON.stringify(alCopiar)}`);
  expect(alCopiar).toEqual(['maun-trazo']);
  await expect(enlace.getByRole('button', { name: 'Copiado' })).toBeVisible();
});

test('con menos movimiento, nada de lo nuevo dura más de 0,01 ms', async ({ page }, testInfo) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await crearCliente(sesion, 'E2E Ana Gutiérrez');
  await page.goto('/clientes');
  const grupo = page.getByRole('radiogroup', { name: 'Ordenar por' });
  await expect(grupo).toBeVisible(CARGA);

  const medir = async (
    descripcion: string,
    accion: (elementos: {
      selector: string;
      texto?: string;
    }) => { duracion: number; nombre: string }[],
    argumento: { selector: string; texto?: string },
  ) => {
    const vistas = await page.evaluate(accion, argumento);
    console.log(`${testInfo.project.name}, ${descripcion}: ${JSON.stringify(vistas)}`);
    for (const vista of vistas) expect(vista.duracion, descripcion).toBeLessThanOrEqual(0.01);
  };

  const hacerYMedir = ({ selector, texto }: { selector: string; texto?: string }) => {
    const candidatos = [...document.querySelectorAll<HTMLElement>(selector)];
    const elegido =
      texto === undefined
        ? candidatos[0]
        : candidatos.find((candidato) => candidato.textContent.trim() === texto);
    elegido?.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    elegido?.click();
    return document.getAnimations().map((animacion) => ({
      duracion: Number(animacion.effect?.getComputedTiming().duration ?? 0),
      nombre:
        animacion instanceof CSSAnimation
          ? animacion.animationName
          : animacion instanceof CSSTransition
            ? animacion.transitionProperty
            : animacion.constructor.name,
    }));
  };

  const opciones = await grupo.getByRole('radio').allTextContents();
  await medir('el segmentado', hacerYMedir, {
    selector: '[role="radiogroup"][aria-label="Ordenar por"] button',
    texto: (opciones.at(-1) ?? '').trim(),
  });
  await medir('el menú del más', hacerYMedir, {
    selector:
      'nav[aria-label="Principal"] button[aria-label="Cargar algo nuevo"], nav[aria-label="Principal"] button[aria-expanded]',
  });
  await medir('el menú al cerrarse', hacerYMedir, {
    selector: 'button[aria-label="Cerrar el menú"]',
  });

  await page.goto('/opiniones/preguntas');
  await page.getByRole('button', { name: 'Agregar una pregunta' }).click(CARGA);
  await expect(page.getByRole('switch', { name: /Que tenga que contestarla/ })).toBeVisible(CARGA);
  await medir('el interruptor', hacerYMedir, { selector: 'button[role="switch"]' });

  const texto = 'E2E Pasar por el corralón';
  await crearAnotacionPorRest(sesion, { fecha: hoyEnElTaller(), texto, categoria: 'materiales' });
  await page.goto('/agenda');
  await expect(page.getByText(texto).first()).toBeVisible(CARGA);
  const casilla = page.getByRole('checkbox', { name: texto });
  if ((await casilla.count()) > 0) {
    await medir('la casilla de la agenda', hacerYMedir, {
      selector: `button[role="checkbox"][aria-label="${texto}"]`,
    });
  }
});

async function anotarLasFormas(page: Page, raiz: string): Promise<void> {
  await page.evaluate((selector) => {
    const formas = new Map<Element, string>();
    for (const elemento of document.querySelectorAll(`${selector} *`)) {
      const estilo = getComputedStyle(elemento);
      formas.set(elemento, [estilo.scale, estilo.translate, estilo.clipPath].join('|'));
    }
    (window as unknown as { formasDeAntes: Map<Element, string> }).formasDeAntes = formas;
  }, raiz);
}

async function formasQueCambiaron(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const formas = (window as unknown as { formasDeAntes: Map<Element, string> }).formasDeAntes;
    return [...formas].flatMap(([elemento, antes]) => {
      if (!elemento.isConnected) return [];
      const estilo = getComputedStyle(elemento);
      const ahora = [estilo.scale, estilo.translate, estilo.clipPath].join('|');
      return ahora === antes ? [] : [`${elemento.tagName.toLowerCase()}: ${antes} → ${ahora}`];
    });
  });
}

async function sinMovimientoAlApretarYCopiar(
  page: Page,
  testInfo: TestInfo,
  donde: string,
  raiz: string,
) {
  const noPuedo = page.getByRole('button', { name: 'No puedo ese día' });
  await expect(noPuedo).toBeVisible(CARGA);
  await expect(page.getByRole('button', { name: 'Copiar el alias' })).toBeVisible(CARGA);
  await hastaQueQuede(page);
  await anotarLasFormas(page, raiz);
  const caja = await noPuedo.boundingBox();
  if (caja === null) throw new Error('el botón no tiene caja');
  await page.mouse.move(caja.x + caja.width / 2, caja.y + caja.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(250);
  expect(await noPuedo.evaluate((boton) => getComputedStyle(boton).scale), donde).toBe('none');
  await page.mouse.move(1, 1);
  await page.mouse.up();

  const copiar = page.getByRole('button', { name: 'Copiar el alias' });
  await copiar.click();
  await expect(copiar).toContainText('Copiado');
  const corriendo = await page.evaluate(
    (selector) =>
      document
        .getAnimations()
        .filter(
          (animacion) =>
            animacion instanceof CSSAnimation &&
            animacion.effect instanceof KeyframeEffect &&
            animacion.effect.target instanceof Element &&
            animacion.effect.target.closest(selector) !== null,
        )
        .map((animacion) => (animacion as CSSAnimation).animationName),
    raiz,
  );
  console.log(
    `${testInfo.project.name}, ${donde}, después de apretar y copiar: ${JSON.stringify(corriendo)}`,
  );
  expect(corriendo, donde).toEqual([]);
  expect(await formasQueCambiaron(page), donde).toEqual([]);
}

test('la página del cliente queda quieta al apretar y al copiar, por el enlace y adentro de la app', async ({
  page,
  context,
}, testInfo) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await ajustarCobroDelTaller(sesion, {
    alias: 'maun.muebles',
    cbu: '0110001312345678901233',
    titular: 'Ana Gutiérrez',
    cuit: '27-30123456-4',
  });
  const trabajo = await trabajoListoConEnlace(sesion, {
    titulo: 'E2E Placard de pasillo',
    cliente: 'E2E Julieta Ramos',
  });
  await proponerPorRpc(sesion, trabajo.id, {
    id: crypto.randomUUID(),
    forma: 'un_dia',
    fecha: diaHabilDesdeHoy(4),
    franja: 'tarde',
  });

  await page.goto(`/v/${trabajo.token}`);
  await expect(page.locator('html')).toHaveAttribute('data-vista', 'publica');
  await sinMovimientoAlApretarYCopiar(page, testInfo, 'por el enlace', 'body');

  await page.goto(`/proyectos/${trabajo.id}/vista-cliente`);
  await expect(page.locator('[data-quieta]').first()).toBeAttached(CARGA);
  await sinMovimientoAlApretarYCopiar(page, testInfo, 'adentro de la app', '[data-quieta]');
});

test('la encuesta queda quieta: al contestar solo se traza la firma de Gracias', async ({
  page,
}, testInfo) => {
  const clienteId = await crearCliente(sesion, 'Marcela Duarte');
  const id = crypto.randomUUID();
  await guardarProyectoPorRpc(sesion, {
    proyecto: {
      id,
      version: null,
      cliente_id: clienteId,
      titulo: 'Placard 3 puertas con interior en melamina',
      estado: 'entregado',
      presupuesto_centavos: 100_000_000,
      comprobante: 'sin_comprobante',
    },
    pagos: [],
    gastos: [],
  });
  const token = `e2e-${crypto.randomUUID().replaceAll('-', '')}`;
  await encuestaPorRest(sesion, id, token);

  await page.goto(`/o/${token}`);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    '¿Cómo te fue con tu placard?',
    CARGA,
  );
  await hastaQueQuede(page);
  await anotarLasFormas(page, 'body');
  for (const opcion of ['Muy conforme', 'A tiempo', 'Sí, sin dudarlo']) {
    const radio = page.getByRole('radio', { name: opcion, exact: true });
    await page.locator('label').filter({ has: radio }).click();
    await expect(radio).toBeChecked();
  }
  expect(await formasQueCambiaron(page)).toEqual([]);
  expect(
    (await animaciones(page)).filter((animacion) => animacion.tipo === 'CSSAnimation'),
  ).toEqual([]);

  await page.getByRole('button', { name: 'Mandar mi opinión' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Gracias, Marcela', CARGA);
  const enGracias = (await animaciones(page)).filter(
    (animacion) => animacion.tipo === 'CSSAnimation',
  );
  console.log(`${testInfo.project.name}, en Gracias: ${JSON.stringify(enGracias)}`);
  for (const animacion of enGracias) {
    expect(animacion.nombre).toBe('maun-trazo');
    expect(animacion.donde).toContain('trazar');
  }
});
