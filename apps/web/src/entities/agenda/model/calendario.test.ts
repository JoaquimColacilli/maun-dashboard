import type { EventoDerivado, EventoPropio } from '@maun/domain';
import { describe, expect, it } from 'vitest';

import {
  conLoHechoAlFinal,
  cuentaDelDia,
  detalleDelEvento,
  diaDeLaSemana,
  diaEnPalabras,
  diasConEventos,
  estaHecha,
  etiquetaDelDia,
  fechasDelMes,
  hayImportante,
  mesEnPalabras,
  mesPrevio,
  mesSiguiente,
  nombreDelEvento,
  rangoDeLaGrilla,
  resumenDelDia,
  resumenDelMes,
  semanasDelMes,
  textoDeLoHecho,
  urgenciaDelEvento,
} from './calendario';

const HOY = '2026-09-14';

function derivado(cambios: Partial<EventoDerivado> = {}): EventoDerivado {
  return {
    clase: 'derivada',
    id: 'entrega:p1',
    categoria: 'entrega',
    fecha: '2026-09-16',
    hora: null,
    proyectoId: 'p1',
    clienteId: 'c1',
    titulo: 'Mesada y alacena',
    cliente: 'Familia Villalba',
    lugar: 'Sarmiento 2310',
    hecha: false,
    importante: false,
    ...cambios,
  };
}

function propio(cambios: Partial<EventoPropio> = {}): EventoPropio {
  return {
    clase: 'propia',
    id: 'n1',
    categoria: 'materiales',
    fecha: '2026-09-16',
    hora: null,
    texto: 'Llevar tornillos',
    proyectoId: null,
    proyecto: null,
    hecha: false,
    importante: false,
    ...cambios,
  };
}

describe('el calendario de lunes a domingo', () => {
  it('sabe qué día de la semana es cada fecha, con el lunes primero', () => {
    expect(diaDeLaSemana('2026-09-14')).toBe(0);
    expect(diaDeLaSemana('2026-09-20')).toBe(6);
    expect(diaDeLaSemana('2023-12-31')).toBe(6);
  });

  it('septiembre de 2026 arranca martes: la grilla empieza el lunes 31 de agosto y termina el domingo 4 de octubre', () => {
    const semanas = semanasDelMes('2026-09');

    expect(semanas).toHaveLength(5);
    expect(semanas.every((semana) => semana.length === 7)).toBe(true);
    expect(semanas[0]?.[0]).toEqual({ fecha: '2026-08-31', fuera: true });
    expect(semanas[0]?.[1]).toEqual({ fecha: '2026-09-01', fuera: false });
    expect(semanas[4]?.[6]).toEqual({ fecha: '2026-10-04', fuera: true });
    expect(rangoDeLaGrilla('2026-09')).toEqual({ desde: '2026-08-31', hasta: '2026-10-04' });
  });

  it('un febrero que empieza lunes y termina domingo son cuatro semanas justas', () => {
    expect(semanasDelMes('2027-02')).toHaveLength(4);
    expect(
      semanasDelMes('2027-02')
        .flat()
        .every((celda) => !celda.fuera),
    ).toBe(true);
  });

  it('los días del mes, y el mes siguiente y el anterior cruzando el año', () => {
    expect(fechasDelMes('2028-02')).toHaveLength(29);
    expect(fechasDelMes('2026-09')[29]).toBe('2026-09-30');
    expect(mesSiguiente('2026-12')).toBe('2027-01');
    expect(mesPrevio('2027-01')).toBe('2026-12');
  });

  it('el mes se escribe en minúscula, con el año solo si no es el de hoy', () => {
    expect(mesEnPalabras('2026-09', HOY)).toBe('septiembre');
    expect(mesEnPalabras('2027-01', HOY)).toBe('enero 2027');
    expect(diaEnPalabras('2026-09-16')).toBe('mié 16 de septiembre');
  });

  it('hoy, mañana y ayer tienen etiqueta; los demás días no', () => {
    expect(etiquetaDelDia('2026-09-14', HOY)).toBe('hoy');
    expect(etiquetaDelDia('2026-09-15', HOY)).toBe('mañana');
    expect(etiquetaDelDia('2026-09-13', HOY)).toBe('ayer');
    expect(etiquetaDelDia('2026-09-20', HOY)).toBeNull();
  });
});

