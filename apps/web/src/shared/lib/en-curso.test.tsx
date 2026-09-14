import { render, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { useAlgoEnCurso, useHayAlgoEnCurso } from './en-curso';

function Anotado({ activo }: { activo: boolean }) {
  useAlgoEnCurso(activo);
  return null;
}

describe('lo que está en curso', () => {
  it('hay algo mientras alguien lo anota, y deja de haber cuando todos lo sueltan', () => {
    const { result } = renderHook(() => useHayAlgoEnCurso());
    expect(result.current).toBe(false);

    const hoja = render(<Anotado activo />);
    expect(result.current).toBe(true);

    const formulario = render(<Anotado activo />);
    hoja.rerender(<Anotado activo={false} />);
    expect(result.current).toBe(true);

    formulario.unmount();
    expect(result.current).toBe(false);
  });
});
