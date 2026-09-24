import type { Page } from '@playwright/test';

export async function sinTransicionEnCurso(page: Page): Promise<void> {
  await page.waitForFunction(() => {
    const conTransicion = (quien: unknown) =>
      Boolean((quien as { activeViewTransition?: unknown } | null)?.activeViewTransition);
    return !conTransicion(document) && !conTransicion(document.querySelector('main#contenido'));
  });
}
