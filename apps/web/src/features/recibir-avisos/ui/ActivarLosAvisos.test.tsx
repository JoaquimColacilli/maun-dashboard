import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ActivarLosAvisos } from './ActivarLosAvisos';

function permisoSimulado() {
  const pedirPermiso = vi.fn(() => Promise.resolve<NotificationPermission>('granted'));
  vi.stubGlobal('Notification', { permission: 'default', requestPermission: pedirPermiso });
  return pedirPermiso;
}

function mostrar(zonaGuardada: string | null = null) {
  const alActivar = vi.fn();
  render(
    <ActivarLosAvisos
      hora="07:30"
      zonaGuardada={zonaGuardada}
      activando={false}
      mensaje={null}
      alActivar={alActivar}
    />,
  );
  return alActivar;
}

describe('ActivarLosAvisos', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('no pide el permiso al mostrarse', () => {
    const pedirPermiso = permisoSimulado();
    mostrar();
    expect(pedirPermiso).not.toHaveBeenCalled();
  });

  it('la zona se pregunta: sin elegirla no pide el permiso y dice qué falta', () => {
    const pedirPermiso = permisoSimulado();
    const alActivar = mostrar();
    const zona = screen.getByLabelText('¿Dónde vivís?');
    expect(zona).toHaveValue('');

    fireEvent.click(screen.getByRole('button', { name: 'Activar los avisos' }));

    expect(pedirPermiso).not.toHaveBeenCalled();
    expect(alActivar).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent('Elegí dónde vivís');
    expect(zona).toHaveFocus();
    expect(zona).toHaveAttribute('aria-invalid', 'true');
  });

  it('pide el permiso dentro del mismo toque, antes de cualquier espera, y le pasa la zona', () => {
    const pedirPermiso = permisoSimulado();
    const alActivar = mostrar();
    fireEvent.change(screen.getByLabelText('¿Dónde vivís?'), {
      target: { value: 'America/Argentina/Buenos_Aires' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Activar los avisos' }));

    expect(pedirPermiso).toHaveBeenCalledTimes(1);
    expect(alActivar).toHaveBeenCalledTimes(1);
    expect(alActivar).toHaveBeenCalledWith(
      pedirPermiso.mock.results[0]?.value,
      'America/Argentina/Buenos_Aires',
    );
  });

  it('la zona que la persona ya eligió en otro dispositivo viene elegida', () => {
    permisoSimulado();
    const alActivar = mostrar('Europe/Madrid');
    expect(screen.getByLabelText('¿Dónde vivís?')).toHaveValue('Europe/Madrid');
    fireEvent.click(screen.getByRole('button', { name: 'Activar los avisos' }));
    expect(alActivar).toHaveBeenCalledWith(expect.any(Promise), 'Europe/Madrid');
  });
});
