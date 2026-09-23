import { Navigate, useLocation } from 'react-router';

export interface RutaViejaProps {
  a: string;
}

export function RutaVieja({ a }: RutaViejaProps) {
  const ubicacion = useLocation();
  const estado: unknown = ubicacion.state;
  return <Navigate to={`${a}${ubicacion.search}${ubicacion.hash}`} replace state={estado} />;
}
