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
          // El vendor va en su propio chunk. No baja un byte del primer arranque —los dos chunks
          // están en el precache y entran con modulepreload, así que no aparece ningún spinner—,
          // pero la app es una PWA que precachea el shell: con todo junto, cambiar una pantalla
          // obliga a volver a bajar el bundle entero. Separado, un cambio de código son unos pocos
          // kilobytes, que desde un celular con mala señal es la diferencia entre una actualización
          // invisible y una espera (ADR 0015).
          manualChunks: (id) => (id.includes('node_modules') ? 'vendor' : undefined),
        },
      },
    },
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
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
        workbox: {
          globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
          navigateFallback: '/index.html',
          cleanupOutdatedCaches: true,
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