describe('los resúmenes', () => {
  it('el del mes cuenta compromisos y anotaciones pendientes, dice aparte lo hecho, y el mes vacío lo dice', () => {
    expect(resumenDelMes([])).toBe('sin nada agendado');
    expect(resumenDelMes([derivado(), propio()])).toBe('1 compromiso · 1 anotación');
    expect(resumenDelMes([derivado(), derivado({ id: 'visita:p2' }), propio()])).toBe(
      '2 compromisos · 1 anotación',
    );
    expect(
      resumenDelMes([
        derivado(),
        propio(),
        propio({ id: 'n2', hecha: true }),
        propio({ id: 'n3', hecha: true }),
      ]),
    ).toBe('1 compromiso · 1 anotación · 2 hechas');
  });

  it('el del mes cuenta un compromiso cumplido con lo hecho, no con lo pendiente', () => {
    expect(
      resumenDelMes([
        derivado({ hecha: true }),
        derivado({ id: 'visita:p2', categoria: 'visita' }),
        propio({ hecha: true }),
      ]),
    ).toBe('1 compromiso · 0 anotaciones · 2 hechas');
    expect(resumenDelMes([derivado({ hecha: true })])).toBe(
      '0 compromisos · 0 anotaciones · 1 hecha',
    );
  });

  it('el del día cuenta lo pendiente y dice aparte lo hecho', () => {
    expect(resumenDelDia([])).toBe('Nada agendado');
    expect(
      resumenDelDia([
        derivado(),
        propio(),
        propio({ id: 'n2' }),
        propio({ id: 'n3', hecha: true }),
      ]),
    ).toBe('1 compromiso · 2 cosas anotadas · 1 hecha');
    expect(resumenDelDia([propio({ hecha: true }), propio({ id: 'n2', hecha: true })])).toBe(
      '2 hechas',
    );
    expect(resumenDelDia([derivado({ hecha: true }), propio()])).toBe('1 cosa anotada · 1 hecha');
  });

  it('la cuenta del botón del día separa lo pendiente de lo hecho, venga de donde venga', () => {
    expect(cuentaDelDia([])).toBe('nada agendado');
    expect(cuentaDelDia([propio()])).toBe('1 cosa');
    expect(cuentaDelDia([derivado(), propio(), propio({ id: 'n2', hecha: true })])).toBe(
      '2 cosas y 1 hecha',
    );
    expect(cuentaDelDia([propio({ hecha: true }), propio({ id: 'n2', hecha: true })])).toBe(
      '2 hechas',
    );
    expect(cuentaDelDia([derivado({ hecha: true }), propio({ hecha: true })])).toBe('2 hechas');
  });
});

describe('lo hecho en el día', () => {
  it('está hecha la anotación tildada y el compromiso cumplido', () => {
    expect(estaHecha(propio({ hecha: true }))).toBe(true);
    expect(estaHecha(propio())).toBe(false);
    expect(estaHecha(derivado())).toBe(false);
    expect(estaHecha(derivado({ hecha: true }))).toBe(true);
  });

  it('va abajo de lo pendiente, y cada grupo conserva su orden', () => {
    const eventos = [
      propio({ id: 'a', hecha: true }),
      derivado(),
      propio({ id: 'b' }),
      derivado({ id: 'visita:p2', categoria: 'visita', hecha: true }),
      propio({ id: 'c', hecha: true }),
    ];

    expect(conLoHechoAlFinal(eventos).map((evento) => evento.id)).toEqual([
      'entrega:p1',
      'b',
      'a',
      'visita:p2',
      'c',
    ]);
  });

  it('dice qué quiere decir hecho para cada cosa, para el lector de pantalla', () => {
    expect(textoDeLoHecho(propio({ hecha: true }))).toBe('hecha');
    expect(textoDeLoHecho(derivado({ hecha: true }))).toBe('entregada');
    expect(textoDeLoHecho(derivado({ categoria: 'visita', hecha: true }))).toBe('ya fuiste');
    expect(textoDeLoHecho(derivado({ categoria: 'presupuesto', hecha: true }))).toBe('enviado');
  });
});

