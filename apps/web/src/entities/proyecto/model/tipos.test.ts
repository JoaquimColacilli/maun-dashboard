import { describe, expect, it } from 'vitest';

import type { Proyecto } from './catalogos';
import { TIPOS_DE_ARRANQUE, tiposParaSugerir } from './tipos';

function con(tipo: string | null): Proyecto {
  return { tipo_de_proyecto: tipo } as Proyecto;
}

describe('los tipos de proyecto que sugiere el formulario', () => {
  it('sin trabajos con tipo, los de arranque', () => {
    expect(tiposParaSugerir([])).toEqual([...TIPOS_DE_ARRANQUE]);
    expect(tiposParaSugerir([con(null), con('   ')])).toEqual([...TIPOS_DE_ARRANQUE]);
  });

  it('primero los que ya usó, del más usado al menos, sin repetir los que escribió distinto', () => {
    const sugeridos = tiposParaSugerir([
      con('Rack'),
      con('placard'),
      con('Placard'),
      con('Cocina'),
      con('Cocina '),
      con('cocina'),
    ]);
    expect(sugeridos.slice(0, 3)).toEqual(['Cocina', 'placard', 'Rack']);
    expect(sugeridos).not.toContain('Placard');
    expect(sugeridos).toContain('Vestidor');
    expect(sugeridos).toHaveLength(3 + TIPOS_DE_ARRANQUE.length - 2);
  });

  it('una fila guardada antes de la columna no rompe nada', () => {
    expect(tiposParaSugerir([{} as Proyecto])).toEqual([...TIPOS_DE_ARRANQUE]);
  });
});
