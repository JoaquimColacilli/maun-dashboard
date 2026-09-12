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

export interface AvatarProps {
  nombre: string;
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

export function Avatar({ nombre, tamano = 'chico', className = '' }: AvatarProps) {
  return (
    <span
      aria-hidden
      className={[
        'inline-flex flex-none items-center justify-center rounded-pill font-semibold text-sobre-avatar select-none',
        FONDOS[colorDelNombre(nombre)] ?? FONDOS[0],
        TAMANOS[tamano],
        className,
      ].join(' ')}
    >
      {inicialesDelNombre(nombre)}
    </span>
  );
}
