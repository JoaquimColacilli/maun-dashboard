import logo from './mercado-pago.png';

export interface LogoDeMercadoPagoProps {
  className?: string;
}

const ANCHO = 1875;

const ALTO = 485;

export function LogoDeMercadoPago({ className = '' }: LogoDeMercadoPagoProps) {
  return (
    <img
      src={logo}
      alt="Mercado Pago"
      width={ANCHO}
      height={ALTO}
      className={`h-4.5 w-auto flex-none ${className}`}
    />
  );
}
