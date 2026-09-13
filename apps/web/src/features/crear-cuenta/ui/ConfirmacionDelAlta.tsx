import { mensajeDeAcceso, reenviarConfirmacion } from '@/shared/api';
import { MailEnviado } from '@/shared/ui';

import { RUTA_DE_CONFIRMACION } from './FormularioDeRegistro';

export function ConfirmacionDelAlta({
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
      detalle="Abrí el enlace desde este mismo dispositivo: al confirmar se crea tu taller y entrás. Si en unos minutos no llegó, fijate en el correo no deseado."
      reenviar={async () => {
        try {
          await reenviarConfirmacion(email, `${window.location.origin}${RUTA_DE_CONFIRMACION}`);
          return undefined;
        } catch (fallo) {
          return mensajeDeAcceso(fallo);
        }
      }}
    />
  );
}
