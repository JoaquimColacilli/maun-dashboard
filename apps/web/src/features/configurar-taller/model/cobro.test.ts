import { describe, expect, it } from 'vitest';

import type { FilaDe } from '@/shared/api';

import { diferencias } from './cambios';
import {
  avisoDelAlias,
  avisoDelCuitDelTaller,
  cambiosDeCobro,
  cobroDeLosAjustes,
  errorDeCobro,
  etiquetaDeLaClave,
  type DatosDeCobro,
} from './cobro';

const CBU = '0110001312345678901233';
const CVU = '0000999109999999999990';

function ajustes(extra: Partial<FilaDe<'ajustes'>> = {}): FilaDe<'ajustes'> {
  return {
    id: 'a',
    household_id: 'h',
    sueldo_mensual_centavos: 1_800_000,
    costos_fijos_centavos: 500_000,
    meta_cocos_centavos: 0,
    tasa_cocos_anual_bp: 0,
    sena_bp: 5000,
    sueldo_tope_mensual: false,
    perdido_con_sueldo: false,
    perdido_con_diezmo: true,
    cobro_alias: '',
    cobro_cbu: '',
    cobro_titular: '',
    cobro_cuit: '',
    cobro_link: '',
    resena_link: '',
    presupuesto_vale_dias: 15,
    created_at: '2026-09-19T12:00:00Z',
    updated_at: '2026-09-19T12:00:00Z',
    deleted_at: null,
    version: 1,
    ...extra,
  };
}

function datos(extra: Partial<DatosDeCobro> = {}): DatosDeCobro {
  return { alias: '', cbu: '', titular: '', cuit: '', link: '', ...extra };
}

describe('lo que se carga y lo que se guarda', () => {
  it('el CBU guardado se muestra agrupado y vuelve a guardarse pelado', () => {
    const cargados = cobroDeLosAjustes(ajustes({ cobro_cbu: CBU }));
    expect(cargados.cbu).toBe('0110 0013 1234 5678 9012 33');
    expect(cambiosDeCobro(cargados).cobro_cbu).toBe(CBU);
  });

  it('recorta los espacios y acomoda el CUIT antes de mandarlo', () => {
    expect(
      cambiosDeCobro(datos({ alias: '  maun.muebles ', titular: '  Ana  ', cuit: '27301234564' })),
    ).toEqual({
      cobro_alias: 'maun.muebles',
      cobro_cbu: '',
      cobro_titular: 'Ana',
      cobro_cuit: '27-30123456-4',
      cobro_link: '',
    });
  });

  it('solo manda a la base lo que de verdad cambió', () => {
    const fila = ajustes({ cobro_alias: 'maun.muebles', cobro_cbu: CBU });
    const iguales = diferencias(fila, cambiosDeCobro(cobroDeLosAjustes(fila)));
    expect(iguales.cambios).toEqual({});

    const conOtroAlias = diferencias(
      fila,
      cambiosDeCobro({ ...cobroDeLosAjustes(fila), alias: 'taller.maun' }),
    );
    expect(conOtroAlias.cambios).toEqual({ cobro_alias: 'taller.maun' });
    expect(conOtroAlias.previos).toEqual({ cobro_alias: 'maun.muebles' });
  });

  it('no pisa lo que esta pantalla no toca', () => {
    const fila = ajustes();
    const { cambios } = diferencias(fila, { cobro_alias: 'maun.muebles' });
    expect(cambios).toEqual({ cobro_alias: 'maun.muebles' });
    expect(Object.keys(cambios)).not.toContain('sueldo_mensual_centavos');
    expect(Object.keys(cambios)).not.toContain('sena_bp');
  });
});

