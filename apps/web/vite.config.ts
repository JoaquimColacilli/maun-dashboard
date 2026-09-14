import { fileURLToPath, URL } from 'node:url';

import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defaultClientConditions, loadEnv } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import { defineConfig } from 'vitest/config';

const NOMBRE_DE_SECRETO = /SERVICE_ROLE|SECRET/i;

function esJwtDeServiceRole(valor: string): boolean {
  const payload = valor.split('.')[1];
  if (payload === undefined) return false;
  try {
    const claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as {
      role?: unknown;
    };
    return claims.role === 'service_role';
  } catch {
    return false;
  }
}

function rechazarSecretosEnElCliente(env: Record<string, string>): void {
  for (const [nombre, valor] of Object.entries(env)) {
    if (
      NOMBRE_DE_SECRETO.test(nombre) ||
      valor.startsWith('sb_secret_') ||
      esJwtDeServiceRole(valor)
    ) {
      throw new Error(
        `${nombre} parece una clave secreta de Supabase y terminaría en el bundle del navegador. Sacala del entorno del cliente.`,
      );
    }
  }
}

export default defineConfig(({ mode }) => {
  rechazarSecretosEnElCliente(loadEnv(mode, process.cwd(), 'VITE_'));

  return {
    resolve: {
      alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
      conditions: ['@maun/source', ...defaultClientConditions],
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks: (id) => (id.includes('node_modules') ? 'vendor' : undefined),
        },
      },
    },
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        strategies: 'injectManifest',
        srcDir: 'sw',
        filename: 'sw.ts',
        registerType: 'prompt',
        injectRegister: false,
        includeAssets: ['favicon.ico', 'favicon.svg', 'apple-touch-icon-180x180.png'],
        manifest: {
          name: 'MAUN',
          short_name: 'MAUN',
          description: 'Finanzas y proyectos del taller MAUN.',
          lang: 'es-AR',
          start_url: '/',
          scope: '/',
          display: 'standalone',
          background_color: '#ffffff',
          theme_color: '#141414',
          icons: [
            { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
            { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
            { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
            {
              src: 'maskable-icon-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
        },
        injectManifest: {
          globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        },
      }),
    ],
    test: {
      environment: 'jsdom',
      setupFiles: ['./vitest.setup.ts'],
      include: ['src/**/*.test.{ts,tsx}'],
    },
  };
});
