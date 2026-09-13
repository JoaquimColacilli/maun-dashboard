import { mensajeDeAcceso, pedirRecuperacion } from '@/shared/api';
import { MailEnviado } from '@/shared/ui';

import { RUTA_DE_NUEVA_CONTRASENA } from './FormularioDePedido';

export function ConfirmacionDelPedido({
  email,
  alCambiar,
}: {
  email: string;
  alCambiar: () => void;
}) {
  return (
    <MailEnviado
      email={email}
      alCambiar={alCambiar}
      detalle="Si hay una cuenta con ese mail, te llega un enlace para poner una contraseña nueva. Abrilo desde este mismo dispositivo. Si en unos minutos no llegó, fijate en el correo no deseado."
      reenviar={async () => {
        try {
          await pedirRecuperacion(email, `${window.location.origin}${RUTA_DE_NUEVA_CONTRASENA}`);
          return undefined;
        } catch (fallo) {
          return mensajeDeAcceso(fallo);
        }
      }}
    />
  );
}
