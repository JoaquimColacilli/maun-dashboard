import { Link } from 'react-router';

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
    <Link
      to={rutaDelCliente(id)}
      className={`underline decoration-hairline underline-offset-2 hover:decoration-ink ${className}`}
    >
      {nombre}
    </Link>
  );
}
