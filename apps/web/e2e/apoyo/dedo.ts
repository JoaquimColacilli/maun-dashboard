import type { CDPSession, Page } from '@playwright/test';

export function dedo(page: Page): Promise<CDPSession> {
  return page.context().newCDPSession(page);
}

export async function apoyar(cdp: CDPSession, y: number, x = 195): Promise<void> {
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
}

export async function mover(
  cdp: CDPSession,
  desde: number,
  hasta: number,
  x = 195,
  salto = 6,
): Promise<void> {
  const pasos = Math.max(1, Math.ceil(Math.abs(hasta - desde) / salto));
  for (let paso = 1; paso <= pasos; paso += 1) {
    const y = desde + ((hasta - desde) * paso) / pasos;
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y }] });
  }
}

export async function levantar(cdp: CDPSession): Promise<void> {
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}

export async function tirarYSoltar(
  cdp: CDPSession,
  desde: number,
  hasta: number,
  x?: number,
): Promise<void> {
  await apoyar(cdp, desde, x);
  await mover(cdp, desde, hasta, x);
  await levantar(cdp);
}