describe('la urgencia de un compromiso', () => {
  it('lo atrasado y lo de hoy son alerta, lo cercano atención y lo lejano normal', () => {
    expect(urgenciaDelEvento(derivado({ fecha: '2026-09-11' }), HOY)).toEqual({
      texto: 'atrasada, era hace 3 días',
      tono: 'alerta',
    });
    expect(urgenciaDelEvento(derivado({ fecha: HOY }), HOY)).toEqual({
      texto: 'es hoy',
      tono: 'alerta',
    });
    expect(urgenciaDelEvento(derivado({ fecha: '2026-09-15' }), HOY)).toEqual({
      texto: 'es mañana',
      tono: 'atencion',
    });
    expect(urgenciaDelEvento(derivado({ fecha: '2026-09-18' }), HOY)).toEqual({
      texto: 'en 4 días',
      tono: 'atencion',
    });
    expect(urgenciaDelEvento(derivado({ fecha: '2026-09-25' }), HOY)?.tono).toBe('normal');
  });

  it('lo que anotó él no tiene urgencia: lo ordena él', () => {
    expect(urgenciaDelEvento(propio({ fecha: '2026-09-11' }), HOY)).toBeNull();
  });

  it('un compromiso cumplido no está atrasado ni es para hoy', () => {
    expect(urgenciaDelEvento(derivado({ fecha: '2026-09-11', hecha: true }), HOY)).toBeNull();
    expect(urgenciaDelEvento(derivado({ fecha: HOY, hecha: true }), HOY)).toBeNull();
  });
});

describe('cómo se nombra un evento', () => {
  it('una derivada dice qué hay que hacer, y su detalle es el cliente y el lugar', () => {
    expect(nombreDelEvento(derivado())).toBe('Entregar: Mesada y alacena');
    expect(nombreDelEvento(derivado({ categoria: 'presupuesto' }))).toBe(
      'Entregar presupuesto: Mesada y alacena',
    );
    expect(detalleDelEvento(derivado())).toBe('Familia Villalba, Sarmiento 2310');
    expect(detalleDelEvento(derivado({ lugar: '' }))).toBe('Familia Villalba');
  });

  it('una propia es su texto, y su detalle es el trabajo si lo tiene', () => {
    expect(nombreDelEvento(propio())).toBe('Llevar tornillos');
    expect(detalleDelEvento(propio())).toBe('');
    expect(detalleDelEvento(propio({ proyecto: 'Cocina en L' }))).toBe('Cocina en L');
  });
});

describe('los días de la lista del celular', () => {
  it('muestra los días con algo, más el elegido aunque esté vacío', () => {
    const eventos = [propio({ fecha: '2026-09-16' }), derivado({ fecha: '2026-09-18' })];
    const dias = diasConEventos(eventos, fechasDelMes('2026-09').slice(13), HOY);

    expect(dias.map((dia) => dia.fecha)).toEqual(['2026-09-14', '2026-09-16', '2026-09-18']);
    expect(dias[0]?.eventos).toEqual([]);
  });

  it('un día con algo marcado a mano lo sabe, sea una anotación o algo que sale de un trabajo', () => {
    expect(hayImportante([propio(), derivado()])).toBe(false);
    expect(hayImportante([propio({ importante: true })])).toBe(true);
    expect(hayImportante([propio(), derivado({ importante: true })])).toBe(true);
  });
});
