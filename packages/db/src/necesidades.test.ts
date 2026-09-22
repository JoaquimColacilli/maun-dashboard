import { TIPOS_DE_NECESIDAD } from '@maun/domain';
import { describe, expect, it } from 'vitest';

import { Constants } from './database.types.ts';

describe('los tipos de lo que hace falta', () => {
  it('el dominio y la base conocen los mismos: un tipo nuevo va a los dos lados', () => {
    expect([...TIPOS_DE_NECESIDAD].sort()).toEqual(
      [...Constants.public.Enums.tipo_de_necesidad].sort(),
    );
  });
});
