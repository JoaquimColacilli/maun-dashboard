import { Ir } from '@/shared/lib';

import { rutaDelCliente } from '../model/rutas';

export function EnlaceACliente({
  id,
  nombre,
  className = '',
}: {
  id: string;
  nombre: string;
  className?: string;
}) {
  return (
    <Ir
      a={rutaDelCliente(id)}
      className={`underline decoration-hairline underline-offset-2 hover:decoration-ink ${className}`}
    >
      {nombre}
    </Ir>
  );
}
