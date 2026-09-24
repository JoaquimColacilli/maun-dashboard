import { useState } from 'react';

import { ConfirmacionDelPedido, FormularioDePedido } from '@/features/recuperar-acceso';
import { Ir } from '@/shared/lib';
import { ENLACE_DE_ACCESO, PantallaDeAcceso } from '@/shared/ui';

export function RecuperarPage() {
  const [email, setEmail] = useState('');
  const [enviado, setEnviado] = useState(false);

  if (enviado) {
    return (
      <PantallaDeAcceso
        titulo="Revisá tu correo"
        bajada="El enlace te lleva a poner una contraseña nueva."
        nota="El servidor de mails manda pocos por hora. Si pediste varios seguidos, esperá un rato antes de volver a intentar."
      >
        <ConfirmacionDelPedido
          email={email}
          alCambiar={() => {
            setEnviado(false);
          }}
        />
      </PantallaDeAcceso>
    );
  }

  return (
    <PantallaDeAcceso
      titulo="Recuperá el acceso"
      bajada="Te mandamos un enlace para poner una contraseña nueva."
      pie={
        <p>
          ¿Te acordaste?{' '}
          <Ir a="/acceso" className={ENLACE_DE_ACCESO}>
            Entrá
          </Ir>
        </p>
      }
    >
      <FormularioDePedido
        emailInicial={email}
        alPedir={(pedido) => {
          setEmail(pedido);
          setEnviado(true);
        }}
      />
    </PantallaDeAcceso>
  );
}
