import { lazy } from 'react';

export const CrearCuentaPage = lazy(async () => ({
  default: (await import('@/pages/crear-cuenta')).CrearCuentaPage,
}));

export const RecuperarPage = lazy(async () => ({
  default: (await import('@/pages/recuperar')).RecuperarPage,
}));

export const NuevaContrasenaPage = lazy(async () => ({
  default: (await import('@/pages/nueva-contrasena')).NuevaContrasenaPage,
}));
