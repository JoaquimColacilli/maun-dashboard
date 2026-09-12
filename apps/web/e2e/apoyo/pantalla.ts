import { expect, type Page } from '@playwright/test';

export interface SaldosDeInicio {
  hogar: number;
  maun: number;
  diezmo: number;
  cocos: number;
}

export async function listoParaCortar(page: Page): Promise<void> {
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => undefined));
  await expect(page.getByRole('status').last()).toBeHidden({ timeout: 20_000 });
}

export async function saldosEnInicio(page: Page): Promise<SaldosDeInicio> {
  await page.goto('/');
  const tesoros = page.getByRole('region', { name: 'Tesoros' });

  const leer = async (nombre: string): Promise<number> => {
    const texto = await tesoros.getByRole('button', { name: new RegExp(`^${nombre}`) }).innerText();
    const encontrado = /\$\s?([\d.]+)/.exec(texto);
    if (!encontrado?.[1]) {
      if (nombre === 'Diezmo') return 0;
      throw new Error(`no se pudo leer el saldo de ${nombre}: «${texto}»`);
    }
    const valor = Number(encontrado[1].replaceAll('.', ''));
    if (nombre !== 'Diezmo') return valor;
    return texto.includes('de más') ? -valor : valor;
  };

  return {
    hogar: await leer('Hogar'),
    maun: await leer('Maun'),
    diezmo: await leer('Diezmo'),
    cocos: await leer('Cocos'),
  };
}
