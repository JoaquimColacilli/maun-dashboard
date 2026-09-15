import webpush from 'web-push';

import type { Enviador } from './envio.ts';

const DOCE_HORAS = 12 * 60 * 60;

export const enviarConWebPush: Enviador = async (suscripcion, carga, vapid) => {
  await webpush.sendNotification(
    {
      endpoint: suscripcion.endpoint,
      keys: { p256dh: suscripcion.p256dh, auth: suscripcion.auth },
    },
    carga,
    {
      vapidDetails: {
        subject: vapid.sujeto,
        publicKey: vapid.publica,
        privateKey: vapid.privada,
      },
      TTL: DOCE_HORAS,
      urgency: 'normal',
    },
  );
};
