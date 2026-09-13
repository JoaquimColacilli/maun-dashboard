import { useState } from 'react';

const FONDOS = [
  'bg-avatar-1',
  'bg-avatar-2',
  'bg-avatar-3',
  'bg-avatar-4',
  'bg-avatar-5',
  'bg-avatar-6',
] as const;

const TAMANOS = {
  chico: 'size-9 text-label',
  grande: 'size-14 text-body-lg',
} as const;

type EstadoDeLaFoto = 'cargando' | 'lista' | 'fallo';

export interface AvatarProps {
  nombre: string;
  foto?: string;
  tamano?: keyof typeof TAMANOS;
  className?: string;
}

export function inicialesDelNombre(nombre: string): string {
  const partes = nombre.trim().split(/\s+/).filter(Boolean);
  const primera = Array.from(partes[0] ?? '')[0] ?? '';
  const ultima = partes.length > 1 ? (Array.from(partes[partes.length - 1] ?? '')[0] ?? '') : '';
  return `${primera}${ultima}`.toLocaleUpperCase('es-AR');
}

export function colorDelNombre(nombre: string): number {
  let suma = 0;
  for (const letra of nombre.trim().toLocaleLowerCase('es-AR')) {
    suma = (suma * 31 + (letra.codePointAt(0) ?? 0)) % 9973;
  }
  return suma % FONDOS.length;
}

export function Avatar({ nombre, foto = '', tamano = 'chico', className = '' }: AvatarProps) {
  const [carga, setCarga] = useState<{ foto: string; estado: EstadoDeLaFoto }>({
    foto,
    estado: 'cargando',
  });
  if (carga.foto !== foto) setCarga({ foto, estado: 'cargando' });

  const estado: EstadoDeLaFoto | 'sin-foto' =
    foto === '' ? 'sin-foto' : carga.foto === foto ? carga.estado : 'cargando';
  const lista = estado === 'lista';

  return (
    <span
      aria-hidden
      data-foto={estado}
      className={[
        'relative inline-flex flex-none items-center justify-center overflow-hidden rounded-pill font-semibold select-none',
        lista ? 'text-transparent' : 'text-sobre-avatar',
        FONDOS[colorDelNombre(nombre)] ?? FONDOS[0],
        TAMANOS[tamano],
        className,
      ].join(' ')}
    >
      {inicialesDelNombre(nombre)}
      {foto !== '' && estado !== 'fallo' && (
        <img
          src={foto}
          alt=""
          draggable={false}
          decoding="async"
          onLoad={() => {
            setCarga({ foto, estado: 'lista' });
          }}
          onError={() => {
            setCarga({ foto, estado: 'fallo' });
          }}
          className={`absolute inset-0 size-full object-cover transition-opacity duration-(--dur-fast) ${
            lista ? 'opacity-100' : 'opacity-0'
          }`}
        />
      )}
    </span>
  );
}
