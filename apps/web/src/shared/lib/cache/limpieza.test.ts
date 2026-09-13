import 'fake-indexeddb/auto';

import { QueryClient } from '@tanstack/react-query';
import { describe, expect, it } from 'vitest';

import { activarBloqueo, bloqueoDe, CLAVE_DEL_BLOQUEO } from '../huella';
import { limpiarDatosLocales } from './limpieza';

describe('al terminar la sesión', () => {
  it('se borra la marca de bloqueo con huella de este dispositivo, como todo lo demás', async () => {
    activarBloqueo('ana', 'Y3JlZA');
    expect(bloqueoDe('ana')).not.toBeNull();

    await limpiarDatosLocales(new QueryClient());

    expect(localStorage.getItem(CLAVE_DEL_BLOQUEO)).toBeNull();
    expect(bloqueoDe('ana')).toBeNull();
  });
});
