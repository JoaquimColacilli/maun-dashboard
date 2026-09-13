import { useState } from 'react';
import { Link } from 'react-router';

import { ConfirmacionDelAlta, FormularioDeRegistro } from '@/features/crear-cuenta';
import { ENLACE_DE_ACCESO, PantallaDeAcceso } from '@/shared/ui';

export function CrearCuentaPage() {
  const [email, setEmail] = useState('');
  const [enviado, setEnviado] = useState(false);

  if (enviado) {
    return (
      <PantallaDeAcceso
        titulo="Revisá tu correo"
        bajada="Falta un paso: confirmar que el mail es tuyo."
        nota="El servidor de mails manda pocos por hora. Si pediste varios seguidos, esperá un rato antes de volver a intentar."
      >
        <ConfirmacionDelAlta
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
      titulo="Creá tu cuenta"
      bajada="Confirmás el mail y tu taller se crea solo, vacío y listo para cargar."
      nota="Una vez adentro, la app anda aunque no haya señal."
      pie={
        <p>
          ¿Ya tenés cuenta?{' '}
          <Link to="/acceso" className={ENLACE_DE_ACCESO}>
            Entrá
          </Link>
        </p>
      }
    >
      <FormularioDeRegistro
        emailInicial={email}
        alCrear={(creado) => {
          setEmail(creado);
          setEnviado(true);
        }}
      />
    </PantallaDeAcceso>
  );
}
