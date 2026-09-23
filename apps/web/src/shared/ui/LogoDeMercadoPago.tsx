import logo from './mercado-pago.png';

export interface LogoDeMercadoPagoProps {
  decorativo?: boolean;
  className?: string;
}

const ANCHO = 1875;

const ALTO = 485;

export function LogoDeMercadoPago({ decorativo = false, className = '' }: LogoDeMercadoPagoProps) {
  return (
    <span
      data-logo="mercado-pago"
      className={`inline-flex flex-none items-center rounded-control border border-hairline bg-paper-fijo px-1.5 py-1 ${className}`}
    >
      <img
        src={logo}
        alt={decorativo ? '' : 'Mercado Pago'}
        width={ANCHO}
        height={ALTO}
        className="h-4.5 w-auto"
      />
    </span>
  );
}
