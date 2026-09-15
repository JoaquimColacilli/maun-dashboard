import type { EstadoDeLosAvisos, ServidorDeAvisos } from '@/shared/api';

export type FaseDeLosAvisos =
  'sin-claves' | 'sin-instalar' | 'sin-soporte' | 'denegado' | 'sin-pedir' | 'activos';

export interface EsteDispositivo {
  soportado: boolean;
  iphone: boolean;
  comoApp: boolean;
  permiso: NotificationPermission | null;
  endpoint: string | null;
}

export function faseDeLosAvisos(
  dispositivo: EsteDispositivo,
  servidor: ServidorDeAvisos,
  estado: EstadoDeLosAvisos,
): FaseDeLosAvisos {
  if (!servidor.configurado) return 'sin-claves';
  if (dispositivo.iphone && !dispositivo.comoApp) return 'sin-instalar';
  if (!dispositivo.soportado || dispositivo.permiso === null) return 'sin-soporte';
  if (dispositivo.permiso === 'denied') return 'denegado';
  if (dispositivo.permiso === 'granted' && dispositivo.endpoint !== null && estado.suscripto) {
    return 'activos';
  }
  return 'sin-pedir';
}
