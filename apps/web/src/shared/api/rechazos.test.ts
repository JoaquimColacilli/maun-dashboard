import { describe, expect, it } from 'vitest';

import { traducirRechazo, type ContextoDelRechazo } from './rechazos';

function deLaBase(codigo: string, mensaje = 'mensaje de la base', hint = ''): unknown {
  return { code: codigo, message: mensaje, hint, details: 'un detail que nadie muestra' };
}

function texto(codigo: string, contexto: ContextoDelRechazo): string {
  const traducido = traducirRechazo(deLaBase(codigo), contexto);
  if (!traducido) throw new Error(`${codigo} no se tradujo`);
  return `${traducido.titulo} ${traducido.queHacer}`;
}

describe('los MN00x traducidos a castellano de taller', () => {
  it('MN001 al cobrar: ya estaba cobrado', () => {
    expect(texto('MN001', { operacion: 'cobro', sujeto: 'Placard', estado: 'cobrado' })).toBe(
      '«Placard» ya estaba cobrado. Puede que lo hayas cerrado desde el celular o desde la PC. ' +
        'Fijate cómo quedó el reparto: si no es el que esperabas, reabrilo.',
    );
  });

  it('MN001 al guardar un gasto contra un perdido: el camino de salida', () => {
    expect(texto('MN001', { operacion: 'proyecto', sujeto: 'Mesada', estado: 'perdido' })).toBe(
      '«Mesada» está cerrado como perdido y sus números quedaron cerrados. Reactivá el presupuesto, ' +
        'cargá lo que falte y volvé a cerrarlo: el reparto de la seña se hace de nuevo.',
    );
  });

  it('MN001 al guardar un gasto contra un cobrado', () => {
    expect(texto('MN001', { operacion: 'proyecto', sujeto: 'Mesada', estado: 'cobrado' })).toBe(
      '«Mesada» está cobrado y sus números quedaron cerrados. Reabrí el cobro, corregí lo que haga ' +
        'falta y volvé a cobrarlo: el reparto se hace de nuevo con los números corregidos.',
    );
  });

  it('MN001 al borrar un liquidado con plata adentro', () => {
    expect(
      texto('MN001', { operacion: 'baja-de-proyecto', sujeto: 'Placard', estado: 'cobrado' }),
    ).toBe(
      '«Placard» tiene pagos o gastos y está cobrado: no se puede borrar. Borrar esta plata la ' +
        'sacaría del libro. Si el reparto está mal, corregilo reabriéndolo.',
    );
  });

  it('MN002: el proyecto está borrado', () => {
    expect(texto('MN002', { operacion: 'cobro', sujeto: 'Placard' })).toBe(
      '«Placard» está borrado. Puede que lo hayas borrado desde otro dispositivo. Si lo necesitás, ' +
        'cargalo de nuevo.',
    );
  });

  it('MN003: el cliente tiene trabajos', () => {
    expect(texto('MN003', { operacion: 'baja-de-cliente', sujeto: 'Marcela Sosa' })).toBe(
      '«Marcela Sosa» tiene trabajos cargados. Borrá esos trabajos, o pasalos a otro cliente, y ' +
        'después borrá el cliente.',
    );
  });

  it('MN004: la base no aceptó el cambio', () => {
    expect(texto('MN004', { operacion: 'guardado' })).toBe(
      'La base no aceptó ese cambio. Es algo que no tendría que pasar. Volvé a cargarlo, y si sigue ' +
        'igual avisá.',
    );
  });

  it('MN005: el cliente del trabajo está borrado', () => {
    expect(texto('MN005', { operacion: 'proyecto', sujeto: 'Placard' })).toBe(
      'El cliente de este trabajo está borrado. Elegí otro cliente para el trabajo, o volvé a ' +
        'cargar el cliente que borraste.',
    );
  });

  it('MN006 al cobrar: los números cambiaron', () => {
    expect(texto('MN006', { operacion: 'cobro', sujeto: 'Placard' })).toBe(
      'Los números cambiaron desde que viste el reparto. Se cargó un pago o un gasto, o cambiaron ' +
        'el sueldo o los costos fijos. Abrí el cobro otra vez: el reparto se calcula de nuevo con lo ' +
        'que hay ahora, y lo revisás antes de confirmar.',
    );
  });

  it('MN006 al guardar: cambió desde que lo abriste', () => {
    expect(texto('MN006', { operacion: 'proyecto', sujeto: 'Placard' })).toBe(
      '«Placard» cambió desde que lo abriste. Se guardó algo desde otro lado. Abrilo de nuevo para ' +
        'ver lo que hay ahora y volvé a cargar lo que te falte.',
    );
  });

  it('MN007 al cobrar algo que no está entregado', () => {
    expect(texto('MN007', { operacion: 'cobro', sujeto: 'Placard' })).toBe(
      '«Placard» todavía no está entregado. Se cobra lo que ya entregaste. Marcalo como entregado y ' +
        'después cobralo.',
    );
  });

  it('MN007 al dar por perdido algo entregado', () => {
    expect(texto('MN007', { operacion: 'cierre', sujeto: 'Placard' })).toBe(
      '«Placard» ya está entregado: no se da por perdido. Un mueble entregado se cobra, aunque el ' +
        'cliente tarde. Cobralo desde la ficha.',
    );
  });

  it('MN007 al cambiar el estado desde el formulario', () => {
    expect(texto('MN007', { operacion: 'proyecto', sujeto: 'Placard' })).toBe(
      'Ese cambio de estado no se puede hacer desde el formulario. Cobrar y dar por perdido son ' +
        'botones propios de la ficha, porque reparten plata. Volvé a la ficha y usá el botón.',
    );
  });

  it('MN008 al cobrar: la app quedó vieja', () => {
    expect(texto('MN008', { operacion: 'cobro', sujeto: 'Placard' })).toBe(
      'Esta app quedó vieja y está sacando otra cuenta que el servidor. No se guardó nada: el ' +
        'reparto quedó como estaba. Cerrá la app y volvé a abrirla para que se actualice, y hacelo ' +
        'de nuevo.',
    );
  });

  it('42501: la cuenta no tiene acceso', () => {
    expect(texto('42501', { operacion: 'cobro', sujeto: 'Placard' })).toBe(
      'Tu cuenta no tiene acceso a esto. Puede que el trabajo sea de otro taller, o que tu cuenta ' +
        'haya quedado sin taller. Cerrá sesión y volvé a entrar.',
    );
  });

  it('sin sujeto, habla del trabajo en general', () => {
    expect(texto('MN002', { operacion: 'cobro' })).toBe(
      'Este trabajo está borrado. Puede que lo hayas borrado desde otro dispositivo. Si lo ' +
        'necesitás, cargalo de nuevo.',
    );
  });

  it('un código sin traducción muestra lo que dice la base, con el código a mano', () => {
    const traducido = traducirRechazo(deLaBase('23514', 'viola un check', 'revisá el monto'));
    expect(traducido).toEqual({
      titulo: 'viola un check',
      queHacer: 'revisá el monto',
      codigo: '23514',
    });
  });

  it('lo que no es un rechazo de la base no se traduce', () => {
    expect(traducirRechazo(new TypeError('Failed to fetch'))).toBeUndefined();
  });
});
