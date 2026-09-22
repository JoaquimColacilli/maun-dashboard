import '@maun/ui/fonts.css';
import './styles/index.css';

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { EnvInvalidoError, leerEnv } from '@/shared/config';
import { esUnaPaginaPublica, vigilarLaVersionNueva } from '@/shared/lib';

import { App } from './App';

function mostrarErrorDeArranque(raiz: HTMLElement, mensaje: string): void {
  const aviso = document.createElement('pre');
  aviso.setAttribute('role', 'alert');
  aviso.className = 'm-5 whitespace-pre-wrap font-ui text-body leading-relaxed text-alerta';
  aviso.textContent = mensaje;
  raiz.replaceChildren(aviso);
}

export function arrancar(raiz: HTMLElement): void {
  try {
    leerEnv(import.meta.env);
  } catch (error) {
    if (error instanceof EnvInvalidoError) mostrarErrorDeArranque(raiz, error.message);
    throw error;
  }

  if (!esUnaPaginaPublica(globalThis.location.pathname)) vigilarLaVersionNueva();

  createRoot(raiz).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}
