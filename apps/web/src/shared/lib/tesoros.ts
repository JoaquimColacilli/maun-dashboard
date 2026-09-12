import type { Tesoro } from '@/shared/api';
import type { NombreDeIcono } from '@/shared/ui';

export interface DatosDelTesoro {
  id: Tesoro;
  nombre: string;
  descripcion: string;
  icono: NombreDeIcono;
  fondo: string;
  texto: string;
  barra: string;
}

export const TESOROS_EN_ORDEN: readonly Tesoro[] = ['hogar', 'maun', 'diezmo', 'cocos'];

export const TESORO: Readonly<Record<Tesoro, DatosDelTesoro>> = {
  hogar: {
    id: 'hogar',
    nombre: 'Hogar',
    descripcion: 'La plata de la familia',
    icono: 'house',
    fondo: 'bg-hogar-tint',
    texto: 'text-hogar',
    barra: 'bg-hogar',
  },
  maun: {
    id: 'maun',
    nombre: 'Maun',
    descripcion: 'La caja del taller',
    icono: 'hammer',
    fondo: 'bg-maun-tint',
    texto: 'text-maun',
    barra: 'bg-maun',
  },
  diezmo: {
    id: 'diezmo',
    nombre: 'Diezmo',
    descripcion: 'Lo apartado de cada ganancia',
    icono: 'church',
    fondo: 'bg-diezmo-tint',
    texto: 'text-diezmo',
    barra: 'bg-diezmo',
  },
  cocos: {
    id: 'cocos',
    nombre: 'Cocos',
    descripcion: 'Ahorro para la casa propia',
    icono: 'piggy-bank',
    fondo: 'bg-cocos-tint',
    texto: 'text-cocos',
    barra: 'bg-cocos',
  },
};