describe('lo que frena el formulario', () => {
  it('todo vacío se guarda: los cuatro son opcionales', () => {
    expect(errorDeCobro(datos())).toBeNull();
  });

  it('un alias con guion bajo o demasiado corto no pasa', () => {
    expect(errorDeCobro(datos({ alias: 'plata_del_taller' }))?.campo).toBe('alias');
    expect(errorDeCobro(datos({ alias: 'corto' }))?.mensaje).toContain('entre 6 y 20');
  });

  it('un CBU que no cierra no pasa, y dice cuál de los dos controles falló', () => {
    expect(errorDeCobro(datos({ cbu: '0110 0014 1234 5678 9012 33' }))?.mensaje).toContain(
      'los primeros ocho',
    );
    expect(errorDeCobro(datos({ cbu: '2850 5909 0000 0000 0000 10' }))?.mensaje).toContain(
      'los últimos catorce',
    );
    expect(errorDeCobro(datos({ cbu: '0110 0013' }))?.mensaje).toContain('22 dígitos');
  });

  it('el CUIT solo frena por el largo, como en la ficha de un cliente', () => {
    expect(errorDeCobro(datos({ cuit: '27-3012345' }))?.campo).toBe('cuit');
    expect(errorDeCobro(datos({ cuit: '27-30123456-9' }))).toBeNull();
  });

  it('un titular larguísimo no pasa', () => {
    expect(errorDeCobro(datos({ titular: 'a'.repeat(201) }))?.campo).toBe('titular');
  });

  it('lo bueno pasa entero', () => {
    expect(
      errorDeCobro(
        datos({
          alias: 'maun.muebles',
          cbu: '0110 0013 1234 5678 9012 33',
          titular: 'Ana Gutiérrez',
          cuit: '27-30123456-4',
        }),
      ),
    ).toBeNull();
  });
});

describe('lo que avisa sin frenar', () => {
  it('el alias que arranca o termina con un separador', () => {
    expect(avisoDelAlias('.maun.muebles')).toContain('no lo prohíbe');
    expect(avisoDelAlias('maun..muebles')).toContain('no lo prohíbe');
    expect(avisoDelAlias('maun.muebles')).toBeUndefined();
    expect(avisoDelAlias('')).toBeUndefined();
    expect(avisoDelAlias('corto')).toBeUndefined();
  });

  it('el CUIT que no cierra', () => {
    expect(avisoDelCuitDelTaller('27-30123456-9')).toContain('verificador');
    expect(avisoDelCuitDelTaller('99-30123456-4')).toContain('20, 23, 24, 27, 30, 33 o 34');
    expect(avisoDelCuitDelTaller('')).toBeUndefined();
  });
});

describe('la etiqueta del campo', () => {
  it('dice CVU cuando el número tiene forma de billetera', () => {
    expect(etiquetaDeLaClave(CVU)).toBe('CVU de la billetera');
    expect(etiquetaDeLaClave(CBU)).toBe('CBU o CVU');
    expect(etiquetaDeLaClave('')).toBe('CBU o CVU');
  });
});

describe('el link de Mercado Pago', () => {
  it('se carga y se guarda con la barra que espera la base', () => {
    expect(cobroDeLosAjustes(ajustes({ cobro_link: 'https://mpago.la/2vXyZ1' })).link).toBe(
      'https://mpago.la/2vXyZ1',
    );
    expect(cambiosDeCobro(datos({ link: '  https://mpago.la  ' })).cobro_link).toBe(
      'https://mpago.la/',
    );
  });

  it('vacío se guarda vacío: es opcional', () => {
    expect(cambiosDeCobro(datos()).cobro_link).toBe('');
    expect(errorDeCobro(datos())).toBeNull();
  });

  it('un link de otro sitio no se guarda y el aviso dice cuáles sí', () => {
    const problema = errorDeCobro(datos({ link: 'https://pagame-aca.com/taller' }));
    expect(problema?.campo).toBe('link');
    expect(problema?.mensaje).toContain('mpago.la');
  });

  it('sin https tampoco', () => {
    const problema = errorDeCobro(datos({ link: 'mpago.la/2vXyZ1' }));
    expect(problema?.campo).toBe('link');
    expect(problema?.mensaje).toContain('https://');
  });

  it('los otros campos se revisan antes: el link no tapa un CBU mal cargado', () => {
    const problema = errorDeCobro(datos({ cbu: '123', link: 'https://pagame-aca.com/x' }));
    expect(problema?.campo).toBe('cbu');
  });
});

describe('una fila de ajustes guardada por una versión vieja', () => {
  it('sin la columna del link se lee vacía, y guardar no rompe', () => {
    const { cobro_link: _link, ...vieja } = ajustes();
    const comoLaGuardoLaVersionVieja = vieja as unknown as FilaDe<'ajustes'>;

    const cargados = cobroDeLosAjustes(comoLaGuardoLaVersionVieja);
    expect(cargados.link).toBe('');
    expect(() => cambiosDeCobro(cargados)).not.toThrow();
    expect(cambiosDeCobro(cargados).cobro_link).toBe('');
    expect(errorDeCobro(cargados)).toBeNull();
  });
});
