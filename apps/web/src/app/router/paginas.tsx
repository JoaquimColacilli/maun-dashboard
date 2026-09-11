import { lazy } from 'react';

export const InicioPage = lazy(async () => ({
  default: (await import('@/pages/inicio')).InicioPage,
}));

export const CrearCuentaPage = lazy(async () => ({
  default: (await import('@/pages/crear-cuenta')).CrearCuentaPage,
}));

export const RecuperarPage = lazy(async () => ({
  default: (await import('@/pages/recuperar')).RecuperarPage,
}));

export const NuevaContrasenaPage = lazy(async () => ({
  default: (await import('@/pages/nueva-contrasena')).NuevaContrasenaPage,
}));

export const SinAccesoPage = lazy(async () => ({
  default: (await import('@/pages/sin-acceso')).SinAccesoPage,
}));

export const VerificacionPage = lazy(async () => ({
  default: (await import('@/pages/verificacion')).VerificacionPage,
}));
