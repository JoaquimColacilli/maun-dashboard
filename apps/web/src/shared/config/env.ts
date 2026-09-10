import { z } from 'zod';

const FALTA = 'falta definirla';

const esquemaEnv = z.object({
  VITE_SUPABASE_URL: z.url({
    error: (issue) =>
      issue.input === undefined
        ? FALTA
        : 'tiene que ser una URL completa, por ejemplo http://127.0.0.1:54321',
  }),
  VITE_SUPABASE_PUBLISHABLE_KEY: z
    .string({ error: FALTA })
    .min(1, { error: FALTA })
    .refine((clave) => !clave.startsWith('sb_secret_'), {
      error: 'es una clave secreta (sb_secret_); en el cliente va la publishable',
    }),
});

export type Env = z.infer<typeof esquemaEnv>;

export class EnvInvalidoError extends Error {
  override readonly name = 'EnvInvalidoError';
}

export function leerEnv(fuente: Record<string, unknown>): Env {
  const resultado = esquemaEnv.safeParse(fuente);
  if (resultado.success) return resultado.data;

  const detalle = resultado.error.issues
    .map((issue) => `- ${issue.path.join('.')}: ${issue.message}`)
    .join('\n');
  throw new EnvInvalidoError(
    `La app no puede arrancar: faltan o son inválidas variables de entorno.\n${detalle}\nCopiá apps/web/.env.example a apps/web/.env y completalas.`,
  );
}
