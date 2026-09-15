import { baseDeSupabase } from './base.ts';
import { configuracionDelEntorno } from './entorno.ts';
import { crearManejador } from './manejador.ts';
import { enviarConWebPush } from './web-push.ts';

const configuracion = configuracionDelEntorno(Deno.env);

Deno.serve(
  crearManejador({
    configuracion,
    base: baseDeSupabase(configuracion.supabaseUrl, configuracion.claveDelServidor),
    enviar: enviarConWebPush,
    ahora: () => new Date(),
  }),
);
